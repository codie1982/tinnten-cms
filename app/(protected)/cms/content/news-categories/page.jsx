'use client';

import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Tag,
  Save,
  X,
  FolderOpen,
  Hash,
  AlignLeft,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { SplitShell, EmptyState } from '@/components/layout/page-shell';
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

/* ─── mock data ─── */
const categoriesMock = [
  {
    id: 'cat-1',
    name: 'Teknoloji',
    slug: 'teknoloji',
    icon: '💻',
    description: 'Yazılım, donanım ve dijital dönüşüm haberleri',
    parentId: null,
    status: 'active',
    articleCount: 42,
    children: [
      { id: 'cat-1-1', name: 'Yapay Zeka', slug: 'yapay-zeka', icon: '🤖', description: 'AI ve makine öğrenmesi', parentId: 'cat-1', status: 'active', articleCount: 18, children: [] },
      { id: 'cat-1-2', name: 'Siber Güvenlik', slug: 'siber-guvenlik', icon: '🔒', description: 'Güvenlik açıkları ve koruma yöntemleri', parentId: 'cat-1', status: 'active', articleCount: 11, children: [] },
      { id: 'cat-1-3', name: 'Blockchain', slug: 'blockchain', icon: '⛓️', description: 'Kripto ve dağıtık sistemler', parentId: 'cat-1', status: 'passive', articleCount: 7, children: [] },
    ],
  },
  {
    id: 'cat-2',
    name: 'Ekonomi',
    slug: 'ekonomi',
    icon: '📈',
    description: 'Piyasa haberleri, analizler ve finans',
    parentId: null,
    status: 'active',
    articleCount: 35,
    children: [
      { id: 'cat-2-1', name: 'Borsa', slug: 'borsa', icon: '🏦', description: 'Hisse senedi ve piyasa analizleri', parentId: 'cat-2', status: 'active', articleCount: 21, children: [] },
      { id: 'cat-2-2', name: 'Girişimcilik', slug: 'girisimcilik', icon: '🚀', description: 'Startup ve yatırım haberleri', parentId: 'cat-2', status: 'active', articleCount: 9, children: [] },
    ],
  },
  {
    id: 'cat-3',
    name: 'B2B Pazar',
    slug: 'b2b-pazar',
    icon: '🏢',
    description: 'İşletmeler arası ticaret ve platform güncellemeleri',
    parentId: null,
    status: 'active',
    articleCount: 28,
    children: [
      { id: 'cat-3-1', name: 'Platform Haberleri', slug: 'platform-haberleri', icon: '📢', description: 'Tinnten platform duyuruları', parentId: 'cat-3', status: 'active', articleCount: 15, children: [] },
      { id: 'cat-3-2', name: 'Satıcı Rehberleri', slug: 'satici-rehberleri', icon: '📖', description: 'Satıcılar için ipuçları ve kılavuzlar', parentId: 'cat-3', status: 'active', articleCount: 8, children: [] },
      { id: 'cat-3-3', name: 'Başarı Hikayeleri', slug: 'basari-hikayeleri', icon: '⭐', description: 'Müşteri başarı vakaları', parentId: 'cat-3', status: 'passive', articleCount: 5, children: [] },
    ],
  },
  {
    id: 'cat-4',
    name: 'Sektörel',
    slug: 'sektoral',
    icon: '🏭',
    description: 'Sektör bazlı haberler ve raporlar',
    parentId: null,
    status: 'active',
    articleCount: 19,
    children: [
      { id: 'cat-4-1', name: 'Lojistik', slug: 'lojistik', icon: '🚛', description: 'Tedarik zinciri ve lojistik', parentId: 'cat-4', status: 'active', articleCount: 12, children: [] },
      { id: 'cat-4-2', name: 'İmalat', slug: 'imalat', icon: '⚙️', description: 'Üretim sektörü haberleri', parentId: 'cat-4', status: 'active', articleCount: 7, children: [] },
    ],
  },
];

const statusMeta = {
  active: { label: 'Aktif', variant: 'success' },
  passive: { label: 'Pasif', variant: 'muted' },
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

/* ─── flat list for parent select ─── */
function flattenCategories(cats, depth = 0) {
  const result = [];
  for (const c of cats) {
    result.push({ ...c, depth });
    if (c.children?.length) result.push(...flattenCategories(c.children, depth + 1));
  }
  return result;
}

/* ─── Category Row ─── */
function CategoryRow({ cat, depth = 0, onSelect, selectedId }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = cat.children?.length > 0;
  const isSelected = selectedId === cat.id;

  return (
    <>
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent',
          isSelected && 'bg-primary/10 text-primary',
        )}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => onSelect(cat)}
      >
        {hasChildren ? (
          <button
            className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <span className="shrink-0 text-base leading-none">{cat.icon || '📁'}</span>
        <span className={cn('flex-1 truncate font-medium', isSelected ? 'text-primary' : 'text-foreground')}>
          {cat.name}
        </span>
        <Badge variant={statusMeta[cat.status]?.variant} className="shrink-0 text-xs">
          {statusMeta[cat.status]?.label}
        </Badge>
        <span className="shrink-0 text-xs text-muted-foreground">{cat.articleCount}</span>
      </div>
      {hasChildren && expanded && cat.children.map((child) => (
        <CategoryRow key={child.id} cat={child} depth={depth + 1} onSelect={onSelect} selectedId={selectedId} />
      ))}
    </>
  );
}

/* ─── page ─── */
export default function NewsCategoriesPage() {
  const allFlat = flattenCategories(categoriesMock);
  const [categories, setCategories] = useState(categoriesMock);
  const [selected, setSelected] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', icon: '', description: '', parentId: '', status: 'active' });
  const [saving, setSaving] = useState(false);

  function startCreate() {
    setSelected(null);
    setIsCreating(true);
    setForm({ name: '', slug: '', icon: '', description: '', parentId: '', status: 'active' });
  }

  function startEdit(cat) {
    setSelected(cat);
    setIsCreating(false);
    setForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon || '',
      description: cat.description || '',
      parentId: cat.parentId || '',
      status: cat.status,
    });
  }

  function handleNameChange(val) {
    setForm((f) => ({ ...f, name: val, slug: slugify(val) }));
  }

  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setIsCreating(false);
    }, 600);
  }

  const panelOpen = isCreating || selected !== null;

  const aside = panelOpen ? (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle>{isCreating ? 'Yeni Kategori' : 'Kategoriyi Düzenle'}</CardTitle>
        <CardToolbar>
          <Button variant="ghost" size="icon" onClick={() => { setSelected(null); setIsCreating(false); }}>
            <X className="size-4" />
          </Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-2sm font-medium text-foreground">Kategori Adı *</label>
          <Input
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="örn. Teknoloji"
          />
        </div>

        {/* Slug */}
        <div className="space-y-1.5">
          <label className="text-2sm font-medium text-foreground">Slug</label>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/30 px-3 py-2">
            <Hash className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="font-mono text-xs text-muted-foreground">{form.slug || 'kategori-adi'}</span>
          </div>
        </div>

        {/* Icon */}
        <div className="space-y-1.5">
          <label className="text-2sm font-medium text-foreground">İkon (emoji)</label>
          <Input
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            placeholder="örn. 💻"
          />
        </div>

        {/* Parent */}
        <div className="space-y-1.5">
          <label className="text-2sm font-medium text-foreground">Üst Kategori</label>
          <Select value={form.parentId} onValueChange={(v) => setForm((f) => ({ ...f, parentId: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Ana kategori (opsiyonel)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Ana Kategori</SelectItem>
              {allFlat.filter((c) => !c.parentId).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {'  '.repeat(c.depth)}{c.icon} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-2sm font-medium text-foreground">Açıklama</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            placeholder="Kategori açıklaması..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <label className="text-2sm font-medium text-foreground">Durum</label>
          <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="passive">Pasif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={handleSave} disabled={!form.name || saving}>
            <Save className="size-4" />
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
          {!isCreating && (
            <Button variant="destructive" size="icon" onClick={() => setSelected(null)}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  ) : (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FolderOpen className="size-6" />
        </div>
        <p className="text-sm font-medium">Kategori seçin</p>
        <p className="text-xs text-muted-foreground">Düzenlemek için sol listeden bir kategori seçin</p>
      </CardContent>
    </Card>
  );

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Haberler"
        title="Haber Kategorileri"
        description="Keşfet akışı ve haber içerikleri için kategori hiyerarşisini yönetin"
        actions={
          <Button onClick={startCreate}>
            <Plus className="size-4" />
            Kategori Ekle
          </Button>
        }
      />

      <SplitShell aside={aside} asideWidth="w-80">
        <Card>
          <CardHeader>
            <CardTitle>Kategoriler</CardTitle>
            <CardToolbar>
              <Badge variant="muted">{allFlat.length} kategori</Badge>
            </CardToolbar>
          </CardHeader>
          <CardContent className="py-2">
            <div className="space-y-0.5">
              {categories.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  depth={0}
                  onSelect={startEdit}
                  selectedId={selected?.id}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </SplitShell>
    </RoleGuard>
  );
}
