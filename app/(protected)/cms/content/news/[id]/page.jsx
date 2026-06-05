'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
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
  Crosshair,
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
  useGetSocialPostsQuery,
  useCreateSocialPostMutation,
  useDeleteSocialPostMutation,
  useRequeueSocialPostMutation,
} from '@/redux/services';
import { NEWS_COUNTRIES, DEFAULT_NEWS_COUNTRY } from '@/config/api';
import { statusMeta, contentTypeMeta } from '../_data';
import { marked } from 'marked';

const DEFAULT_COUNTRY = DEFAULT_NEWS_COUNTRY;

/* ─── helpers ─── */
function flattenTree(nodes, depth = 0, acc = []) {
  for (const n of nodes || []) {
    acc.push({ id: n._id ?? n.id, name: n.name, depth });
    if (n.children?.length) flattenTree(n.children, depth + 1, acc);
  }
  return acc;
}

/** Başlıktan URL-dostu slug üretir (Türkçe karakter farkında). Yazım sırasında
 *  baştaki/sondaki tireyi KIRPMAZ — aksi halde "foo-bar" yazılamaz; kırpma kayıt
 *  anında `cleanSlug` ile yapılır. */
function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

/** Kayıt anında baştaki/sondaki tireyi kırpan son sadeleştirme. */
function cleanSlug(text) {
  return slugify(text).replace(/^-+|-+$/g, '');
}

const PLATFORMS = [
  { value: 'x', label: 'X (Twitter)', icon: '𝕏' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'facebook', label: 'Facebook', icon: '📘' },
  { value: 'instagram', label: 'Instagram', icon: '📷' },
  { value: 'discord', label: 'Discord', icon: '🎮' },
  { value: 'telegram', label: 'Telegram', icon: '✈️' },
];

const socialStatusMeta = {
  queued: { label: 'Kuyrukta', variant: 'secondary', icon: Clock },
  scheduled: { label: 'Zamanlandı', variant: 'primary', icon: Clock },
  publishing: { label: 'Paylaşılıyor', variant: 'warning', icon: Clock },
  published: { label: 'Yayınlandı', variant: 'success', icon: CheckCircle2 },
  failed: { label: 'Hata', variant: 'destructive', icon: AlertCircle },
};

function fmtDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ─── Simple toolbar for textarea ─── */
function EditorToolbar({ onInsert, mode = 'markdown' }) {
  const markdownTools = [
    { icon: Bold,      label: 'Kalın',    insert: '**metin**' },
    { icon: Italic,    label: 'İtalik',   insert: '_metin_' },
    { icon: Hash,      label: 'Başlık',   insert: '\n## Başlık\n' },
    { icon: List,      label: 'Liste',    insert: '\n- öğe\n' },
    { icon: LinkIcon,  label: 'Bağlantı', insert: '[metin](url)' },
    { icon: ImageIcon, label: 'Görsel',   insert: '![açıklama](https://görsel-url)' },
  ];
  const htmlTools = [
    { icon: Bold,      label: 'Kalın',    insert: '<strong>metin</strong>' },
    { icon: Italic,    label: 'İtalik',   insert: '<em>metin</em>' },
    { icon: Hash,      label: 'Başlık',   insert: '\n<h2>Başlık</h2>\n' },
    { icon: List,      label: 'Liste',    insert: '\n<ul>\n  <li>öğe</li>\n</ul>\n' },
    { icon: LinkIcon,  label: 'Bağlantı', insert: '<a href="url">metin</a>' },
    { icon: ImageIcon, label: 'Görsel',   insert: '<img src="https://görsel-url" alt="açıklama" style="max-width:100%" />' },
  ];
  const tools = mode === 'html' ? htmlTools : markdownTools;
  return (
    <div className="flex items-center gap-0.5 rounded-t-lg border border-b-0 border-input bg-muted/40 px-2 py-1.5">
      {tools.map(({ icon: Icon, label, insert }) => (
        <button
          key={label}
          type="button"
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

const ASPECTS = [['16/9', '16:9'], ['4/3', '4:3'], ['1/1', '1:1'], ['3/2', '3:2']];
const FITS = [['cover', 'Kırp'], ['contain', 'Sığdır'], ['fill', 'Ger']];
const clampPct = (n) => Math.max(0, Math.min(100, Math.round(n)));

function insertAtCursor(textareaRef, currentValue, insert) {
  const el = textareaRef?.current;
  if (!el) return currentValue + insert;
  const start = el.selectionStart ?? currentValue.length;
  const end = el.selectionEnd ?? currentValue.length;
  const next = currentValue.slice(0, start) + insert + currentValue.slice(end);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + insert.length, start + insert.length);
  });
  return next;
}

const PREVIEW_CLASSES =
  'h-[calc(100%-22px)] min-h-[200px] overflow-y-auto rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed ' +
  '[&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2 ' +
  '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-3 ' +
  '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 ' +
  '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 ' +
  '[&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 ' +
  '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 ' +
  '[&_a]:text-primary [&_a]:underline ' +
  '[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground';

/* ─── Bölüm görsel alanı (her bölümün üstünde) — odak + en-boy ayarı ─── */
function SectionImageArea({ section, articleId, isCover, onUpdate, onSetCover, coverToggle = false, emptyText = 'Bu bölümde görsel yok' }) {
  const [genAiImage, { isLoading: genImaging }] = useGenerateNewsAiImageMutation();
  const [editUrl, setEditUrl] = useState(false);
  const [urlVal, setUrlVal] = useState(section.imageUrl || '');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [focalMode, setFocalMode] = useState(false);
  const [err, setErr] = useState('');
  const img = section.imageUrl;
  const fx = section.imageFocalX ?? 50;
  const fy = section.imageFocalY ?? 50;
  const aspect = section.imageAspect || '16/9';
  const fit = section.imageFit || 'cover';

  async function genAi() {
    if (!aiPrompt.trim() || !articleId) return;
    setErr('');
    try {
      const r = await genAiImage({ id: articleId, prompt: aiPrompt.trim() }).unwrap();
      const url = r?.url;
      if (url) { onUpdate({ imageUrl: url }); setAiOpen(false); setAiPrompt(''); }
      else setErr('Görsel üretildi ama URL alınamadı.');
    } catch (e) {
      setErr(e?.data?.message || 'Görsel üretilemedi.');
    }
  }

  function onFocalClick(e) {
    if (!focalMode) return;
    const r = e.currentTarget.getBoundingClientRect();
    onUpdate({
      imageFocalX: clampPct(((e.clientX - r.left) / r.width) * 100),
      imageFocalY: clampPct(((e.clientY - r.top) / r.height) * 100),
    });
  }

  return (
    <div className="space-y-2 border-b border-border bg-muted/20 p-3">
      {img ? (
        <>
          <div
            className={cn('relative overflow-hidden rounded-lg border border-border', focalMode && 'cursor-crosshair ring-2 ring-primary')}
            style={{ aspectRatio: aspect.replace('/', ' / ') }}
            onClick={onFocalClick}
          >
            <img src={img} alt={section.imageAlt || ''} className="h-full w-full" style={{ objectFit: fit, objectPosition: `${fx}% ${fy}%` }} />
            {isCover && (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                <Star className="size-3" />Kapak
              </span>
            )}
            {/* Odak işaretçisi */}
            {focalMode && (
              <div
                className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.4)]"
                style={{ left: `${fx}%`, top: `${fy}%` }}
              />
            )}
            {!focalMode && (
              <div className="absolute bottom-2 right-2 flex gap-1.5">
                {coverToggle && (
                  isCover ? (
                    <Button size="sm" variant="default" className="h-7" onClick={() => onSetCover(null)} title="Bu görseli kapaktan kaldır">
                      <Star className="size-3.5 fill-current" />Kapağı kaldır
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 bg-background/90" onClick={() => onSetCover(section)} title="Bu görseli kapak yap">
                      <Star className="size-3.5" />Kapak yap
                    </Button>
                  )
                )}
                <Button size="sm" variant="outline" className="h-7 bg-background/90" onClick={() => { setUrlVal(img); setEditUrl((v) => !v); }}>Değiştir</Button>
                <Button size="sm" variant="outline" className="h-7 bg-background/90 text-destructive" onClick={() => onUpdate({ imageUrl: '' })}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* En-boy + odak araç çubuğu */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">En-boy:</span>
            {ASPECTS.map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => onUpdate({ imageAspect: val })}
                className={cn('rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                  aspect === val ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent')}
              >
                {label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            <span className="text-xs text-muted-foreground">Sığdır:</span>
            {FITS.map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => onUpdate({ imageFit: val })}
                className={cn('rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                  fit === val ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent')}
              >
                {label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            <Button size="sm" variant={focalMode ? 'default' : 'outline'} className="h-7" onClick={() => setFocalMode((v) => !v)}>
              <Crosshair className="size-3.5" />
              {focalMode ? `Odak: %${fx},%${fy} — Bitir` : 'Odak Ayarla'}
            </Button>
            {(fx !== 50 || fy !== 50) && (
              <Button size="sm" variant="ghost" className="h-7" onClick={() => onUpdate({ imageFocalX: 50, imageFocalY: 50 })}>Sıfırla</Button>
            )}
          </div>
          {focalMode && (
            <p className="text-xs text-muted-foreground">Görsele tıklayarak odak noktasını (kırpmada merkez) belirleyin.</p>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-dashed border-border px-3 py-3 text-muted-foreground">
          <span className="flex items-center gap-2 text-sm"><ImageIcon className="size-4" />{emptyText}</span>
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
          <Button size="sm" className="h-8" onClick={() => { onUpdate({ imageUrl: urlVal.trim() }); setEditUrl(false); }}>Uygula</Button>
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

  // Kapak tekildir: yalnızca URL'i kapakla eşleşen İLK bölüm "Kapak" rozeti alır
  // (aynı URL birden çok bölümde olsa bile iki rozet görünmez).
  const coverIdx = sections.findIndex((s) => s.imageUrl && s.imageUrl === coverUrl);

  return (
    <div className="space-y-3">
      {sections.map((sec, idx) => (
        <div key={idx} className="overflow-hidden rounded-xl border border-border bg-background">
          {/* Bölüm görseli — içeriğin üstünde */}
          <SectionImageArea
            section={sec}
            articleId={articleId}
            isCover={idx === coverIdx}
            coverToggle
            onUpdate={(patch) => onChange(sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)))}
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
  const [sections, setSections] = useState([{
    heading: '', text: '', order: 1,
    imageUrl: '', imageFocalX: 50, imageFocalY: 50, imageAspect: '16/9', imageFit: 'cover',
  }]);
  const [htmlContent, setHtmlContent] = useState('');
  const [mdContent, setMdContent] = useState('');
  const [status, setStatus] = useState('draft');
  const [coverImageUrl, setCoverImageUrl] = useState(''); // ana kapak (top-level imageUrl)
  const [coverFocalX, setCoverFocalX] = useState(50);
  const [coverFocalY, setCoverFocalY] = useState(50);
  const [coverAspect, setCoverAspect] = useState('16/9');
  const [coverFit, setCoverFit] = useState('cover');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState('content'); // content | social
  const [saveError, setSaveError] = useState('');

  const htmlTextareaRef = useRef(null);
  const mdTextareaRef = useRef(null);

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
    setSections(
      doc.content?.length
        ? doc.content.map((s) => ({
            heading: s.heading || '',
            text: s.text || '',
            order: s.order ?? 1,
            imageUrl: s.imageUrl || '',
            imageFocalX: s.imageFocalX ?? 50,
            imageFocalY: s.imageFocalY ?? 50,
            imageAspect: s.imageAspect || '16/9',
            imageFit: s.imageFit || 'cover',
          }))
        : [{ heading: '', text: '', order: 1, imageUrl: '', imageFocalX: 50, imageFocalY: 50, imageAspect: '16/9', imageFit: 'cover' }]
    );
    setHtmlContent(doc.htmlContent || '');
    setMdContent(doc.markdownContent || '');
    setStatus(doc.status || 'draft');
    setCoverImageUrl(doc.imageUrl || '');
    setCoverFocalX(doc.imageFocalX ?? 50);
    setCoverFocalY(doc.imageFocalY ?? 50);
    setCoverAspect(doc.imageAspect || '16/9');
    setCoverFit(doc.imageFit || 'cover');
    setCountry(doc.countryCode || DEFAULT_COUNTRY);
  }, [doc]);

  // Social posts — gerçek API (cron'da kayıtlı zamanlanmış paylaşımlar)
  const { data: socialData } = useGetSocialPostsQuery(id, { skip: isNew || !authorized });
  const posts = socialData?.posts ?? [];
  const socialCounts = posts.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const [createSocialPost, { isLoading: addingPost }] = useCreateSocialPostMutation();
  const [deleteSocialPost] = useDeleteSocialPostMutation();
  const [requeueSocialPost] = useRequeueSocialPostMutation();
  const [newPost, setNewPost] = useState({ platform: 'x', postText: '', scheduledAt: '' });
  const [socialError, setSocialError] = useState('');

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

  // Kapak görseli — SectionImageArea'yı tüm içerik tipleri için yeniden kullanır.
  const coverSection = {
    imageUrl: coverImageUrl,
    imageAlt: meta.title,
    imageFocalX: coverFocalX,
    imageFocalY: coverFocalY,
    imageAspect: coverAspect,
    imageFit: coverFit,
  };
  function updateCover(patch) {
    if ('imageUrl' in patch) setCoverImageUrl(patch.imageUrl || '');
    if ('imageFocalX' in patch) setCoverFocalX(patch.imageFocalX);
    if ('imageFocalY' in patch) setCoverFocalY(patch.imageFocalY);
    if ('imageAspect' in patch) setCoverAspect(patch.imageAspect);
    if ('imageFit' in patch) setCoverFit(patch.imageFit);
  }
  // Bölümden "Kapak yap" (toggle): sec verilirse görseli + sunum ayarlarını kapağa kopyala,
  // null verilirse (kapağı kaldır) kapağı temizle. Kapak tekildir — yeni kapak set edilince
  // imageUrl üzerine yazılır, böylece eski bölümün "Kapak" rozeti otomatik kalkar.
  function handleSetCover(sec) {
    if (!sec) {
      setCoverImageUrl('');
      setCoverFocalX(50);
      setCoverFocalY(50);
      setCoverAspect('16/9');
      setCoverFit('cover');
      return;
    }
    setCoverImageUrl(sec.imageUrl || '');
    setCoverFocalX(sec.imageFocalX ?? 50);
    setCoverFocalY(sec.imageFocalY ?? 50);
    setCoverAspect(sec.imageAspect || '16/9');
    setCoverFit(sec.imageFit || 'cover');
  }

  function buildBody() {
    // Backend richSections.heading/body 'required' → boş bölümler 500'e yol açar.
    // Tamamen boş bölümleri gönderme; kalanların order'ını yeniden numaralandır.
    const cleanRichSections = richSections
      .filter((s) => (s.heading || '').trim() || (s.body || '').trim())
      .map((s, i) => ({ ...s, order: i + 1 }));
    const cleanContent = sections
      .filter((s) => (s.heading || '').trim() || (s.text || '').trim())
      .map((s, i) => ({ ...s, order: i + 1 }));
    return {
      title: meta.title,
      subtitle: meta.subtitle,
      slug: (cleanSlug(meta.slug) || cleanSlug(meta.title)) || undefined,
      categoryId: meta.categoryId || undefined,
      tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      contentType: meta.contentType,
      richSections: cleanRichSections,
      content: cleanContent,
      htmlContent,
      markdownContent: mdContent,
      imageUrl: coverImageUrl || null,
      imageFocalX: coverFocalX,
      imageFocalY: coverFocalY,
      imageAspect: coverAspect,
      imageFit: coverFit,
      countryCode: country,
      status,
    };
  }

  async function handleSave() {
    setSaveError('');
    const title = meta.title.trim();
    const effectiveSlug = cleanSlug(meta.slug) || cleanSlug(title);
    // Backend zorunlu alanlar: title, slug, countryCode, categoryId — eksikse 400 döner.
    if (!title) { setSaveError('Başlık zorunludur.'); return; }
    if (!effectiveSlug) { setSaveError('Slug üretilemedi — lütfen elle bir slug girin.'); return; }
    if (!meta.categoryId) { setSaveError('Lütfen bir kategori seçin.'); return; }

    const body = buildBody();
    // Zengin bölümlerde backend hem başlık hem içerik (heading+body) zorunlu kılar.
    // Yarım dolu bölüm varsa, anlamsız 500 yerine net uyarı göster.
    const incompleteRich = (body.richSections || []).find(
      (s) => !(s.heading || '').trim() || !(s.body || '').trim()
    );
    if (incompleteRich) {
      setSaveError('Her zengin bölümde hem başlık hem de içerik dolu olmalı (ya da bölümü boş bırakın, otomatik atlanır).');
      return;
    }
    try {
      if (isNew) {
        const r = await createNews(body).unwrap();
        const newId = r?.data?._id ?? r?.data?.id ?? r?._id ?? r?.id;
        if (newId) router.push(`/cms/content/news/${newId}`);
        else setSaveError('Haber oluşturuldu ancak kimliği alınamadı. Haber listesinden açabilirsiniz.');
      } else {
        await updateNews({ id, ...body }).unwrap();
      }
    } catch (e) {
      setSaveError(e?.data?.message || e?.normalizedMessage || e?.error || 'Haber kaydedilemedi.');
    }
  }

  async function handlePublish() {
    if (isNew) { setSaveError('Yayınlamadan önce haberi kaydedin.'); return; }
    setSaveError('');
    try {
      if (status === 'published') {
        await unpublishNews(id).unwrap();
        setStatus('draft');
      } else {
        await publishNews(id).unwrap();
        setStatus('published');
      }
    } catch (e) {
      setSaveError(e?.data?.message || e?.normalizedMessage || e?.error || 'İşlem başarısız oldu.');
    }
  }

  async function handleDelete() {
    if (isNew) { router.push('/cms/content/news'); return; }
    setSaveError('');
    try {
      await deleteNews(id).unwrap();
      router.push('/cms/content/news');
    } catch (e) {
      setSaveError(e?.data?.message || e?.normalizedMessage || e?.error || 'Haber silinemedi.');
    }
  }

  async function addPost() {
    if (!newPost.postText.trim() || isNew) return;
    setSocialError('');
    const body = {
      platform: newPost.platform,
      postText: newPost.postText.trim(),
      ...(newPost.scheduledAt ? { scheduledAt: new Date(newPost.scheduledAt).toISOString() } : {}),
    };
    try {
      await createSocialPost({ id, ...body }).unwrap();
      setNewPost({ platform: 'x', postText: '', scheduledAt: '' });
    } catch (e) {
      setSocialError(e?.data?.message || e?.normalizedMessage || e?.error || 'Paylaşım eklenemedi.');
    }
  }
  async function removePost(postId) {
    setSocialError('');
    try {
      await deleteSocialPost({ id, postId }).unwrap();
    } catch (e) {
      setSocialError(e?.data?.message || e?.normalizedMessage || e?.error || 'Paylaşım silinemedi.');
    }
  }
  async function requeuePost(postId) {
    setSocialError('');
    try {
      await requeueSocialPost({ id, postId }).unwrap();
    } catch (e) {
      setSocialError(e?.data?.message || e?.normalizedMessage || e?.error || 'Paylaşım yeniden kuyruğa alınamadı.');
    }
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
            onSetCover={handleSetCover}
          />
        );
      case 'sections': {
        // Kapak tekildir: yalnızca URL'i kapakla eşleşen İLK bölüm "Kapak" rozeti alır.
        const sectionsCoverIdx = sections.findIndex((s) => s.imageUrl && s.imageUrl === coverImageUrl);
        return (
          <div className="space-y-3">
            {sections.map((sec, idx) => (
              <div key={idx} className="overflow-hidden rounded-xl border border-border bg-background">
                <SectionImageArea
                  section={sec}
                  articleId={isNew ? null : id}
                  isCover={idx === sectionsCoverIdx}
                  coverToggle
                  onUpdate={(patch) =>
                    setSections((s) => s.map((x, i) => i === idx ? { ...x, ...patch } : x))
                  }
                  onSetCover={handleSetCover}
                />
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
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
                <div className="px-3 pb-3 pt-2">
                  <textarea
                    value={sec.text}
                    onChange={(e) => setSections((s) => s.map((x, i) => i === idx ? { ...x, text: e.target.value } : x))}
                    rows={3}
                    placeholder="Bölüm metni…"
                    className="w-full rounded-lg border border-input bg-muted/20 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-y placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setSections((s) => [...s, {
              heading: '', text: '', order: s.length + 1,
              imageUrl: '', imageFocalX: 50, imageFocalY: 50, imageAspect: '16/9', imageFit: 'cover',
            }])}>
              <Plus className="size-3.5" /> Bölüm Ekle
            </Button>
          </div>
        );
      }
      case 'html':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-2sm font-medium text-muted-foreground">HTML Editörü</div>
              <EditorToolbar mode="html" onInsert={(txt) => setHtmlContent((c) => insertAtCursor(htmlTextareaRef, c, txt))} />
              <textarea
                ref={htmlTextareaRef}
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                rows={16}
                placeholder="<h2>Başlık</h2><p>İçerik buraya...</p>"
                className="w-full rounded-b-lg rounded-t-none border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/30 resize-y placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <div className="mb-1 text-2sm font-medium text-muted-foreground">Önizleme</div>
              <div
                className={PREVIEW_CLASSES}
                dangerouslySetInnerHTML={{ __html: htmlContent || '<span class="text-muted-foreground italic">Önizleme için HTML yazın…</span>' }}
              />
            </div>
          </div>
        );
      case 'markdown':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-2sm font-medium text-muted-foreground">Markdown</div>
              <EditorToolbar mode="markdown" onInsert={(txt) => setMdContent((c) => insertAtCursor(mdTextareaRef, c, txt))} />
              <textarea
                ref={mdTextareaRef}
                value={mdContent}
                onChange={(e) => setMdContent(e.target.value)}
                rows={16}
                placeholder="## Başlık&#10;&#10;İçerik buraya..."
                className="w-full rounded-b-lg rounded-t-none border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/30 resize-y placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <div className="mb-1 text-2sm font-medium text-muted-foreground">Önizleme</div>
              <div
                className={PREVIEW_CLASSES}
                dangerouslySetInnerHTML={{
                  __html: mdContent
                    ? marked.parse(mdContent)
                    : '<span class="text-muted-foreground italic">Önizleme için Markdown yazın…</span>',
                }}
              />
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

      {saveError && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Kaydedilemedi</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

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
                <Input
                  value={meta.slug}
                  onChange={(e) => setMeta((m) => ({ ...m, slug: slugify(e.target.value) }))}
                  placeholder={slugify(meta.title) || 'haber-slug'}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">Boş bırakılırsa başlıktan otomatik üretilir.</p>
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
            <div className="space-y-4">
              {/* Kapak / öne çıkan görsel — TÜM içerik tipleri için (richSections, sections, html, markdown) */}
              <Card>
                <CardHeader>
                  <CardTitle>Kapak / Öne Çıkan Görsel</CardTitle>
                  <CardToolbar>
                    <span className="text-xs text-muted-foreground">Public haber detayında hero olarak gösterilir</span>
                  </CardToolbar>
                </CardHeader>
                <CardContent>
                  <SectionImageArea
                    section={coverSection}
                    articleId={isNew ? null : id}
                    isCover
                    onUpdate={updateCover}
                    onSetCover={() => {}}
                    emptyText="Henüz kapak görseli eklenmedi — URL ekleyin veya AI ile üretin"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{contentTypeMeta[meta.contentType]?.label ?? 'İçerik'} Editörü</CardTitle>
                </CardHeader>
                <CardContent>
                  <ContentEditor />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Social Tab */}
          {activeTab === 'social' && (
            <Card>
              <CardHeader>
                <CardTitle>Sosyal Medya Paylaşımları</CardTitle>
                <CardToolbar>
                  {(socialCounts.scheduled ?? 0) > 0 && (
                    <Badge variant="primary">{socialCounts.scheduled} zamanlanmış</Badge>
                  )}
                  {(socialCounts.queued ?? 0) > 0 && (
                    <Badge variant="secondary">{socialCounts.queued} kuyrukta</Badge>
                  )}
                  <Badge variant="secondary">{posts.length} paylaşım</Badge>
                </CardToolbar>
              </CardHeader>
              <CardContent className="space-y-4">
                {isNew ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                    Sosyal medya paylaşımı eklemek için önce haberi kaydedin.
                  </div>
                ) : (
                  <>
                    {socialError && (
                      <Alert variant="destructive">
                        <AlertTitle>İşlem başarısız</AlertTitle>
                        <AlertDescription>{socialError}</AlertDescription>
                      </Alert>
                    )}
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
                      <p className="text-xs text-muted-foreground">
                        Zaman seçilmezse paylaşım hemen kuyruğa alınır. İleri bir tarih seçilirse cron o zamanda yayınlar.
                      </p>
                      <textarea
                        value={newPost.postText}
                        onChange={(e) => setNewPost((p) => ({ ...p, postText: e.target.value }))}
                        rows={3}
                        placeholder="Paylaşım metni…"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-none placeholder:text-muted-foreground"
                      />
                      <div className="flex justify-end">
                        <Button size="sm" onClick={addPost} disabled={!newPost.postText.trim() || addingPost}>
                          {addingPost ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                          Ekle
                        </Button>
                      </div>
                    </div>

                    {/* Posts list */}
                    {posts.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Bu haber için zamanlanmış paylaşım yok.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {posts.map((post) => {
                          const sm = socialStatusMeta[post.status] ?? { label: post.status, variant: 'secondary' };
                          const pl = PLATFORMS.find((p) => p.value === post.platform);
                          const when = post.publishedAt || post.scheduledAt;
                          return (
                            <div key={post._id} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
                              <span className="mt-0.5 text-base">{pl?.icon ?? '📣'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm line-clamp-2">{post.postText}</p>
                                {when && (
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {post.publishedAt ? 'Yayınlandı: ' : 'Planlanan: '}{fmtDateTime(when)}
                                  </p>
                                )}
                              </div>
                              <Badge variant={sm.variant} className="shrink-0 mt-0.5">{sm.label}</Badge>
                              <div className="flex shrink-0 gap-1">
                                {post.status === 'failed' && (
                                  <Button variant="ghost" size="icon" className="size-7" title="Yeniden kuyruğa ekle" onClick={() => requeuePost(post._id)}>
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
                                {post.status !== 'published' && post.status !== 'publishing' && (
                                  <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => removePost(post._id)}>
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
