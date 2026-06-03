'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Save,
  Globe,
  FileText,
  Trash2,
  Plus,
  X,
  Image as ImageIcon,
  Sparkles,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Loader2,
  Star,
  Bold,
  Italic,
  List,
  Link as LinkIcon,
  Hash,
  Share2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
  useGetNewsQuery,
  useCreateNewsMutation,
  useUpdateNewsMutation,
  usePublishNewsMutation,
  useUnpublishNewsMutation,
  useDeleteNewsMutation,
  useGetCategoryTreeQuery,
  useGenerateNewsAiImageMutation,
} from '@/redux/services';
import { NEWS_COUNTRIES, DEFAULT_NEWS_COUNTRY } from '@/config/api';
import { statusMeta, contentTypeMeta } from '../_data';

const DEFAULT_COUNTRY = DEFAULT_NEWS_COUNTRY;

/* ─── helpers ─── */
function flattenTree(nodes, depth = 0, acc = []) {
  for (const n of nodes || []) {
    acc.push({ id: n._id ?? n.id, name: n.name, depth });
    if (n.children?.length) flattenTree(n.children, depth + 1, acc);
  }
  return acc;
}

const PLATFORMS = [
  { value: 'x', label: 'X (Twitter)', icon: '𝕏' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'facebook', label: 'Facebook', icon: '📘' },
  { value: 'instagram', label: 'Instagram', icon: '📷' },
  { value: 'telegram', label: 'Telegram', icon: '✈️' },
];

const socialStatusMeta = {
  queued: { label: 'Kuyrukta', variant: 'secondary', icon: Clock },
  scheduled: { label: 'Zamanlandı', variant: 'primary', icon: Clock },
  published: { label: 'Yayınlandı', variant: 'success', icon: CheckCircle2 },
  failed: { label: 'Hata', variant: 'destructive', icon: AlertCircle },
};

/* ─── Simple toolbar for textarea ─── */
function EditorToolbar({ onInsert }) {
  const tools = [
    { icon: Bold, label: 'Kalın', insert: '**metin**' },
    { icon: Italic, label: 'İtalik', insert: '_metin_' },
    { icon: Hash, label: 'Başlık', insert: '\n## Başlık\n' },
    { icon: List, label: 'Liste', insert: '\n- öğe\n' },
    { icon: LinkIcon, label: 'Bağlantı', insert: '[metin](url)' },
  ];
  return (
    <div className="flex items-center gap-0.5 rounded-t-lg border border-b-0 border-input bg-muted/40 px-2 py-1.5">
      {tools.map(({ icon: Icon, label, insert }) => (
        <button
          key={label}
          title={label}
          onClick={() => onInsert(insert)}
          className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

/** Dizi elemanını yukarı/aşağı taşır + order alanını yeniden numaralandırır. */
function moveItem(arr, idx, dir) {
  const next = [...arr];
  const target = idx + dir;
  if (target < 0 || target >= next.length) return arr;
  [next[idx], next[target]] = [next[target], next[idx]];
  return next.map((s, i) => ({ ...s, order: i + 1 }));
}

/* ─── Bölüm görsel alanı (her bölümün üstünde) ─── */
function SectionImageArea({ section, articleId, isCover, onSetImage, onSetCover }) {
  const [genAiImage, { isLoading: genImaging }] = useGenerateNewsAiImageMutation();
  const [editUrl, setEditUrl] = useState(false);
  const [urlVal, setUrlVal] = useState(section.imageUrl || '');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [err, setErr] = useState('');
  const img = section.imageUrl;

  async function genAi() {
    if (!aiPrompt.trim() || !articleId) return;
    setErr('');
    try {
      const r = await genAiImage({ id: articleId, prompt: aiPrompt.trim() }).unwrap();
      const url = r?.url;
      if (url) { onSetImage(url); setAiOpen(false); setAiPrompt(''); }
      else setErr('Görsel üretildi ama URL alınamadı.');
    } catch (e) {
      setErr(e?.data?.message || 'Görsel üretilemedi.');
    }
  }

  return (
    <div className="space-y-2 border-b border-border bg-muted/20 p-3">
      {img ? (
        <div className="relative overflow-hidden rounded-lg border border-border" style={{ aspectRatio: '16/9' }}>
          <img src={img} alt={section.imageAlt || ''} className="h-full w-full object-cover" />
          {isCover && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
              <Star className="size-3" />Kapak
            </span>
          )}
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            {!isCover && (
              <Button size="sm" variant="outline" className="h-7 bg-background/90" onClick={() => onSetCover(img)}>
                <Star className="size-3.5" />Kapak yap
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 bg-background/90" onClick={() => { setUrlVal(img); setEditUrl((v) => !v); }}>Değiştir</Button>
            <Button size="sm" variant="outline" className="h-7 bg-background/90 text-destructive" onClick={() => onSetImage('')}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-dashed border-border px-3 py-3 text-muted-foreground">
          <span className="flex items-center gap-2 text-sm"><ImageIcon className="size-4" />Bu bölümde görsel yok</span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7" onClick={() => { setUrlVal(''); setEditUrl((v) => !v); }}>URL ekle</Button>
            <Button size="sm" variant="outline" className="h-7" onClick={() => setAiOpen((v) => !v)} disabled={!articleId} title={!articleId ? 'Önce kaydedin' : ''}>
              <Sparkles className="size-3.5" />AI
            </Button>
          </div>
        </div>
      )}

      {/* URL ile değiştir/ekle */}
      {editUrl && (
        <div className="flex gap-2">
          <input
            value={urlVal}
            onChange={(e) => setUrlVal(e.target.value)}
            placeholder="https://… görsel URL'i"
            className="h-8 flex-1 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring/30"
          />
          <Button size="sm" className="h-8" onClick={() => { onSetImage(urlVal.trim()); setEditUrl(false); }}>Uygula</Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditUrl(false)}>İptal</Button>
        </div>
      )}

      {/* AI üret */}
      {aiOpen && (
        <div className="space-y-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2">
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={2}
            placeholder="AI görsel istemi — örn. yapay zeka temalı modern haber görseli"
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/30"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7" onClick={genAi} disabled={genImaging || !aiPrompt.trim()}>
              {genImaging ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {genImaging ? 'Üretiliyor…' : 'Üret'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setAiOpen(false)} disabled={genImaging}>Vazgeç</Button>
          </div>
        </div>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

/* ─── Rich Section Editor ─── */
function RichSectionEditor({ sections, onChange, articleId, coverUrl, onSetCover }) {
  function updateSection(idx, key, val) {
    const next = sections.map((s, i) => (i === idx ? { ...s, [key]: val } : s));
    onChange(next);
  }
  function addSection() {
    onChange([...sections, { heading: '', body: '', order: sections.length + 1 }]);
  }
  function removeSection(idx) {
    onChange(sections.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  }

  return (
    <div className="space-y-3">
      {sections.map((sec, idx) => (
        <div key={idx} className="overflow-hidden rounded-xl border border-border bg-background">
          {/* Bölüm görseli — içeriğin üstünde */}
          <SectionImageArea
            section={sec}
            articleId={articleId}
            isCover={!!sec.imageUrl && sec.imageUrl === coverUrl}
            onSetImage={(url) => updateSection(idx, 'imageUrl', url)}
            onSetCover={onSetCover}
          />
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <div className="flex shrink-0 flex-col">
              <button onClick={() => onChange(moveItem(sections, idx, -1))} disabled={idx === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Yukarı">
                <ChevronUp className="size-3.5" />
              </button>
              <button onClick={() => onChange(moveItem(sections, idx, 1))} disabled={idx === sections.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Aşağı">
                <ChevronDown className="size-3.5" />
              </button>
            </div>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{idx + 1}</span>
            <input
              value={sec.heading}
              onChange={(e) => updateSection(idx, 'heading', e.target.value)}
              placeholder={`Bölüm ${idx + 1} başlığı`}
              className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            />
            <button onClick={() => removeSection(idx)} className="text-muted-foreground hover:text-destructive">
              <X className="size-4" />
            </button>
          </div>
          <div className="px-3 pb-3 pt-2">
            <textarea
              value={sec.body}
              onChange={(e) => updateSection(idx, 'body', e.target.value)}
              rows={4}
              placeholder="Bölüm içeriği (HTML destekli)…"
              className="w-full rounded-lg border border-input bg-muted/20 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/30 resize-y placeholder:text-muted-foreground"
            />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addSection}>
        <Plus className="size-3.5" />
        Bölüm Ekle
      </Button>
    </div>
  );
}

/* ─── page ─── */
export default function NewsDetailPage({ params }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data: doc, isLoading, error } = useGetNewsQuery(id, { skip: isNew || !authorized });
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const { data: tree = [] } = useGetCategoryTreeQuery({ countryCode: country }, { skip: !authorized });
  const categories = useMemo(() => flattenTree(tree), [tree]);

  const [createNews, { isLoading: creating }] = useCreateNewsMutation();
  const [updateNews, { isLoading: updating }] = useUpdateNewsMutation();
  const [publishNews] = usePublishNewsMutation();
  const [unpublishNews] = useUnpublishNewsMutation();
  const [deleteNews] = useDeleteNewsMutation();
  const saving = creating || updating;

  const [meta, setMeta] = useState({
    title: '', subtitle: '', slug: '', categoryId: '', tags: '', contentType: 'richSections',
  });
  const [richSections, setRichSections] = useState([{ heading: '', body: '', order: 1 }]);
  const [sections, setSections] = useState([{ heading: '', text: '', order: 1 }]);
  const [htmlContent, setHtmlContent] = useState('');
  const [mdContent, setMdContent] = useState('');
  const [status, setStatus] = useState('draft');
  const [coverImageUrl, setCoverImageUrl] = useState(''); // ana kapak (top-level imageUrl)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState('content'); // content | social

  // Mevcut haber yüklenince formu doldur
  useEffect(() => {
    if (!doc) return;
    setMeta({
      title: doc.title || '',
      subtitle: doc.subtitle || '',
      slug: doc.slug || '',
      categoryId: doc.categoryId ? String(doc.categoryId._id ?? doc.categoryId) : '',
      tags: (doc.tags || []).join(', '),
      contentType: doc.contentType || 'richSections',
    });
    setRichSections(doc.richSections?.length ? doc.richSections : [{ heading: '', body: '', order: 1 }]);
    setSections(doc.content?.length ? doc.content : [{ heading: '', text: '', order: 1 }]);
    setHtmlContent(doc.htmlContent || '');
    setMdContent(doc.markdownContent || '');
    setStatus(doc.status || 'draft');
    setCoverImageUrl(doc.imageUrl || '');
    setCountry(doc.countryCode || DEFAULT_COUNTRY);
  }, [doc]);

  // Social posts (henüz API'ye bağlı değil — UI placeholder)
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({ platform: 'x', postText: '', scheduledAt: '' });

  if (!isNew && isLoading) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
        <PageHeader breadcrumb={[{ label: 'Haberler', href: '/cms/content/news' }, { label: '…' }]} title="Yükleniyor…" />
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-1" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      </RoleGuard>
    );
  }

  if (!isNew && (error || !doc)) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
        <PageHeader breadcrumb={[{ label: 'Haberler', href: '/cms/content/news' }, { label: 'Bulunamadı' }]} title="Haber Bulunamadı" />
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {error ? (error?.data?.message || 'Haber yüklenirken hata oluştu.') : 'Bu ID ile eşleşen haber bulunamadı.'}{' '}
            <Link href="/cms/content/news" className="text-primary hover:underline">Listeye dön</Link>
          </CardContent>
        </Card>
      </RoleGuard>
    );
  }

  function buildBody() {
    return {
      title: meta.title,
      subtitle: meta.subtitle,
      slug: meta.slug || undefined,
      categoryId: meta.categoryId || undefined,
      tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      contentType: meta.contentType,
      richSections,
      content: sections,
      htmlContent,
      markdownContent: mdContent,
      imageUrl: coverImageUrl || null,
      countryCode: country,
      status,
    };
  }

  async function handleSave() {
    if (!meta.title.trim()) return;
    const body = buildBody();
    if (isNew) {
      const r = await createNews(body).unwrap().catch(() => null);
      const newId = r?.data?._id ?? r?.data?.id ?? r?._id ?? r?.id;
      if (newId) router.push(`/cms/content/news/${newId}`);
    } else {
      await updateNews({ id, ...body }).unwrap().catch(() => {});
    }
  }

  async function handlePublish() {
    if (isNew) return;
    if (status === 'published') {
      await unpublishNews(id).unwrap().catch(() => {});
      setStatus('draft');
    } else {
      await publishNews(id).unwrap().catch(() => {});
      setStatus('published');
    }
  }

  async function handleDelete() {
    if (!isNew) await deleteNews(id).unwrap().catch(() => {});
    router.push('/cms/content/news');
  }

  function addPost() {
    if (!newPost.postText) return;
    setPosts((p) => [...p, { id: `sp-${p.length + 1}`, ...newPost, status: 'queued' }]);
    setNewPost({ platform: 'x', postText: '', scheduledAt: '' });
  }
  function removePost(pid) {
    setPosts((p) => p.filter((s) => s.id !== pid));
  }

  // Public sayfa linki: {site}/{locale}/discovery/{kategori-slug}/{haber-slug}
  const PUBLIC_SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tinten.ai').replace(/\/+$/, '');
  const catSlug = doc?.categoryId?.slug || null;
  const publicLocale = (doc?.countryCode || country || 'tr').toLowerCase();
  const publicUrl = !isNew && doc?.slug && catSlug
    ? `${PUBLIC_SITE}/${publicLocale}/discovery/${catSlug}/${doc.slug}`
    : null;

  /* ─── content editor based on type ─── */
  function ContentEditor() {
    switch (meta.contentType) {
      case 'richSections':
        return (
          <RichSectionEditor
            sections={richSections}
            onChange={setRichSections}
            articleId={isNew ? null : id}
            coverUrl={coverImageUrl}
            onSetCover={setCoverImageUrl}
          />
        );
      case 'sections':
        return (
          <div className="space-y-3">
            {sections.map((sec, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex shrink-0 flex-col">
                    <button onClick={() => setSections((s) => moveItem(s, idx, -1))} disabled={idx === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Yukarı"><ChevronUp className="size-3.5" /></button>
                    <button onClick={() => setSections((s) => moveItem(s, idx, 1))} disabled={idx === sections.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Aşağı"><ChevronDown className="size-3.5" /></button>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{idx + 1}</span>
                  <input
                    value={sec.heading}
                    onChange={(e) => setSections((s) => s.map((x, i) => i === idx ? { ...x, heading: e.target.value } : x))}
                    placeholder={`Bölüm ${idx + 1} başlığı`}
                    className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
                  />
                  <button onClick={() => setSections((s) => s.filter((_, i) => i !== idx).map((x, i) => ({ ...x, order: i + 1 })))}
                    className="text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
                </div>
                <textarea
                  value={sec.text}
                  onChange={(e) => setSections((s) => s.map((x, i) => i === idx ? { ...x, text: e.target.value } : x))}
                  rows={3}
                  placeholder="Bölüm metni…"
                  className="w-full rounded-lg border border-input bg-muted/20 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-y placeholder:text-muted-foreground"
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setSections((s) => [...s, { heading: '', text: '', order: s.length + 1 }])}>
              <Plus className="size-3.5" /> Bölüm Ekle
            </Button>
          </div>
        );
      case 'html':
        return (
          <div>
            <EditorToolbar onInsert={(txt) => setHtmlContent((c) => c + txt)} />
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              rows={16}
              placeholder="<h2>Başlık</h2><p>İçerik buraya...</p>"
              className="w-full rounded-b-lg rounded-t-none border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/30 resize-y placeholder:text-muted-foreground"
            />
          </div>
        );
      case 'markdown':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-2sm font-medium text-muted-foreground">Markdown</div>
              <textarea
                value={mdContent}
                onChange={(e) => setMdContent(e.target.value)}
                rows={16}
                placeholder="## Başlık&#10;&#10;İçerik buraya..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/30 resize-y placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <div className="mb-1 text-2sm font-medium text-muted-foreground">Önizleme</div>
              <div className="h-[calc(100%-22px)] min-h-[200px] rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {mdContent || <span className="italic">Önizleme için Markdown yazın…</span>}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        breadcrumb={[
          { label: 'Haberler', href: '/cms/content/news' },
          { label: isNew ? 'Yeni Haber' : meta.title || 'Düzenle' },
        ]}
        title={isNew ? 'Yeni Haber Oluştur' : 'Haberi Düzenle'}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={statusMeta[status]?.variant}>{statusMeta[status]?.label}</Badge>
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <Button variant="outline">
                  <ExternalLink className="size-4" />
                  Sitede Gör
                </Button>
              </a>
            )}
            <Button variant="outline" onClick={handlePublish}>
              {status === 'published' ? (
                <><FileText className="size-4" />Taslağa Al</>
              ) : (
                <><Globe className="size-4" />Yayınla</>
              )}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="size-4" />
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ─ Meta Panel ─ */}
        <div className="lg:col-span-1 space-y-5">
          <Card>
            <CardHeader><CardTitle>Meta Bilgileri</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Başlık *</label>
                <Input value={meta.title} onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))} placeholder="Haber başlığı" />
              </div>
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Alt Başlık</label>
                <textarea
                  value={meta.subtitle}
                  onChange={(e) => setMeta((m) => ({ ...m, subtitle: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-none placeholder:text-muted-foreground"
                  placeholder="Kısa açıklama"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Slug</label>
                <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/30 px-3 py-2">
                  <Hash className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground truncate">{meta.slug || 'haber-slug'}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Ülke</label>
                <Select value={country} onValueChange={(v) => { setCountry(v); setMeta((m) => ({ ...m, categoryId: '' })); }}>
                  <SelectTrigger><SelectValue placeholder="Ülke" /></SelectTrigger>
                  <SelectContent>
                    {NEWS_COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Kategori</label>
                <Select value={meta.categoryId || 'none'} onValueChange={(v) => setMeta((m) => ({ ...m, categoryId: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kategorisiz</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{`${'— '.repeat(c.depth)}${c.name}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Etiketler</label>
                <Input value={meta.tags} onChange={(e) => setMeta((m) => ({ ...m, tags: e.target.value }))} placeholder="etiket1, etiket2, etiket3" />
                <p className="text-xs text-muted-foreground">Virgülle ayırın</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">İçerik Formatı</label>
                <Select value={meta.contentType} onValueChange={(v) => setMeta((m) => ({ ...m, contentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="richSections">Zengin Bölümler</SelectItem>
                    <SelectItem value="sections">Bölümler</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="p-4 space-y-2">
              {confirmDelete ? (
                <div className="flex gap-2">
                  <Button className="flex-1" variant="destructive" onClick={handleDelete}>Evet, Sil</Button>
                  <Button variant="outline" onClick={() => setConfirmDelete(false)}>İptal</Button>
                </div>
              ) : (
                <Button className="w-full" variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" />
                  {isNew ? 'İptal Et' : 'Haberi Sil'}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─ Content + Cover + Social ─ */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tab Nav */}
          <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
            {[
              { key: 'content', label: 'İçerik', icon: FileText },
              { key: 'social', label: 'Sosyal Medya', icon: Share2 },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors',
                  activeTab === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Content Tab */}
          {activeTab === 'content' && (
            <Card>
              <CardHeader>
                <CardTitle>{contentTypeMeta[meta.contentType]?.label ?? 'İçerik'} Editörü</CardTitle>
              </CardHeader>
              <CardContent>
                <ContentEditor />
              </CardContent>
            </Card>
          )}

          {/* Social Tab */}
          {activeTab === 'social' && (
            <Card>
              <CardHeader>
                <CardTitle>Sosyal Medya Paylaşımları</CardTitle>
                <CardToolbar>
                  <Badge variant="secondary">{posts.length} paylaşım</Badge>
                </CardToolbar>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* New post form */}
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm font-medium">Yeni Paylaşım</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={newPost.platform} onValueChange={(v) => setNewPost((p) => ({ ...p, platform: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((pl) => <SelectItem key={pl.value} value={pl.value}>{pl.icon} {pl.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <input
                      type="datetime-local"
                      value={newPost.scheduledAt}
                      onChange={(e) => setNewPost((p) => ({ ...p, scheduledAt: e.target.value }))}
                      className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 text-muted-foreground"
                    />
                  </div>
                  <textarea
                    value={newPost.postText}
                    onChange={(e) => setNewPost((p) => ({ ...p, postText: e.target.value }))}
                    rows={3}
                    placeholder="Paylaşım metni…"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-none placeholder:text-muted-foreground"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={addPost} disabled={!newPost.postText}>
                      <Send className="size-3.5" />
                      Ekle
                    </Button>
                  </div>
                </div>

                {/* Posts list */}
                <div className="space-y-2">
                  {posts.map((post) => {
                    const sm = socialStatusMeta[post.status] ?? {};
                    const pl = PLATFORMS.find((p) => p.value === post.platform);
                    return (
                      <div key={post.id} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
                        <span className="mt-0.5 text-base">{pl?.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm">{post.postText}</p>
                          {post.scheduledAt && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{post.scheduledAt}</p>
                          )}
                        </div>
                        <Badge variant={sm.variant} className="shrink-0 mt-0.5">{sm.label}</Badge>
                        <div className="flex shrink-0 gap-1">
                          {post.status === 'failed' && (
                            <Button variant="ghost" size="icon" className="size-7" title="Yeniden kuyruğa ekle">
                              <RefreshCw className="size-3.5" />
                            </Button>
                          )}
                          {post.platformPostUrl && (
                            <a href={post.platformPostUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="size-7">
                                <ExternalLink className="size-3.5" />
                              </Button>
                            </a>
                          )}
                          <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => removePost(post.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
