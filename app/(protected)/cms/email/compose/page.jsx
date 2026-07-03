'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Send, Loader2, Paperclip, X, Upload, File as FileIcon, AlertCircle, Eye,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MailTemplateEditor } from '@/components/cms/mail-template-editor';
import { useFileUpload, formatBytes } from '@/hooks/use-file-upload';
import { uploadMailAttachment } from '@/lib/mail-attachment-upload';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
  useGetMergeVariablesQuery,
  useSendDirectMailMutation,
  usePreviewDirectMailMutation,
} from '@/redux/services';

// Sabit gönderen adresleri — yeni adres için bu diziye satır ekleyin.
// no-reply@tinten.ai (tireli) backend'in doğrulanmış SES gönderenidir (MAIL_FROM).
const FROM_ADDRESSES = [
  { value: 'no-reply@tinten.ai', label: 'Bildirim · no-reply@tinten.ai' },
  { value: 'engin.erol@tinten.ai', label: 'Engin Erol · engin.erol@tinten.ai' },
];

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB / dosya
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "a@b.com, c@d.com; e@f.com" → ['a@b.com', 'c@d.com', 'e@f.com']
const parseRecipients = (raw) =>
  String(raw || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

// Editör HTML'i görsel olarak boş mu? (etiketleri sıyırıp bak)
const isHtmlEmpty = (html) =>
  !String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();

// RTK Query hatası → kullanıcı mesajı. Backend güncel değilse (yeni /email/* uçları
// yüklü değil) HTML 404 döner → RTK Query PARSING_ERROR; ham "Unexpected token '<'"
// yerine net, yönlendirici bir mesaj göster.
const errorMessage = (e, fallback) => {
  if (e?.status === 'PARSING_ERROR' || e?.originalStatus === 404 || e?.status === 404) {
    return 'Backend ucu bulunamadı (404). Yeni mail uçları için backend servisini yeniden başlatın.';
  }
  if (e?.status === 'FETCH_ERROR') {
    return 'Backend servisine ulaşılamadı. Servisin çalıştığından emin olun.';
  }
  return e?.normalizedMessage || e?.data?.message || fallback;
};

export default function ComposeMailPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data: variables = [] } = useGetMergeVariablesQuery(undefined, { skip: !authorized });
  const [sendDirectMail, { isLoading: sending }] = useSendDirectMailMutation();
  const [previewDirectMail, { isLoading: previewing }] = usePreviewDirectMailMutation();

  const [from, setFrom] = useState(FROM_ADDRESSES[0].value);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [uploads, setUploads] = useState({}); // fileId -> { status, url?, filename?, key?, size?, mimeType?, error? }
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // { html: string|null } | null (null=kapalı, html=null=yükleniyor)

  // Dosya eklenince otomatik upload başlat; sonucu id bazlı sakla.
  const startUpload = async ({ id, file }) => {
    setUploads((u) => ({ ...u, [id]: { status: 'uploading' } }));
    try {
      const res = await uploadMailAttachment(file);
      setUploads((u) => ({ ...u, [id]: { status: 'done', ...res } }));
    } catch (e) {
      setUploads((u) => ({ ...u, [id]: { status: 'error', error: e?.message || 'Yüklenemedi' } }));
    }
  };

  const [
    { files, isDragging, errors: fileErrors },
    { removeFile, clearFiles, openFileDialog, getInputProps, handleDragEnter, handleDragLeave, handleDragOver, handleDrop },
  ] = useFileUpload({
    multiple: true,
    maxSize: MAX_ATTACHMENT_SIZE,
    onFilesAdded: (added) => added.forEach(startUpload),
  });

  const removeAttachment = (id) => {
    removeFile(id);
    setUploads((u) => {
      const next = { ...u };
      delete next[id];
      return next;
    });
  };

  const uploading = files.some((f) => uploads[f.id]?.status === 'uploading');

  const reset = () => {
    setTo('');
    setSubject('');
    setBodyHtml('');
    clearFiles();
    setUploads({});
  };

  const submit = async () => {
    setNotice('');
    setError('');

    const recipients = parseRecipients(to);
    if (recipients.length === 0) { setError('En az bir alıcı e-posta adresi girin.'); return; }
    const invalid = recipients.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length) { setError(`Geçersiz e-posta adresi: ${invalid.join(', ')}`); return; }
    if (!subject.trim()) { setError('Konu boş olamaz.'); return; }
    if (isHtmlEmpty(bodyHtml)) { setError('Mail içeriği boş olamaz.'); return; }
    if (uploading) { setError('Ekler hâlâ yükleniyor, lütfen bekleyin.'); return; }

    const attachments = files
      .map((f) => uploads[f.id])
      .filter((u) => u?.status === 'done')
      .map((u) => ({ filename: u.filename, url: u.url, key: u.key }));

    const r = await sendDirectMail({
      from,
      to: recipients,
      subject: subject.trim(),
      html: bodyHtml,
      attachments,
    })
      .unwrap()
      .catch((e) => ({ __err: errorMessage(e, 'Mail gönderilemedi.') }));

    if (r?.__err) { setError(r.__err); return; }
    setNotice(`Mail gönderildi → ${recipients.join(', ')}`);
    reset();
  };

  // Önizleme: gövdeyi backend'e gönderip FTL header/footer ile sarılmış tam HTML'i
  // modal iframe'de gösterir (gönderilecek mail'in birebir görünümü).
  const openPreview = async () => {
    setError('');
    if (isHtmlEmpty(bodyHtml)) { setError('Önizleme için önce içerik girin.'); return; }
    setPreview({ html: null }); // modalı aç, yükleniyor durumunu göster
    const r = await previewDirectMail({ html: bodyHtml, locale: 'tr' })
      .unwrap()
      .catch((e) => ({ __err: errorMessage(e, 'Önizleme alınamadı.') }));
    if (r?.__err) { setPreview(null); setError(r.__err); return; }
    setPreview({ html: r?.html || '' });
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Yeni Mail"
        description="@tinten.ai adreslerinden zengin içerikli, ekli e-posta gönderin"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={openPreview} disabled={previewing || sending}>
              {previewing ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />} Önizle
            </Button>
            <Button onClick={submit} disabled={sending || uploading}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Gönder
            </Button>
          </div>
        }
      />

      {notice && (
        <Alert variant="info" className="mb-4"><AlertDescription>{notice}</AlertDescription></Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Gönderilemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Sol: form + editör */}
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Kimden</label>
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FROM_ADDRESSES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Kime (virgülle çoklu)</label>
                <Input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="ornek@firma.com, ikinci@firma.com"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Konu</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mail konusu" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">İçerik</label>
              <MailTemplateEditor value={bodyHtml} onChange={setBodyHtml} variables={variables} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Değişkenler {`{{USER_NAME}}`} gibi düz metin olarak eklenir; alıcıya göre gönderimde doldurulur.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sağ: ekler */}
        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Paperclip className="size-4" /> Ekler
            </div>

            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={openFileDialog}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground transition-colors',
                isDragging ? 'border-primary bg-primary/5' : 'border-input hover:bg-accent',
              )}
            >
              <Upload className="size-5" />
              <span>Dosya sürükleyin ya da tıklayıp seçin</span>
              <span className="text-[11px]">Maks. {formatBytes(MAX_ATTACHMENT_SIZE)} / dosya</span>
            </div>
            {/* input dropzone dışında → tıklama olayı geri sarmalayıcıya sıçramaz */}
            <input {...getInputProps()} className="sr-only" />

            {fileErrors.length > 0 && <p className="text-xs text-destructive">{fileErrors[0]}</p>}

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((f) => {
                  const st = uploads[f.id];
                  return (
                    <li key={f.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs">
                      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{f.file.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatBytes(f.file.size)}
                          {st?.status === 'uploading' && ' · yükleniyor…'}
                          {st?.status === 'done' && ' · yüklendi'}
                          {st?.status === 'error' && ` · ${st.error}`}
                        </p>
                      </div>
                      {st?.status === 'uploading' && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
                      {st?.status === 'error' && <AlertCircle className="size-4 shrink-0 text-destructive" />}
                      <button
                        type="button"
                        onClick={() => removeAttachment(f.id)}
                        className="shrink-0 rounded p-1 hover:bg-accent"
                        title="Kaldır"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Önizleme modalı — header + body + footer birleşmiş tam mail */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <Card className="flex max-h-[88vh] w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Önizleme · header + içerik + footer</CardTitle>
              <CardToolbar>
                <Button variant="ghost" size="icon" onClick={() => setPreview(null)}>
                  <X className="size-4" />
                </Button>
              </CardToolbar>
            </CardHeader>
            <CardContent className="overflow-y-auto p-4">
              {preview.html === null ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              ) : (
                <iframe
                  title="mail-onizleme"
                  srcDoc={preview.html}
                  className="h-[72vh] w-full rounded-lg border border-border bg-white"
                  sandbox=""
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
