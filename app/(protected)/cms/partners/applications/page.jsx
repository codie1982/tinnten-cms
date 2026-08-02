'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Search, ExternalLink } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState, SkeletonRows } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetPartnerApplicationsQuery,
  useUpdatePartnerApplicationStatusMutation,
} from '@/redux/services';
import {
  applicationStatusMeta,
  partnerTypeMeta,
  statusFilterOptions,
  partnerTypeFilterOptions,
  statusActionOptions,
  metaOf,
  formatDate,
} from '../_data';

/**
 * Başvuranın bildirdiği kanal.
 *
 * Değer PUBLIC bir formdan geliyor. Backend `normalizeChannel` ile yalnız
 * http/https'e izin veriyor ama savunma tek katmana bırakılmaz: link
 * `rel="noopener noreferrer"` ile açılır ve http/https dışındaki her şey
 * düz metin olarak gösterilir (tıklanabilir yapılmaz).
 */
function ChannelCell({ value }) {
  if (!value) return <span className="text-muted-foreground">—</span>;

  const isSafe = /^https?:\/\//i.test(value);
  if (!isSafe) {
    return <span className="text-xs text-muted-foreground">{value}</span>;
  }

  return (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      {value.replace(/^https?:\/\//i, '').slice(0, 40)}
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

export default function PartnerApplicationsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const [status, setStatus] = useState('');
  const [partnerType, setPartnerType] = useState('');
  const [search, setSearch] = useState('');

  // `skip: !authorized` bilinçli: yetkisiz kullanıcı isteği hiç atmasın,
  // aksi hâlde RoleGuard ekranı gösterirken arkada 403 üretilir.
  const { data, isLoading, isFetching, error } = useGetPartnerApplicationsQuery(
    {
      ...(status ? { status } : {}),
      ...(partnerType ? { partnerType } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      limit: 50,
    },
    { skip: !authorized },
  );

  const [updateStatus, { isLoading: updating }] = useUpdatePartnerApplicationStatusMutation();

  const applications = data?.applications ?? [];
  const hasFilter = Boolean(status || partnerType || search);

  const clearFilters = () => {
    setStatus('');
    setPartnerType('');
    setSearch('');
  };

  const handleStatusChange = async (id, next) => {
    if (!next) return;
    try {
      await updateStatus({ id, status: next, note: '' }).unwrap();
    } catch {
      // Hata RTK Query cache'inde kalır; liste invalidate edilmediği için
      // satır eski durumunda görünmeye devam eder — sessiz yanlış durum yok.
    }
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Partnerler"
        title="Partnerlik Başvuruları"
        description="Public /partner sayfasındaki ön başvuru formundan gelen kayıtlar."
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 w-64 pl-9"
              placeholder="Ad, e-posta veya şirket ara"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tüm durumlar</option>
            {statusFilterOptions.map((key) => (
              <option key={key} value={key}>
                {applicationStatusMeta[key].label}
              </option>
            ))}
          </select>

          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={partnerType}
            onChange={(e) => setPartnerType(e.target.value)}
          >
            <option value="">Tüm partner tipleri</option>
            {partnerTypeFilterOptions.map((key) => (
              <option key={key} value={key}>
                {partnerTypeMeta[key].label}
              </option>
            ))}
          </select>

          {hasFilter ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Filtreleri temizle
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Başvurular</CardTitle>
          <CardToolbar>
            <Badge variant="muted">
              {isFetching ? 'Yükleniyor…' : `${applications.length} kayıt`}
            </Badge>
          </CardToolbar>
        </CardHeader>

        <CardContent className="p-0">
          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Başvurular yüklenemedi</AlertTitle>
                <AlertDescription>
                  {error?.normalizedMessage || 'Beklenmeyen bir hata oluştu.'}
                </AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <SkeletonRows rows={5} cols={7} />
          ) : applications.length === 0 ? (
            <EmptyState
              title="Başvuru yok"
              description={
                hasFilter
                  ? 'Seçili filtrelerle eşleşen başvuru bulunamadı.'
                  : 'Henüz ön başvuru gelmemiş.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Başvuran</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Şirket / Kanal</TableHead>
                    <TableHead>Müşteri hesapları</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => {
                    const id = app._id || app.id;
                    const statusInfo = metaOf(applicationStatusMeta, app.status);
                    const typeInfo = metaOf(partnerTypeMeta, app.partnerType);

                    return (
                      <TableRow key={id} className="hover:bg-muted/40">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{app.fullName}</span>
                            <a
                              href={`mailto:${app.email}`}
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              {app.email}
                            </a>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm">{app.company || '—'}</span>
                            <ChannelCell value={app.channel} />
                          </div>
                        </TableCell>

                        <TableCell>
                          {app.managesClientAccounts ? (
                            <Badge variant="primary">Evet</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(app.createdAt)}
                        </TableCell>

                        <TableCell>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <select
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-60"
                            value={app.status}
                            disabled={updating}
                            onChange={(e) => handleStatusChange(id, e.target.value)}
                          >
                            {statusActionOptions.map((key) => (
                              <option key={key} value={key}>
                                {applicationStatusMeta[key].label}
                              </option>
                            ))}
                          </select>
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

      {applications.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Başvuranın yazdığı tanıtım planı bu listede gösterilmiyor; detay
          görünümü henüz eklenmedi.
        </p>
      ) : null}
    </RoleGuard>
  );
}
