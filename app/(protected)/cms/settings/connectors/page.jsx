'use client';

/**
 * MCP Bağlantı Kataloğu (cms:admin)
 *
 * İki sekme tek sayfada: kullanıcıya "Bağla" olarak görünen katalog girdileri ve
 * onları sınıflandıran kategoriler. Kategoriler ayrı bir route'a alınmadı —
 * `settings/connectors/categories` statik segmenti `[id]` üzerinde önceliklenir
 * ve detay sayfasını gölgelerdi.
 *
 * Backend `id` döndürür (`_id` değil); packages sayfasındaki `p._id` deseni
 * burada geçerli DEĞİL.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plug, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetCmsConnectorCatalogQuery,
  useDeleteConnectorCatalogEntryMutation,
  useUpdateConnectorCatalogEntryMutation,
  useGetConnectorCategoriesQuery,
  useCreateConnectorCategoryMutation,
  useUpdateConnectorCategoryMutation,
  useDeleteConnectorCategoryMutation,
} from '@/redux/services';

const statusMeta = {
  published: { label: 'Yayında', variant: 'success' },
  draft: { label: 'Taslak', variant: 'warning' },
  archived: { label: 'Arşivli', variant: 'muted' },
};
const authTypeMeta = {
  oauth2: { label: 'OAuth 2.0', variant: 'primary' },
  api_key: { label: 'API Anahtarı', variant: 'muted' },
  none: { label: 'Kimliksiz', variant: 'muted' },
};

const slugify = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const errText = (e, fallback) =>
  e?.data?.message || e?.data?.status?.description || e?.normalizedMessage || fallback;

// ─────────────────────────────────────────────────────────────
function CatalogTab({ authorized }) {
  const { data: entries = [], isLoading, error } = useGetCmsConnectorCatalogQuery({}, { skip: !authorized });
  const [updateEntry] = useUpdateConnectorCatalogEntryMutation();
  const [deleteEntry] = useDeleteConnectorCatalogEntryMutation();

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [notice, setNotice] = useState('');
  const isEmpty = !isLoading && !error && entries.length === 0;

  const togglePublish = async (e) => {
    const status = e.status === 'published' ? 'draft' : 'published';
    setNotice('');
    await updateEntry({ id: e.id, status })
      .unwrap()
      .catch((err) => setNotice(errText(err, 'Durum güncellenemedi.')));
  };

  const remove = async (id) => {
    setNotice('');
    await deleteEntry(id).unwrap().catch((err) => setNotice(errText(err, 'Silinemedi.')));
    setConfirmDelete(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Katalog Girdileri</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{entries.length} girdi</Badge>
          <Link href="/cms/settings/connectors/new" className={buttonVariants({ size: 'sm' })}>
            <Plus className="size-4" /> Yeni Girdi
          </Link>
        </CardToolbar>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {notice && (
          <div className="p-4 pb-0">
            <Alert variant="destructive"><AlertDescription>{notice}</AlertDescription></Alert>
          </div>
        )}
        {error ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertTitle>Katalog yüklenemedi</AlertTitle>
              <AlertDescription>{errText(error, 'Sunucuya ulaşılamadı.')}</AlertDescription>
            </Alert>
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6" />)}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Plug className="size-6 text-muted-foreground" />
            <p className="font-semibold text-foreground">Katalog boş</p>
            <p className="text-sm text-muted-foreground">Kullanıcıların bağlanabileceği bir MCP girdisi ekleyin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Girdi</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Kimlik</TableHead>
                  <TableHead>MCP Sunucusu</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const s = statusMeta[e.status] ?? { label: e.status, variant: 'muted' };
                  const a = authTypeMeta[e.authType] ?? { label: e.authType, variant: 'muted' };
                  // serverUrl override boşsa provider.config.js'ten devralınmıştır.
                  const inherited = !e.mcpConfigOverride?.serverUrl && e.mcpConfig?.serverUrl;
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link href={`/cms/settings/connectors/${e.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                          {e.icon ? `${e.icon} ` : ''}{e.name}
                        </Link>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{e.key}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.category}</TableCell>
                      <TableCell><Badge variant={a.variant}>{a.label}</Badge></TableCell>
                      <TableCell className="max-w-[260px]">
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {e.mcpConfig?.serverUrl || '—'}
                        </p>
                        {inherited && <span className="text-[10px] text-muted-foreground">devralındı</span>}
                      </TableCell>
                      <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Link href={`/cms/settings/connectors/${e.id}`} className={buttonVariants({ variant: 'ghost', size: 'icon' }) + ' size-7'}>
                            <Pencil className="size-3.5" />
                          </Link>
                          <Button size="sm" variant="ghost" onClick={() => togglePublish(e)}>
                            {e.status === 'published' ? 'Taslağa al' : 'Yayınla'}
                          </Button>
                          {confirmDelete === e.id ? (
                            <>
                              <Button size="sm" variant="destructive" onClick={() => remove(e.id)}>Sil</Button>
                              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>İptal</Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => setConfirmDelete(e.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
function CategoriesTab({ authorized }) {
  const { data: categories = [], isLoading, error } = useGetConnectorCategoriesQuery({}, { skip: !authorized });
  const [createCategory, { isLoading: creating }] = useCreateConnectorCategoryMutation();
  const [updateCategory] = useUpdateConnectorCategoryMutation();
  const [deleteCategory] = useDeleteConnectorCategoryMutation();

  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', sortOrder: 0 });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [notice, setNotice] = useState('');

  const handleCreate = async () => {
    const name = form.name.trim();
    if (!name) return;
    setNotice('');
    await createCategory({
      name,
      slug: form.slug.trim() || slugify(name),
      description: form.description.trim(),
    })
      .unwrap()
      .then(() => setForm({ name: '', slug: '', description: '' }))
      .catch((err) => setNotice(errText(err, 'Kategori oluşturulamadı.')));
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    // `slug` düzenlenemez: connector'lar ona string olarak bağlı (kimlik anahtarı).
    setEditForm({ name: c.name || '', description: c.description || '', sortOrder: c.sortOrder ?? 0 });
  };
  const saveEdit = async () => {
    setNotice('');
    await updateCategory({ id: editingId, ...editForm })
      .unwrap()
      .then(() => setEditingId(null))
      .catch((err) => setNotice(errText(err, 'Kategori güncellenemedi.')));
  };

  const remove = async (id) => {
    setNotice('');
    // Backend, referans veren connector/katalog girdisi varsa 409 döner.
    // Sessizce yutulursa admin neden silinmediğini göremez.
    await deleteCategory(id).unwrap().catch((err) => setNotice(errText(err, 'Kategori silinemedi.')));
    setConfirmDelete(null);
  };

  return (
    <>
      {notice && <Alert variant="destructive" className="mb-4"><AlertDescription>{notice}</AlertDescription></Alert>}

      <Card className="mb-5">
        <CardHeader><CardTitle>Yeni Kategori</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Ad</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))}
              placeholder="Örn. Verimlilik"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Slug (sonradan değiştirilemez)</label>
            <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="verimlilik" />
          </div>
          <div className="min-w-[200px] flex-[2]">
            <label className="mb-1 block text-xs text-muted-foreground">Açıklama</label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Opsiyonel" />
          </div>
          <Button onClick={handleCreate} disabled={creating || !form.name.trim()}>
            <Plus className="size-4" /> Ekle
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kategori Listesi</CardTitle>
          <CardToolbar><Badge variant="muted">{categories.length} kategori</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="p-2">
          {error ? (
            <div className="p-2">
              <Alert variant="destructive">
                <AlertTitle>Kategoriler yüklenemedi</AlertTitle>
                <AlertDescription>{errText(error, 'Sunucuya ulaşılamadı.')}</AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : categories.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Henüz kategori yok.</p>
          ) : (
            <div className="space-y-0.5">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
                  {editingId === c.id ? (
                    <>
                      <Input className="max-w-[180px]" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                      <Badge variant="muted" className="font-mono">{c.slug}</Badge>
                      <Input className="flex-1" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                      <Input
                        type="number"
                        className="max-w-[90px]"
                        value={editForm.sortOrder}
                        onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                      />
                      <Button size="sm" variant="ghost" onClick={saveEdit}><Check className="size-4 text-green-600" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="size-4" /></Button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{c.name}</span>
                          <Badge variant="muted" className="font-mono">{c.slug}</Badge>
                          {c.status !== 'active' && <Badge variant="muted">Pasif</Badge>}
                        </div>
                        {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
                      </div>
                      {confirmDelete === c.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-destructive">Emin misiniz?</span>
                          <Button size="sm" variant="destructive" onClick={() => remove(c.id)}>Sil</Button>
                          <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>İptal</Button>
                        </div>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Pencil className="size-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(c.id)}><Trash2 className="size-3.5 text-destructive" /></Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
const TAB_KEYS = ['catalog', 'categories'];
const DEFAULT_TAB = 'catalog';

function ConnectorCatalogPageInner() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Aktif sekme URL'de tutulur: ?tab=<key>. Geçersiz/eksik → varsayılan (temiz URL).
  const tabParam = searchParams.get('tab');
  const tab = TAB_KEYS.includes(tabParam) ? tabParam : DEFAULT_TAB;
  const setTab = (key) => {
    router.replace(key === DEFAULT_TAB ? pathname : `${pathname}?tab=${key}`, { scroll: false });
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Sistem Ayarları"
        title="Bağlantılar (MCP)"
        description="Kullanıcıların bağlanabileceği MCP connector kataloğunu ve kategorilerini yönetin"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="catalog">Katalog</TabsTrigger>
          <TabsTrigger value="categories">Kategoriler</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog">
          <CatalogTab authorized={authorized} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab authorized={authorized} />
        </TabsContent>
      </Tabs>
    </RoleGuard>
  );
}

// useSearchParams (App Router) Suspense sınırı gerektirir.
export default function ConnectorCatalogPage() {
  return (
    <Suspense fallback={null}>
      <ConnectorCatalogPageInner />
    </Suspense>
  );
}
