'use client';

import { use, useState } from 'react';
import Link from 'next/link';
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
import { CMS_ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { newsMock, statusMeta, contentTypeMeta } from '../_data';

/* ─── helpers ─── */
const CATEGORIES = [
  { id: 'cat-1-1', name: 'Yapay Zeka' },
  { id: 'cat-1-2', name: 'Siber Güvenlik' },
  { id: 'cat-2-1', name: 'Borsa' },
  { id: 'cat-2-2', name: 'Girişimcilik' },
  { id: 'cat-3-1', name: 'Platform Haberleri' },
  { id: 'cat-3-2', name: 'Satıcı Rehberleri' },
  { id: 'cat-4-1', name: 'Lojistik' },
];

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

/* ─── Rich Section Editor ─── */
function RichSectionEditor({ sections, onChange }) {
  function updateSection(idx, key, val) {
    const next = sections.map((s, i) => (i === idx ? { ...s, [key]: val } : s));
    onChange(next);
  }
  function addSection() {
    onChange([...sections, { heading: '', body: '', order: sections.length + 1 }]);
  }
  function removeSection(idx) {
    onChange(sections.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {sections.map((sec, idx) => (
        <div key={idx} className="rounded-xl border border-border bg-background">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
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
  const raw = isNew ? null : newsMock.find((n) => n.id === id);

  const [meta, setMeta] = useState({
    title: raw?.title ?? '',
    subtitle: raw?.subtitle ?? '',
    slug: raw?.slug ?? '',
    categoryId: raw?.category?.id ?? '',
    tags: raw?.tags?.join(', ') ?? '',
    contentType: raw?.contentType ?? 'richSections',
  });
  const [richSections, setRichSections] = useState(raw?.richSections ?? [{ heading: '', body: '', order: 1 }]);
  const [sections, setSections] = useState(raw?.content ?? [{ heading: '', text: '', order: 1 }]);
  const [htmlContent, setHtmlContent] = useState(raw?.htmlContent ?? '');
  const [mdContent, setMdContent] = useState(raw?.markdownContent ?? '');
  const [status, setStatus] = useState(raw?.status ?? 'draft');
  const [saving, setSaving] = useState(false);

  // Social posts
  const [posts, setPosts] = useState([
    { id: 'sp-1', platform: 'x', postText: 'Tinnten B2B platformunda büyük gelişme! 🚀 #b2b #tinnten', status: 'published', scheduledAt: null, platformPostUrl: 'https://x.com' },
    { id: 'sp-2', platform: 'linkedin', postText: 'Platformumuzda önemli bir güncelleme yayınladık.', status: 'queued', scheduledAt: null },
    { id: 'sp-3', platform: 'telegram', postText: 'Haberler bölümünde yeni içerik mevcut.', status: 'failed', scheduledAt: null },
  ]);
  const [newPost, setNewPost] = useState({ platform: 'x', postText: '', scheduledAt: '' });
  const [activeTab, setActiveTab] = useState('content'); // content | cover | social

  if (!isNew && !raw) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
        <PageHeader breadcrumb={[{ label: 'Haberler', href: '/cms/content/news' }, { label: 'Bulunamadı' }]} title="Haber Bulunamadı" />
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Bu ID ile eşleşen haber bulunamadı.{' '}
            <Link href="/cms/content/news" className="text-primary hover:underline">Listeye dön</Link>
          </CardContent>
        </Card>
      </RoleGuard>
    );
  }

  function handleSave() {
    setSaving(true);
    setTimeout(() => setSaving(false), 700);
  }

  function handlePublish() {
    setStatus(status === 'published' ? 'draft' : 'published');
  }

  function addPost() {
    if (!newPost.postText) return;
    setPosts((p) => [...p, { id: `sp-${Date.now()}`, ...newPost, status: 'queued' }]);
    setNewPost({ platform: 'x', postText: '', scheduledAt: '' });
  }

  function removePost(id) {
    setPosts((p) => p.filter((s) => s.id !== id));
  }

  /* ─── content editor based on type ─── */
  function ContentEditor() {
    switch (meta.contentType) {
      case 'richSections':
        return <RichSectionEditor sections={richSections} onChange={setRichSections} />;
      case 'sections':
        return (
          <div className="space-y-3">
            {sections.map((sec, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-background p-3 space-y-2">
                <input
                  value={sec.heading}
                  onChange={(e) => setSections((s) => s.map((x, i) => i === idx ? { ...x, heading: e.target.value } : x))}
                  placeholder={`Bölüm ${idx + 1} başlığı`}
                  className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
                />
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
                <label className="text-2sm font-medium">Kategori</label>
                <Select value={meta.categoryId} onValueChange={(v) => setMeta((m) => ({ ...m, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
              <Button className="w-full" variant="destructive">
                <Trash2 className="size-4" />
                Haberi Sil
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ─ Content + Cover + Social ─ */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tab Nav */}
          <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
            {[
              { key: 'content', label: 'İçerik', icon: FileText },
              { key: 'cover', label: 'Görseller', icon: ImageIcon },
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

          {/* Cover Tab */}
          {activeTab === 'cover' && (
            <Card>
              <CardHeader>
                <CardTitle>Kapak Görseli & Galeri</CardTitle>
                <CardToolbar>
                  <Button variant="outline" size="sm">
                    <Sparkles className="size-3.5" />
                    AI Görsel
                  </Button>
                  <Button size="sm">
                    <Plus className="size-3.5" />
                    Görsel Ekle
                  </Button>
                </CardToolbar>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Main cover */}
                <div>
                  <p className="mb-2 text-2sm font-medium text-muted-foreground">Ana Kapak Görseli</p>
                  {raw?.imageUrl ? (
                    <div className="relative w-full overflow-hidden rounded-xl border border-border">
                      <img src={raw.imageUrl} alt="cover" className="h-48 w-full object-cover" />
                      <div className="absolute bottom-2 right-2 flex gap-1.5">
                        <Button size="sm" variant="outline" className="bg-background/90">
                          <X className="size-3.5" />
                          Kaldır
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground hover:border-primary/50 transition-colors">
                      <ImageIcon className="size-8" />
                      <p className="text-sm">Görsel seç veya yükle</p>
                    </div>
                  )}
                </div>

                {/* Gallery */}
                <div>
                  <p className="mb-2 text-2sm font-medium text-muted-foreground">Galeri</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[raw?.imageUrl].filter(Boolean).map((url, i) => (
                      <div key={i} className="group relative overflow-hidden rounded-lg border border-border">
                        <img src={url} alt="" className="h-24 w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <button className="rounded-md bg-background/90 p-1 text-xs">Ana yap</button>
                          <button className="rounded-md bg-destructive/90 p-1 text-white"><X className="size-3" /></button>
                        </div>
                      </div>
                    ))}
                    <div className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 transition-colors">
                      <Plus className="size-5" />
                      <span className="text-xs">Ekle</span>
                    </div>
                  </div>
                </div>
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
