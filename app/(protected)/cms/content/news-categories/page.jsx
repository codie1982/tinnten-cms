'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  ChevronRight, ChevronDown, Plus, Trash2, Save, X, FolderOpen, Hash,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { SplitShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
  useGetCategoryTreeQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} from '@/redux/services';
import { NEWS_COUNTRIES, DEFAULT_NEWS_COUNTRY } from '@/config/api';

const statusMeta = {
  active: { label: 'Aktif', variant: 'success' },
  passive: { label: 'Pasif', variant: 'muted' },
  inactive: { label: 'Pasif', variant: 'muted' },
};

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

/** Backend tree → id alanını _id'den türet (recursive). */
function normalizeTree(nodes) {
  return (nodes || []).map((n) => ({
    ...n,
    id: n._id ?? n.id,
    children: normalizeTree(n.children),
  }));
}

function flattenCategories(cats, depth = 0) {
  const result = [];
  for (const c of cats) {
    result.push({ ...c, depth });
    if (c.children?.length) result.push(...flattenCategories(c.children, depth + 1));
  }
  return result;
}

function CategoryRow({ cat, depth = 0, onSelect, selectedId }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = cat.children?.length > 0;
  const isSelected = selectedId === cat.id;
  const count = cat.articleCount ?? cat.contentCount;

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
        <Badge variant={statusMeta[cat.status]?.variant ?? 'muted'} className="shrink-0 text-xs">
          {statusMeta[cat.status]?.label ?? cat.status}
        </Badge>
        {count != null && <span className="shrink-0 text-xs text-muted-foreground">{count}</span>}
      </div>
      {hasChildren && expanded && cat.children.map((child) => (
        <CategoryRow key={child.id} cat={child} depth={depth + 1} onSelect={onSelect} selectedId={selectedId} />
      ))}
    </>
  );
}

const EMPTY_FORM = { name: '', slug: '', icon: '', description: '', parentId: '', status: 'active' };

export default function NewsCategoriesPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const [country, setCountry] = useState(DEFAULT_NEWS_COUNTRY);
  const { data: rawTree = [], isLoading, error } = useGetCategoryTreeQuery(
    { countryCode: country },
    { skip: !authorized },
  );
  const categories = useMemo(() => normalizeTree(rawTree), [rawTree]);
  const allFlat = useMemo(() => flattenCategories(categories), [categories]);

  const [createCategory, { isLoading: creating }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: updating }] = useUpdateCategoryMutation();
  const [deleteCategory] = useDeleteCategoryMutation();

  const [selected, setSelected] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saving = creating || updating;

  function startCreate() {
    setSelected(null);
    setIsCreating(true);
    setConfirmDelete(false);
    setForm(EMPTY_FORM);
  }
  function startEdit(cat) {
    setSelected(cat);
    setIsCreating(false);
    setConfirmDelete(false);
    setForm({
      name: cat.name || '',
      slug: cat.slug || '',
      icon: cat.icon || '',
      description: cat.description || '',
      parentId: cat.parentId || '',
      status: cat.status || 'active',
    });
  }
  function handleNameChange(val) {
    setForm((f) => ({ ...f, name: val, slug: f.slug || slugify(val) }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    const body = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      icon: form.icon || undefined,
      description: form.description || undefined,
      parentId: form.parentId || null,
      status: form.status,
      countryCode: country,
    };
    if (isCreating) {
      await createCategory(body).unwrap().catch(() => {});
    } else if (selected) {
      await updateCategory({ id: selected.id, ...body }).unwrap().catch(() => {});
    }
    setIsCreating(false);
    setSelected(null);
  }

  async function handleDelete() {
    if (!selected) return;
    await deleteCategory(selected.id).unwrap().catch(() => {});
    setSelected(null);
    setConfirmDelete(false);
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
        <div className="space-y-1.5">
          <label className="text-2sm font-medium text-foreground">Kategori Adı *</label>
          <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="örn. Teknoloji" />
        </div>

        <div className="space-y-1.5">
          <label className="text-2sm font-medium text-foreground">Slug</label>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/30 px-3 py-2">
            <Hash className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="kategori-adi"
              className="w-full bg-transparent font-mono text-xs text-muted-foreground outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-2sm font-medium text-foreground">İkon (emoji)</label>
          <Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="örn. 💻" />
        </div>

        <div className="space-y-1.5">
          <label className="text-2sm font-medium text-foreground">Üst Kategori</label>
          <Select value={form.parentId || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, parentId: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Ana kategori (opsiyonel)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ana Kategori</SelectItem>
              {allFlat
                .filter((c) => c.id !== selected?.id)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {'— '.repeat(c.depth)}{c.icon} {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

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

        <div className="space-y-1.5">
          <label className="text-2sm font-medium text-foreground">Durum</label>
          <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="passive">Pasif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={handleSave} disabled={!form.name.trim() || saving}>
            <Save className="size-4" />
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
          {!isCreating && selected && (
            confirmDelete ? (
              <Button variant="destructive" onClick={handleDelete}>Sil?</Button>
            ) : (
              <Button variant="destructive" size="icon" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" />
              </Button>
            )
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
          <div className="flex items-center gap-2">
            <div className="w-40">
              <Select value={country} onValueChange={(v) => { setCountry(v); setSelected(null); setIsCreating(false); }}>
                <SelectTrigger><SelectValue placeholder="Ülke" /></SelectTrigger>
                <SelectContent>
                  {NEWS_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={startCreate}>
              <Plus className="size-4" />
              Kategori Ekle
            </Button>
          </div>
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
            {error ? (
              <div className="p-2">
                <Alert variant="destructive">
                  <AlertTitle>Kategoriler yüklenemedi</AlertTitle>
                  <AlertDescription>
                    {error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı. (news:editor yetkisi gerekebilir.)'}
                  </AlertDescription>
                </Alert>
              </div>
            ) : isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
              </div>
            ) : categories.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Henüz kategori yok.</p>
            ) : (
              <div className="space-y-0.5">
                {categories.map((cat) => (
                  <CategoryRow key={cat.id} cat={cat} depth={0} onSelect={startEdit} selectedId={selected?.id} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </SplitShell>
    </RoleGuard>
  );
}
