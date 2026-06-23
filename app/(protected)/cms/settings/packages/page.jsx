'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Package, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetCmsPackagesQuery,
  useUpdatePackageMutation,
  useDeletePackageMutation,
} from '@/redux/services';

const statusMeta = {
  active: { label: 'Yayında', variant: 'success' },
  inactive: { label: 'Pasif', variant: 'muted' },
  archived: { label: 'Arşivli', variant: 'muted' },
};
const visibilityMeta = {
  public: { label: 'Genel', variant: 'muted' },
  private: { label: 'Firmaya Özel', variant: 'warning' },
};
const intervalLabel = { month: 'Aylık', year: 'Yıllık', lifetime: 'Ömür Boyu' };

function pkgTitle(p) {
  const i = p.i18n || {};
  return i.tr?.title || i.en?.title || Object.values(i)[0]?.title || p.name;
}
function pricingSummary(p) {
  const arr = Array.isArray(p.pricing) ? p.pricing : [];
  if (!arr.length) return '—';
  return arr
    .map((pr) => `${intervalLabel[pr.interval] || pr.interval}: ${pr.amount} ${pr.currency || ''}`.trim())
    .join(' · ');
}

export default function SettingsPackagesPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const [forCompany, setForCompany] = useState('all');
  const [status, setStatus] = useState('all');
  const [visibility, setVisibility] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: packages = [], isLoading, error } = useGetCmsPackagesQuery(
    {
      forCompany: forCompany === 'all' ? undefined : forCompany,
      status: status === 'all' ? undefined : status,
      visibility: visibility === 'all' ? undefined : visibility,
    },
    { skip: !authorized },
  );
  const [updatePackage] = useUpdatePackageMutation();
  const [deletePackage] = useDeletePackageMutation();
  const isEmpty = !isLoading && !error && packages.length === 0;

  const togglePublish = (p) => {
    const next = p.status === 'active' ? 'inactive' : 'active';
    updatePackage({ id: p._id, status: next }).unwrap().catch(() => {});
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Sistem Ayarları"
        title="Paketler"
        description="Sistem paketlerini yönetin: fiyatlandırma, çok dilli içerik, yayın durumu"
        actions={
          <Link href="/cms/settings/packages/new" className={buttonVariants()}>
            <Plus className="size-4" /> Yeni Paket
          </Link>
        }
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="w-48">
            <Select value={forCompany} onValueChange={setForCompany}>
              <SelectTrigger><SelectValue placeholder="Hedef" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Hedefler</SelectItem>
                <SelectItem value="false">Kullanıcı Paketleri</SelectItem>
                <SelectItem value="true">Business Paketleri</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="active">Yayında</SelectItem>
                <SelectItem value="inactive">Pasif</SelectItem>
                <SelectItem value="archived">Arşivli</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger><SelectValue placeholder="Görünürlük" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Görünürlükler</SelectItem>
                <SelectItem value="public">Genel</SelectItem>
                <SelectItem value="private">Firmaya Özel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paket Listesi</CardTitle>
          <CardToolbar><Badge variant="muted">{packages.length} paket</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Paketler yüklenemedi</AlertTitle>
                <AlertDescription>{error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}</AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Package className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Paket yok</p>
              <p className="text-sm text-muted-foreground">Yeni bir paket oluşturabilirsiniz.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paket</TableHead>
                    <TableHead>Hedef</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Fiyatlandırma</TableHead>
                    <TableHead>Görünürlük</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((p) => {
                    const s = statusMeta[p.status] ?? { label: p.status, variant: 'muted' };
                    const vis = visibilityMeta[p.visibility] ?? visibilityMeta.public;
                    return (
                      <TableRow key={p._id}>
                        <TableCell>
                          <Link href={`/cms/settings/packages/${p._id}`} className="text-sm font-medium text-foreground hover:text-primary">
                            {pkgTitle(p)}
                          </Link>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">{p.name}</p>
                        </TableCell>
                        <TableCell><Badge variant="muted">{p.forCompany ? 'Business' : 'Kullanıcı'}</Badge></TableCell>
                        <TableCell className="text-sm capitalize text-muted-foreground">{p.category ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{pricingSummary(p)}</TableCell>
                        <TableCell><Badge variant={vis.variant}>{vis.label}</Badge></TableCell>
                        <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Link href={`/cms/settings/packages/${p._id}`} className={buttonVariants({ variant: 'ghost', size: 'icon' }) + ' size-7'}>
                              <Pencil className="size-3.5" />
                            </Link>
                            <Button variant="ghost" size="icon" className="size-7" title={p.status === 'active' ? 'Yayından kaldır' : 'Yayınla'} onClick={() => togglePublish(p)}>
                              {p.status === 'active' ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </Button>
                            {confirmDelete === p._id ? (
                              <>
                                <Button size="sm" variant="destructive" onClick={async () => { await deletePackage(p._id).unwrap().catch(() => {}); setConfirmDelete(null); }}>Sil</Button>
                                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>İptal</Button>
                              </>
                            ) : (
                              <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => setConfirmDelete(p._id)}>
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
    </RoleGuard>
  );
}
