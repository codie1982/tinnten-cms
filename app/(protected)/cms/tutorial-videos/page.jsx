'use client';

import { useRef, useState } from 'react';
import {
  CheckCircle2, FileAudio, FileText, Filter, Image, Languages,
  Loader2, Pencil, Plus, Search, Trash2, Upload, Video, X,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CONTENT_LOCALES } from '@/config/api';
import { CMS_ROLES } from '@/lib/roles';
import { uploadTutorialVideoAsset } from '@/lib/tutorial-video-upload';
import {
  useCreateTutorialVideoMutation,
  useDeleteTutorialVideoMutation,
  useGetCmsTutorialVideosQuery,
  useUpdateTutorialVideoMutation,
} from '@/redux/services';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tüm durumlar' },
  { value: 'draft', label: 'Taslak' },
  { value: 'published', label: 'Yayında' },
  { value: 'archived', label: 'Arşiv' },
];

const STATUS_META = {
  draft: { label: 'Taslak', variant: 'muted' },
  published: { label: 'Yayında', variant: 'success' },
  archived: { label: 'Arşiv', variant: 'secondary' },
};

const EMPTY_VIDEO = {
  title: '',
  description: '',
  slug: '',
  status: 'draft',
  video: null,
  thumbnail: null,
  durationSeconds: '',
  sortOrder: 0,
  localizations: [],
};

const assetText = (asset) => asset?.fileName || asset?.url?.split('/').pop() || 'Dosya yüklendi';

const toErrorMessage = (error, fallback) =>
  error?.data?.message || error?.normalizedMessage || error?.message || fallback;

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function AssetUpload({ asset, assetType, locale, tutorialVideoId, accept, label, icon: Icon, onUploaded, onClear, disabled }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function selectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const nextAsset = await uploadTutorialVideoAsset(file, { tutorialVideoId, assetType, locale });
      onUploaded(nextAsset);
    } catch (uploadError) {
      setError(toErrorMessage(uploadError, 'Dosya yüklenemedi.'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}{locale ? ` · ${locale.toUpperCase()}` : ''}</p>
      {asset ? (
        <div className="flex min-h-10 items-center gap-2 rounded-lg border border-green-500/25 bg-green-500/5 px-3 py-2">
          <Icon className="size-4 shrink-0 text-green-600 dark:text-green-400" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{assetText(asset)}</span>
          <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-400" />
          <button type="button" disabled={disabled || uploading} onClick={onClear} aria-label={`${label} kaldır`}
            className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive disabled:opacity-50">
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button type="button" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}
          className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60">
          {uploading ? <Loader2 className="size-4 animate-spin text-primary" /> : <Upload className="size-4 text-primary" />}
          <span>{uploading ? 'Yükleniyor…' : 'Dosya yükle'}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={selectFile} />
      {!asset && !tutorialVideoId && <p className="text-xs text-muted-foreground">Dosya eklemek için önce taslağı oluşturun.</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function TutorialVideoForm({ initial, saving, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_VIDEO, ...initial }));
  const [notice, setNotice] = useState(null);

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const setLocalizedAsset = (locale, field, asset) => {
    setForm((current) => {
      const existing = current.localizations.find((item) => item.locale === locale) || { locale, audio: null, subtitle: null };
      const nextItem = { ...existing, [field]: asset };
      const rest = current.localizations.filter((item) => item.locale !== locale);
      return { ...current, localizations: [...rest, nextItem] };
    });
  };

  async function submit(event) {
    event.preventDefault();
    setNotice(null);
    if (!form.title.trim()) {
      setNotice({ type: 'error', text: 'Video başlığı zorunludur.' });
      return;
    }
    if (form.status === 'published' && !form.video?.url) {
      setNotice({ type: 'error', text: 'Yayınlamak için ekran kaydı videosu yükleyin.' });
      return;
    }

    const localizations = form.localizations.filter((item) => item.audio || item.subtitle);
    try {
      await onSave({
        title: form.title.trim(),
        description: form.description.trim(),
        slug: form.slug.trim(),
        // Yeni kayda video yüklenmeden "yayında" statüsü verilemez; taslak
        // oluşturulduktan sonra dosya eklenir ve son kayıtta yayınlanır.
        status: initial.id ? form.status : 'draft',
        video: form.video,
        thumbnail: form.thumbnail,
        durationSeconds: form.durationSeconds === '' ? null : Number(form.durationSeconds),
        sortOrder: Number(form.sortOrder) || 0,
        localizations,
      });
    } catch (error) {
      setNotice({ type: 'error', text: toErrorMessage(error, 'Video kaydedilemedi.') });
    }
  }

  return (
    <Card className="mb-5 border-primary/30">
      <CardHeader>
        <CardTitle>{initial.id ? 'Eğitim videosunu düzenle' : 'Yeni eğitim videosu'}</CardTitle>
        <CardToolbar><Badge variant="outline">Yalnız yönetici</Badge></CardToolbar>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={submit}>
          {!initial.id && (
            <Alert variant="info">
              <AlertDescription>Önce taslağı oluşturun. Ardından dosyalar bu eğitim videosuna ait özel S3 alanına yüklenir; hiçbir kullanıcı kotasından düşmez.</AlertDescription>
            </Alert>
          )}
          {notice && (
            <Alert variant={notice.type === 'error' ? 'destructive' : 'info'}>
              <AlertDescription>{notice.text}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1.5 lg:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Başlık</label>
              <Input value={form.title} maxLength={180} placeholder="Örn. Ürün ekleme ekranı" onChange={(event) => setField('title', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Durum</label>
              <Select value={initial.id ? form.status : 'draft'} disabled={!initial.id} onValueChange={(value) => setField('status', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.filter((item) => item.value !== 'all').map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Bağlantı adı</label>
              <Input value={form.slug} maxLength={220} placeholder="urun-ekleme-ekrani (boş bırakılırsa başlıktan üretilir)" onChange={(event) => setField('slug', event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Süre (sn)</label><Input min="0" type="number" value={form.durationSeconds} onChange={(event) => setField('durationSeconds', event.target.value)} /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Sıra</label><Input min="0" type="number" value={form.sortOrder} onChange={(event) => setField('sortOrder', event.target.value)} /></div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Açıklama</label>
            <textarea rows={3} value={form.description} maxLength={5000} placeholder="Bu ekran kaydının ne anlattığını yazın…"
              onChange={(event) => setField('description', event.target.value)}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
          </div>

          <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-2">
            <AssetUpload asset={form.video} assetType="video" tutorialVideoId={initial.id} label="Ekran kaydı" icon={Video} accept="video/mp4,video/webm,video/quicktime" disabled={saving || !initial.id}
              onUploaded={(asset) => setField('video', asset)} onClear={() => setField('video', null)} />
            <AssetUpload asset={form.thumbnail} assetType="thumbnail" tutorialVideoId={initial.id} label="Kapak görseli" icon={Image} accept="image/jpeg,image/png,image/webp" disabled={saving || !initial.id}
              onUploaded={(asset) => setField('thumbnail', asset)} onClear={() => setField('thumbnail', null)} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2"><Languages className="size-4 text-primary" /><div><h3 className="text-sm font-semibold">Dil sesleri ve altyazılar</h3><p className="text-xs text-muted-foreground">Her dil için ses kaydı ve WebVTT (.vtt) altyazısı ekleyin.</p></div></div>
            <div className="grid gap-3 md:grid-cols-2">
              {CONTENT_LOCALES.map((language) => {
                const localization = form.localizations.find((item) => item.locale === language.code) || { locale: language.code, audio: null, subtitle: null };
                return (
                  <div key={language.code} className="space-y-3 rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between"><p className="text-sm font-medium">{language.name}</p><Badge variant={localization.audio || localization.subtitle ? 'success' : 'muted'}>{language.code.toUpperCase()}</Badge></div>
                    <AssetUpload asset={localization.audio} assetType="audio" locale={language.code} tutorialVideoId={initial.id} label="Ses kaydı" icon={FileAudio} accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/aac,audio/webm" disabled={saving || !initial.id}
                      onUploaded={(asset) => setLocalizedAsset(language.code, 'audio', asset)} onClear={() => setLocalizedAsset(language.code, 'audio', null)} />
                    <AssetUpload asset={localization.subtitle} assetType="subtitle" locale={language.code} tutorialVideoId={initial.id} label="Altyazı" icon={FileText} accept="text/vtt,.vtt" disabled={saving || !initial.id}
                      onUploaded={(asset) => setLocalizedAsset(language.code, 'subtitle', asset)} onClear={() => setLocalizedAsset(language.code, 'subtitle', null)} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>İptal</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{initial.id ? 'Değişiklikleri kaydet' : 'Taslağı oluştur'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function TutorialVideosPage() {
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [actionError, setActionError] = useState('');

  const { data, isLoading, isFetching, error } = useGetCmsTutorialVideosQuery({
    status: status === 'all' ? undefined : status,
    q: query.trim() || undefined,
    page,
    limit: 20,
  });
  const [createTutorialVideo, { isLoading: creating }] = useCreateTutorialVideoMutation();
  const [updateTutorialVideo, { isLoading: updating }] = useUpdateTutorialVideoMutation();
  const [deleteTutorialVideo, { isLoading: deleting }] = useDeleteTutorialVideoMutation();
  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const saving = creating || updating;

  const changeFilter = (nextStatus) => { setStatus(nextStatus); setPage(1); };
  const changeQuery = (event) => { setQuery(event.target.value); setPage(1); };

  async function saveVideo(payload) {
    setActionError('');
    if (editing?.id) {
      await updateTutorialVideo({ id: editing.id, ...payload }).unwrap();
      setEditing(null);
    } else {
      // S3 yolu eğitim videosu ID'siyle kuruluyor. Bu nedenle yeni kaydı önce
      // taslak olarak oluşturup, kullanıcıyı aynı formda dosya yüklemeye bırak.
      const created = await createTutorialVideo(payload).unwrap();
      setEditing(created);
    }
  }

  async function deleteVideo(video) {
    if (!window.confirm(`“${video.title}” videosunu silmek istediğinizden emin misiniz?`)) return;
    setActionError('');
    try {
      await deleteTutorialVideo(video.id).unwrap();
    } catch (deleteError) {
      setActionError(toErrorMessage(deleteError, 'Video silinemedi.'));
    }
  }

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader section="Eğitim içerikleri" title="Eğitim Videoları" description="Ekran kayıtlarını, dil seslerini ve WebVTT altyazılarını yönetin"
        actions={<Button onClick={() => setEditing(EMPTY_VIDEO)}><Plus className="size-4" />Yeni video</Button>} />

      {editing && <TutorialVideoForm key={editing.id || 'new'} initial={editing} saving={saving} onSave={saveVideo} onCancel={() => setEditing(null)} />}

      {actionError && <Alert variant="destructive" className="mb-5"><AlertTitle>İşlem tamamlanamadı</AlertTitle><AlertDescription>{actionError}</AlertDescription></Alert>}

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={changeQuery} placeholder="Başlık veya bağlantı adı ara…" className="ps-9" /></div>
          <Select value={status} onValueChange={changeFilter} className="w-40"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Video listesi</CardTitle><CardToolbar><Badge variant="muted">{pagination?.total ?? items.length} kayıt</Badge></CardToolbar></CardHeader>
        <CardContent className="relative px-0 py-0">
          {isFetching && !isLoading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60"><Loader2 className="size-6 animate-spin text-primary" /></div>}
          {error ? <div className="p-4"><Alert variant="destructive"><AlertTitle>Videolar yüklenemedi</AlertTitle><AlertDescription>{toErrorMessage(error, 'Sunucuya ulaşılamadı.')}</AlertDescription></Alert></div>
            : isLoading ? <div className="space-y-3 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
              : items.length === 0 ? <div className="flex flex-col items-center gap-3 py-16 text-center"><Filter className="size-6 text-muted-foreground" /><p className="font-semibold">Gösterilecek eğitim videosu bulunamadı</p><Button size="sm" variant="outline" onClick={() => { setQuery(''); changeFilter('all'); }}>Filtreleri sıfırla</Button></div>
                : <Table><TableHeader><TableRow><TableHead className="w-16">Kapak</TableHead><TableHead>Video</TableHead><TableHead>Diller</TableHead><TableHead>Durum</TableHead><TableHead>Süre</TableHead><TableHead>Güncelleme</TableHead><TableHead className="w-24 text-right">İşlem</TableHead></TableRow></TableHeader>
                  <TableBody>{items.map((video) => <TableRow key={video.id}><TableCell>{video.thumbnail?.url ? <img src={video.thumbnail.url} alt="" className="size-10 rounded-md object-cover" /> : <div className="flex size-10 items-center justify-center rounded-md bg-muted"><Video className="size-4 text-muted-foreground" /></div>}</TableCell><TableCell className="max-w-[360px]"><p className="line-clamp-1 font-medium">{video.title}</p><p className="mt-0.5 line-clamp-1 font-mono text-xs text-muted-foreground">/{video.slug}</p></TableCell><TableCell><div className="flex flex-wrap gap-1">{video.availableLocales?.length ? video.availableLocales.map((locale) => <Badge key={locale} variant="outline">{locale.toUpperCase()}</Badge>) : <span className="text-xs text-muted-foreground">Dil yok</span>}</div></TableCell><TableCell><Badge variant={STATUS_META[video.status]?.variant}>{STATUS_META[video.status]?.label ?? video.status}</Badge></TableCell><TableCell className="font-mono text-xs text-muted-foreground">{formatDuration(video.durationSeconds)}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(video.updatedAt)}</TableCell><TableCell><div className="flex justify-end gap-1"><button type="button" onClick={() => setEditing(video)} className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Videoyu düzenle"><Pencil className="size-3.5" /></button><button type="button" disabled={deleting} onClick={() => deleteVideo(video)} className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50" aria-label="Videoyu sil"><Trash2 className="size-3.5" /></button></div></TableCell></TableRow>)}</TableBody>
                </Table>}
        </CardContent>
      </Card>

      {pagination?.totalPages > 1 && <div className="mt-4 flex items-center justify-end gap-2"><span className="text-xs text-muted-foreground">Sayfa {pagination.page}/{pagination.totalPages}</span><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Önceki</Button><Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Sonraki</Button></div>}
    </RoleGuard>
  );
}
