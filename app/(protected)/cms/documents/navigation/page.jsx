'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowDown, ArrowUp, Check, FileText, FolderTree, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CONTENT_LOCALES } from '@/config/api';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useCreateDocCategoryMutation,
  useDeleteDocCategoryMutation,
  useGetDocNavigationQuery,
  useSaveDocNavigationMutation,
  useUpdateDocCategoryMutation,
} from '@/redux/services';

const slugify = (value) => String(value || '').toLocaleLowerCase('tr-TR')
  .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
  .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const errorText = (error) => error?.data?.message || error?.normalizedMessage || error?.message || 'İşlem tamamlanamadı.';
const cloneGroups = (items = []) => items.map((group) => ({ ...group, pages: [...(group.pages || [])] }));

export default function DocsNavigationPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const [locale, setLocale] = useState('tr');
  const { data, isLoading, isFetching, error } = useGetDocNavigationQuery(locale, { skip: !authorized });
  const [createCategory, { isLoading: creating }] = useCreateDocCategoryMutation();
  const [updateCategory] = useUpdateDocCategoryMutation();
  const [deleteCategory] = useDeleteDocCategoryMutation();
  const [saveNavigation, { isLoading: saving }] = useSaveDocNavigationMutation();
  const [groups, setGroups] = useState([]);
  const [uncategorized, setUncategorized] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', slug: '', description: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const navigationPayload = () => ({
    locale,
    categories: groups.map((group) => ({ id: group._id, pageIds: group.pages.map((page) => page.pageId) })),
    uncategorized: uncategorized.map((page) => page.pageId),
  });

  const flushNavigation = async () => {
    if (!dirty) return;
    await saveNavigation(navigationPayload()).unwrap();
    setDirty(false);
  };

  useEffect(() => {
    if (!data) return;
    setGroups(cloneGroups(data.groups));
    setUncategorized([...(data.uncategorized || [])]);
    setDirty(false);
  }, [data]);

  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const pageBucket = (key) => key === 'uncategorized' ? uncategorized : groups.find((group) => group._id === key)?.pages || [];
  const setPageBucket = (key, pages) => {
    if (key === 'uncategorized') setUncategorized(pages);
    else setGroups((current) => current.map((group) => group._id === key ? { ...group, pages } : group));
    setDirty(true);
  };

  const moveCategory = (index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= groups.length) return;
    setGroups((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
    setDirty(true);
  };

  const movePage = (bucket, index, offset) => {
    const pages = [...pageBucket(bucket)];
    const target = index + offset;
    if (target < 0 || target >= pages.length) return;
    [pages[index], pages[target]] = [pages[target], pages[index]];
    setPageBucket(bucket, pages);
  };

  const movePageTo = (pageId, from, to) => {
    if (from === to) return;
    const source = [...pageBucket(from)];
    const index = source.findIndex((page) => page.pageId === pageId);
    if (index < 0) return;
    const [page] = source.splice(index, 1);
    const destination = [...pageBucket(to), page];
    if (from === 'uncategorized') setUncategorized(source);
    else setGroups((current) => current.map((group) => group._id === from ? { ...group, pages: source } : group));
    if (to === 'uncategorized') setUncategorized(destination);
    else setGroups((current) => current.map((group) => group._id === to ? { ...group, pages: destination } : group));
    setDirty(true);
  };

  const handleCreate = async () => {
    const name = form.name.trim();
    if (!name) return;
    setNotice(null);
    try {
      await flushNavigation();
      await createCategory({ name, slug: form.slug.trim() || slugify(name), description: form.description.trim(), locale }).unwrap();
      setForm({ name: '', slug: '', description: '' });
      setNotice({ type: 'success', text: 'Navigasyon grubu oluşturuldu.' });
    } catch (createError) { setNotice({ type: 'error', text: errorText(createError) }); }
  };

  const startEdit = (category) => {
    setEditingId(category._id);
    setEditForm({ name: category.name || '', slug: category.slug || '', description: category.description || '' });
  };

  const saveEdit = async () => {
    setNotice(null);
    try {
      await flushNavigation();
      await updateCategory({ id: editingId, ...editForm, locale }).unwrap();
      setEditingId(null);
      setNotice({ type: 'success', text: `${locale.toUpperCase()} grup etiketi güncellendi.` });
    } catch (updateError) { setNotice({ type: 'error', text: errorText(updateError) }); }
  };

  const persistNavigation = async () => {
    setNotice(null);
    try {
      await flushNavigation();
      setNotice({ type: 'success', text: 'Doküman navigasyonu kaydedildi.' });
    } catch (saveError) { setNotice({ type: 'error', text: errorText(saveError) }); }
  };

  const switchLocale = (value) => {
    if (dirty && !window.confirm('Kaydedilmemiş navigasyon değişiklikleri silinsin mi?')) return;
    setLocale(value);
    setNotice(null);
  };

  return <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
    <PageHeader section="Dokümanlar" title="Doküman Navigasyonu" description="Sol doküman menüsündeki grupları ve sayfa sırasını yönetin" actions={<Button onClick={persistNavigation} disabled={!dirty || saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Navigasyonu Kaydet</Button>} />
    {notice && <Alert variant={notice.type === 'error' ? 'destructive' : 'info'} className="mb-5"><AlertTitle>{notice.type === 'error' ? 'İşlem başarısız' : 'Tamamlandı'}</AlertTitle><AlertDescription>{notice.text}</AlertDescription></Alert>}

    <Card className="mb-5"><CardContent className="flex flex-wrap items-center gap-3 p-4"><FolderTree className="size-5 text-primary" /><div className="min-w-52 flex-1"><p className="text-sm font-medium">Tek doküman navigasyonu</p><p className="text-xs text-muted-foreground">Grup ve sayfa sırası tüm dillerde ortaktır. Grup adı seçilen dile göre düzenlenir; public menüde yalnız yayınlanmış sayfalar görünür.</p></div><Select value={locale} onValueChange={switchLocale}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{CONTENT_LOCALES.map((item) => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}</SelectContent></Select></CardContent></Card>

    <Card className="mb-5"><CardHeader><CardTitle>Yeni Navigasyon Grubu</CardTitle></CardHeader><CardContent className="flex flex-wrap items-end gap-3 p-4"><div className="min-w-48 flex-1"><label className="mb-1 block text-xs text-muted-foreground">Grup adı · {locale.toUpperCase()}</label><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, slug: current.slug || slugify(event.target.value) }))} placeholder="Örn. Başlangıç" /></div><div className="min-w-40 flex-1"><label className="mb-1 block text-xs text-muted-foreground">Sistem slug’ı</label><Input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: slugify(event.target.value) }))} placeholder="baslangic" /></div><div className="min-w-52 flex-[2]"><label className="mb-1 block text-xs text-muted-foreground">Açıklama</label><Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Yalnız CMS açıklaması" /></div><Button onClick={handleCreate} disabled={creating || !form.name.trim()}>{creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Grup Ekle</Button></CardContent></Card>

    {error ? <Alert variant="destructive"><AlertTitle>Navigasyon yüklenemedi</AlertTitle><AlertDescription>{errorText(error)}</AlertDescription></Alert> : isLoading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40" />)}</div> : <div className="relative space-y-4">
      {isFetching && <div className="absolute inset-0 z-20 grid place-items-center rounded-xl bg-background/60"><Loader2 className="size-6 animate-spin" /></div>}
      {groups.map((group, groupIndex) => <NavigationGroup key={group._id} group={group} locale={locale} index={groupIndex} count={groups.length} allGroups={groups} editing={editingId === group._id} editForm={editForm} setEditForm={setEditForm} onStartEdit={() => startEdit(group)} onCancelEdit={() => setEditingId(null)} onSaveEdit={saveEdit} onMoveGroup={moveCategory} onMovePage={movePage} onMovePageTo={movePageTo} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} onDelete={async () => { try { await flushNavigation(); await deleteCategory(group._id).unwrap(); setConfirmDelete(null); setNotice({ type: 'success', text: 'Grup silindi; sayfalar Diğer alanına taşındı.' }); } catch (deleteError) { setNotice({ type: 'error', text: errorText(deleteError) }); } }} />)}
      <NavigationGroup group={{ _id: 'uncategorized', name: 'Diğer / Kategorisiz', pages: uncategorized }} locale={locale} index={0} count={1} allGroups={groups} onMovePage={movePage} onMovePageTo={movePageTo} />
    </div>}
  </RoleGuard>;
}

function NavigationGroup({ group, locale, index, count, allGroups, editing, editForm, setEditForm, onStartEdit, onCancelEdit, onSaveEdit, onMoveGroup, onMovePage, onMovePageTo, confirmDelete, setConfirmDelete, onDelete }) {
  const fixed = group._id === 'uncategorized';
  return <Card><CardHeader className="gap-3">
    {editing ? <div className="grid flex-1 gap-2 md:grid-cols-[1fr_180px_1.5fr]"><Input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} /><Input value={editForm.slug} onChange={(event) => setEditForm((current) => ({ ...current, slug: slugify(event.target.value) }))} className="font-mono text-xs" /><Input value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} /></div> : <div className="min-w-0 flex-1"><CardTitle className="flex items-center gap-2">{group.name}<Badge variant="muted">{group.pages.length} sayfa</Badge>{!fixed && !group.translated && <Badge variant="outline">Fallback etiket</Badge>}</CardTitle>{group.description && <p className="mt-1 truncate text-xs text-muted-foreground">{group.description}</p>}</div>}
    <CardToolbar className="flex-wrap">{editing ? <><Button size="sm" variant="ghost" onClick={onSaveEdit}><Check className="size-4 text-green-600" /></Button><Button size="sm" variant="ghost" onClick={onCancelEdit}><X className="size-4" /></Button></> : !fixed && <><Button size="sm" variant="ghost" disabled={index === 0} onClick={() => onMoveGroup(index, -1)} title="Grubu yukarı taşı"><ArrowUp className="size-4" /></Button><Button size="sm" variant="ghost" disabled={index === count - 1} onClick={() => onMoveGroup(index, 1)} title="Grubu aşağı taşı"><ArrowDown className="size-4" /></Button><Button size="sm" variant="ghost" onClick={onStartEdit} title={`${locale.toUpperCase()} etiketini düzenle`}><Pencil className="size-4" /></Button>{confirmDelete === group._id ? <><Button size="sm" variant="destructive" onClick={onDelete}>Sil</Button><Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>İptal</Button></> : <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(group._id)}><Trash2 className="size-4 text-destructive" /></Button>}</>}</CardToolbar>
  </CardHeader><CardContent className="space-y-1 p-3 pt-0">{group.pages.length ? group.pages.map((page, pageIndex) => <div key={page.pageId} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-2"><FileText className="size-4 text-muted-foreground" /><div className="min-w-44 flex-1"><Link href={`/cms/documents/${page.pageId}`} className="text-sm font-medium hover:text-primary">{page.title}</Link><p className="truncate font-mono text-[11px] text-muted-foreground">{page.fullPath}</p></div><Badge variant={page.localeStatus === 'published' ? 'success' : page.localeStatus === 'draft' ? 'muted' : 'outline'}>{page.localeStatus === 'published' ? 'Yayında' : page.localeStatus === 'draft' ? 'Taslak' : `${locale.toUpperCase()} eksik`}</Badge><Button size="sm" variant="ghost" disabled={pageIndex === 0} onClick={() => onMovePage(group._id, pageIndex, -1)}><ArrowUp className="size-3.5" /></Button><Button size="sm" variant="ghost" disabled={pageIndex === group.pages.length - 1} onClick={() => onMovePage(group._id, pageIndex, 1)}><ArrowDown className="size-3.5" /></Button><select aria-label={`${page.title} grubunu değiştir`} value={group._id} onChange={(event) => onMovePageTo(page.pageId, group._id, event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs"><option value="uncategorized">Diğer / Kategorisiz</option>{allGroups.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></div>) : <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Bu grupta sayfa yok.</p>}</CardContent></Card>;
}
