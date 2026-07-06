'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Save, Loader2, ArrowLeft, Eye, Send, X } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MailTemplateEditor } from '@/components/cms/mail-template-editor';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { CONTENT_LOCALES } from '@/config/api';
import {
  useGetMailTemplateQuery,
  useUpdateMailTemplateMutation,
  usePreviewMailTemplateMutation,
  useGetMergeVariablesQuery,
  useSendDirectMailMutation,
} from '@/redux/services';
import {
  getDemoRecipients,
  addDemoRecipients,
  removeDemoRecipient,
} from '@/lib/mail-demo-recipients';

const STATUSES = [
  { value: 'draft', label: 'Taslak' },
  { value: 'active', label: 'Aktif' },
  { value: 'archived', label: 'Arşiv' },
];

// Demo/test gönderimlerinin geldiği doğrulanmış SES gönderen adresi (compose ile aynı).
const DEMO_FROM = 'no-reply@tinten.ai';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "a@b.com, c@d.com" → ['a@b.com', 'c@d.com']
const parseRecipients = (raw) =>
  String(raw || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export default function CampaignTemplateEditPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data: tpl, isLoading } = useGetMailTemplateQuery(id, { skip: !authorized || !id });
  const { data: variables = [] } = useGetMergeVariablesQuery(undefined, { skip: !authorized });
  const [updateTemplate, { isLoading: saving }] = useUpdateMailTemplateMutation();
  const [previewTemplate, { isLoading: previewing }] = usePreviewMailTemplateMutation();
  const [sendDirectMail] = useSendDirectMailMutation();

  const [form, setForm] = useState({ name: '', subject: '', bodyHtml: '', locale: 'tr', status: 'draft' });
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState('');

  // Demo / test gönderimi
  const [demoTo, setDemoTo] = useState('');
  const [recent, setRecent] = useState([]);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoNotice, setDemoNotice] = useState('');
  const [demoError, setDemoError] = useState('');

  // Kayıtlı demo adreslerini istemcide yükle; varsa en sonuncuyu inputa doldur.
  useEffect(() => {
    const saved = getDemoRecipients();
    setRecent(saved);
    if (saved.length) setDemoTo(saved[0]);
  }, []);

  useEffect(() => {
    if (tpl) {
      setForm({
        name: tpl.name || '',
        subject: tpl.subject || '',
        bodyHtml: tpl.bodyHtml || '',
        locale: tpl.locale || 'tr',
        status: tpl.status || 'draft',
      });
    }
  }, [tpl]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const r = await updateTemplate({ id, ...form }).unwrap().catch((e) => ({ __err: e?.data?.message || 'Kaydedilemedi' }));
    setNotice(r?.__err || 'Şablon kaydedildi.');
  };

  const doPreview = async () => {
    const r = await previewTemplate({ id, sampleVars: {} }).unwrap().catch(() => null);
    if (r) setPreview(r);
  };

  // Şablonu örnek değerlerle render edip (Önizle ile aynı çıktı) girilen adres(ler)e
  // ad-hoc mail olarak gönderir. Backend gövdeyi header/footer ile sarar. Kayıtlı sürüm
  // gönderilir — kaydedilmemiş değişiklikler yansımaz.
  const sendDemo = async () => {
    setDemoNotice('');
    setDemoError('');
    const recipients = parseRecipients(demoTo);
    if (!recipients.length) { setDemoError('En az bir e-posta adresi girin.'); return; }
    const invalid = recipients.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length) { setDemoError(`Geçersiz e-posta adresi: ${invalid.join(', ')}`); return; }

    setDemoBusy(true);
    try {
      const rendered = await previewTemplate({ id, sampleVars: {} }).unwrap().catch(() => null);
      if (!rendered?.html) { setDemoError('Şablon render edilemedi. Önce “Kaydet”e basın.'); return; }
      setPreview(rendered);

      const r = await sendDirectMail({
        from: DEMO_FROM,
        to: recipients,
        subject: rendered.subject,
        html: rendered.html,
      })
        .unwrap()
        .catch((e) => ({ __err: e?.data?.message || e?.normalizedMessage || 'Demo mail gönderilemedi.' }));

      if (r?.__err) { setDemoError(r.__err); return; }
      setRecent(addDemoRecipients(recipients));
      setDemoNotice(`Demo mail gönderildi → ${recipients.join(', ')}`);
    } finally {
      setDemoBusy(false);
    }
  };

  const forgetRecipient = (email) => {
    setRecent(removeDemoRecipient(email));
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email · Şablon"
        title={form.name || 'Şablon'}
        description="Gövdeye {{USER_NAME}} gibi değişkenleri editör üstündeki butonlarla ekleyin"
        actions={
          <div className="flex gap-2">
            <Link href="/cms/email/campaign-templates"><Button variant="outline"><ArrowLeft className="size-4" /> Liste</Button></Link>
            <Button variant="outline" onClick={doPreview} disabled={previewing}>
              {previewing ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />} Önizle
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Kaydet
            </Button>
          </div>
        }
      />

      {notice && <Alert variant="info" className="mb-4"><AlertDescription>{notice}</AlertDescription></Alert>}

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-4">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Şablon adı</label>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Konu (değişken içerebilir)</label>
                  <Input value={form.subject} onChange={(e) => set('subject', e.target.value)} />
                </div>
                <div className="flex gap-3">
                  <div className="w-40">
                    <label className="mb-1 block text-xs text-muted-foreground">Dil</label>
                    <select value={form.locale} onChange={(e) => set('locale', e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30">
                      {CONTENT_LOCALES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="w-40">
                    <label className="mb-1 block text-xs text-muted-foreground">Durum</label>
                    <select value={form.status} onChange={(e) => set('status', e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30">
                      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Gövde</label>
                  <MailTemplateEditor value={form.bodyHtml} onChange={(html) => set('bodyHtml', html)} variables={variables} />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Unsubscribe linki gönderimde otomatik eklenir. Değişkenler {`{{USER_NAME}}`} gibi düz metin olarak saklanır.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Önizleme */}
          <Card className="lg:sticky lg:top-4 lg:self-start">
            <CardHeader><CardTitle>Önizleme</CardTitle></CardHeader>
            <CardContent className="space-y-3 p-4">
              {tpl?.variables?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tpl.variables.map((v) => <Badge key={v} variant="secondary" className="font-mono text-[10px]">{`{{${v}}}`}</Badge>)}
                </div>
              )}
              {preview ? (
                <>
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">Konu:</span> {preview.subject}</div>
                  <div className="rounded-md border border-border p-3 text-sm" dangerouslySetInnerHTML={{ __html: preview.html }} />
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Önizlemek için “Önizle”ye basın (örnek değerlerle render edilir).</p>
              )}

              {/* Demo / Test gönder — kayıtlı şablonu örnek değerlerle kendi adresinize atın */}
              <div className="space-y-2 rounded-md border border-dashed border-border p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Send className="size-3.5" /> Demo / Test gönder
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Kayıtlı şablonu örnek değerlerle girdiğiniz adrese gönderir. Kaydedilmemiş
                  değişiklikleri görmek için önce “Kaydet”e basın.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    list="demo-recipients"
                    value={demoTo}
                    onChange={(e) => setDemoTo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendDemo(); } }}
                    placeholder="ornek@mail.com"
                    className="h-9"
                  />
                  <datalist id="demo-recipients">
                    {recent.map((e) => <option key={e} value={e} />)}
                  </datalist>
                  <Button size="sm" onClick={sendDemo} disabled={demoBusy || !demoTo.trim()}>
                    {demoBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Gönder
                  </Button>
                </div>

                {recent.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {recent.map((e) => (
                      <span key={e} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                        <button type="button" onClick={() => setDemoTo(e)} className="hover:underline" title="Adresi kullan">{e}</button>
                        <button type="button" onClick={() => forgetRecipient(e)} className="text-muted-foreground hover:text-destructive" title="Kayıttan kaldır">
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {demoNotice && <p className="text-[11px] font-medium text-emerald-600">{demoNotice}</p>}
                {demoError && <p className="text-[11px] text-destructive">{demoError}</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
