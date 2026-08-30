'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, Loader2, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetMailTemplatesQuery,
  useCreateMailTemplateMutation,
  useUpdateMailTemplateMutation,
  useDeleteMailTemplateMutation,
} from '@/redux/services';

const statusVariant = (s) => (s === 'active' ? 'success' : s === 'archived' ? 'muted' : 'secondary');
const statusLabel = (s) => (s === 'active' ? 'Aktif' : s === 'archived' ? 'Arşivlendi' : 'Taslak');

const TAB_KEYS = ['active', 'archived'];
const DEFAULT_TAB = 'active';

function CampaignTemplatesPageInner() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: templates = [], isLoading, error } = useGetMailTemplatesQuery({}, { skip: !authorized });
  const [createTemplate, { isLoading: creating }] = useCreateMailTemplateMutation();
  const [updateTemplate] = useUpdateMailTemplateMutation();
  const [deleteTemplate] = useDeleteMailTemplateMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', editorType: 'tiptap' });
  const [notice, setNotice] = useState('');
  // Arşivlenenler ana listeden çıkar, ayrı sekmede görünür.
  // Aktif sekme URL'de tutulur: ?tab=<key>. Geçersiz/eksik → varsayılan (temiz URL).
  const tabParam = searchParams.get('tab');
  const tab = TAB_KEYS.includes(tabParam) ? tabParam : DEFAULT_TAB;
  const setTab = (key) => {
    router.replace(key === DEFAULT_TAB ? pathname : `${pathname}?tab=${key}`, { scroll: false });
  };
  const [busyId, setBusyId] = useState(null);

  const { activeList, archivedList } = useMemo(() => ({
    activeList: templates.filter((t) => t.status !== 'archived'),
    archivedList: templates.filter((t) => t.status === 'archived'),
  }), [templates]);
  const rows = tab === 'archived' ? archivedList : activeList;

  const submit = async () => {
    if (!form.name.trim() || !form.subject.trim()) return;
    const r = await createTemplate({
      name: form.name,
      subject: form.subject,
      bodyHtml: '<p>Merhaba {{USER_NAME}},</p>',
      editorType: form.editorType,
    })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Oluşturulamadı' }));
    if (r?.__err) return setNotice(r.__err);
    if (r?._id) router.push(`/cms/email/campaign-templates/${r._id}`);
  };

  // Aktif/arşiv geçişi — durum PATCH'lenir, kayıt korunur.
  const setStatus = async (tpl, status) => {
    const verb = status === 'archived' ? 'arşivlensin' : 'taslağa alınsın';
    if (!window.confirm(`"${tpl.name}" ${verb} mi?`)) return;
    setNotice('');
    setBusyId(tpl._id);
    try {
      await updateTemplate({ id: tpl._id, status }).unwrap();
    } catch (e) {
      setNotice(e?.data?.message || 'Durum güncellenemedi.');
    } finally {
      setBusyId(null);
    }
  };

  // Kalıcı silme yalnızca taslak/arşiv için — aktif şablon önce arşivlenmeli.
  const remove = async (tpl) => {
    if (!window.confirm(`"${tpl.name}" KALICI olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
    setNotice('');
    setBusyId(tpl._id);
    try {
      await deleteTemplate(tpl._id).unwrap();
    } catch (e) {
      setNotice(e?.data?.message || 'Şablon silinemedi.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Kampanya Şablonları"
        description="DB tabanlı dinamik şablonlar ({{USER_NAME}} merge değişkenleri) — dosya .flt'den ayrı"
        actions={
          <Button onClick={() => setShowCreate((v) => !v)}>
            <Plus className="size-4" /> Yeni Şablon
          </Button>
        }
      />

      {notice && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {showCreate && (
        <Card className="mb-5">
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Şablon adı</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Hoş geldin kampanyası" />
            </div>
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Konu</label>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Merhaba {{USER_NAME}}, yeniliklerimiz var!" />
            </div>
            <div className="w-48">
              <label className="mb-1 block text-xs text-muted-foreground">Editör</label>
              <select
                value={form.editorType}
                onChange={(e) => setForm((f) => ({ ...f, editorType: e.target.value }))}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="tiptap">Basit editör</option>
                <option value="builder">Sürükle-bırak builder</option>
              </select>
            </div>
            <Button onClick={submit} disabled={creating || !form.name.trim() || !form.subject.trim()}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Oluştur &amp; Düzenle
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active">Şablonlar ({activeList.length})</TabsTrigger>
          <TabsTrigger value="archived">Arşiv ({archivedList.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>{tab === 'archived' ? 'Arşivlenmiş Şablonlar' : 'Şablonlar'}</CardTitle>
          <CardToolbar><Badge variant="muted">{rows.length}</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription></Alert></div>
          ) : isLoading ? (
            <div className="space-y-1 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {tab === 'archived' ? 'Arşivde şablon yok.' : 'Henüz şablon yok.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Konu</TableHead>
                  <TableHead>Editör</TableHead>
                  <TableHead>Değişkenler</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t._id}>
                    <TableCell className="font-medium">
                      <Link href={`/cms/email/campaign-templates/${t._id}`} className="text-primary hover:underline">{t.name}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.subject}</TableCell>
                    <TableCell>
                      <Badge variant={t.editorType === 'builder' ? 'primary' : 'secondary'}>
                        {t.editorType === 'builder' ? 'Builder' : 'Basit'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[11px] text-muted-foreground">{(t.variables || []).join(', ') || '—'}</span>
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(t.status)}>{statusLabel(t.status)}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {busyId === t._id && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                        {t.status === 'archived' ? (
                          <Button size="sm" variant="outline" disabled={busyId === t._id} onClick={() => setStatus(t, 'draft')}>
                            <ArchiveRestore className="size-4" /> Geri al
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={busyId === t._id} onClick={() => setStatus(t, 'archived')}>
                            <Archive className="size-4" /> Arşivle
                          </Button>
                        )}
                        {t.status !== 'active' && (
                          <Button size="sm" variant="destructive" disabled={busyId === t._id} onClick={() => remove(t)}>
                            <Trash2 className="size-4" /> Sil
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}

// useSearchParams (App Router) Suspense sınırı gerektirir.
export default function CampaignTemplatesPage() {
  return (
    <Suspense fallback={null}>
      <CampaignTemplatesPageInner />
    </Suspense>
  );
}
