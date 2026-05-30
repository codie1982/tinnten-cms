'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetDocCategoriesQuery,
  useCreateDocCategoryMutation,
  useUpdateDocCategoryMutation,
  useDeleteDocCategoryMutation,
} from '@/redux/services';

const slugify = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function DocCategoriesPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data: categories = [], isLoading, error } = useGetDocCategoriesQuery(undefined, { skip: !authorized });
  const [createCategory, { isLoading: creating }] = useCreateDocCategoryMutation();
  const [updateCategory] = useUpdateDocCategoryMutation();
  const [deleteCategory] = useDeleteDocCategoryMutation();

  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', slug: '', description: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleCreate = async () => {
    const name = form.name.trim();
    if (!name) return;
    await createCategory({ name, slug: form.slug.trim() || slugify(name), description: form.description.trim() }).unwrap().catch(() => {});
    setForm({ name: '', slug: '', description: '' });
  };

  const startEdit = (c) => {
    setEditingId(c._id);
    setEditForm({ name: c.name || '', slug: c.slug || '', description: c.description || '' });
  };
  const saveEdit = async () => {
    await updateCategory({ id: editingId, ...editForm }).unwrap().catch(() => {});
    setEditingId(null);
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader section="Dökümanlar" title="Kategoriler" description="Doküman kategorilerini yönetin" />

      {/* Yeni kategori */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Yeni Kategori</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Ad</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))}
              placeholder="Örn. Başlangıç"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Slug</label>
            <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="baslangic" />
          </div>
          <div className="min-w-[200px] flex-[2]">
            <label className="mb-1 block text-xs text-muted-foreground">Açıklama</label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Opsiyonel" />
          </div>
          <Button onClick={handleCreate} disabled={creating || !form.name.trim()}>
            <Plus className="size-4" />
            Ekle
          </Button>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle>Kategori Listesi</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{categories.length} kategori</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-2">
          {error ? (
            <div className="p-2">
              <Alert variant="destructive">
                <AlertTitle>Kategoriler yüklenemedi</AlertTitle>
                <AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription>
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
                <div key={c._id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
                  {editingId === c._id ? (
                    <>
                      <Input className="max-w-[180px]" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                      <Input className="max-w-[160px] font-mono text-xs" value={editForm.slug} onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))} />
                      <Input className="flex-1" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                      <Button size="sm" variant="ghost" onClick={saveEdit}><Check className="size-4 text-green-600" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="size-4" /></Button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{c.name}</span>
                          <Badge variant="muted" className="font-mono">{c.slug}</Badge>
                        </div>
                        {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
                      </div>
                      {confirmDelete === c._id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-destructive">Emin misiniz?</span>
                          <Button size="sm" variant="destructive" onClick={async () => { await deleteCategory(c._id).unwrap().catch(() => {}); setConfirmDelete(null); }}>Sil</Button>
                          <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>İptal</Button>
                        </div>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Pencil className="size-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(c._id)}><Trash2 className="size-3.5 text-destructive" /></Button>
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
    </RoleGuard>
  );
}
