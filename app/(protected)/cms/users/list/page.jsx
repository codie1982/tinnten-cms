'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Plus, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useGetUsersQuery } from '@/redux/services';
import { statusMeta, roleMeta, statusOptions } from '../_data';

const PAGE_SIZE = 10;

const sortOptions = [
  { value: 'created:desc', label: 'Kayıt Tarihi (Yeni → Eski)' },
  { value: 'created:asc', label: 'Kayıt Tarihi (Eski → Yeni)' },
];

/* ─── tr tarih yardımcısı ─── */
function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/* ─── page ─── */
export default function CmsUsersListPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortValue, setSortValue] = useState('created:desc');
  const [page, setPage] = useState(1);

  // filtre/arama/sıralama değişince ilk sayfaya dön
  useEffect(() => {
    setPage(1);
  }, [submittedSearch, statusFilter, sortValue]);

  const [, order] = sortValue.split(':');

  // Arama backend'de yapılır (Keycloak `search`); buton/Enter ile tetiklenir.
  const applySearch = () => setSubmittedSearch(search.trim());

  // Yetkisiz kullanıcı backend'e hiç istek atmaz; UI'ı RoleGuard zaten engeller.
  const { data, isLoading, isFetching, error } = useGetUsersQuery(
    {
      query: submittedSearch || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      page,
      limit: PAGE_SIZE,
      sort: 'created',
      order,
    },
    { skip: !authorized },
  );

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const isEmpty = !isLoading && !error && users.length === 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Kullanıcılar"
        title="Tüm Kullanıcılar"
        description="CMS kullanıcılarını ve rollerini yönetin"
        actions={
          <Button>
            <Plus className="size-4" />
            Kullanıcı Ekle
          </Button>
        }
      />

      {/* Toolbar */}
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="İsim veya e-posta ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch();
              }}
              className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </div>
          <Button variant="outline" onClick={applySearch} disabled={isFetching}>
            <Search className="size-4" />
            Ara
          </Button>
          <div className="w-44">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <Select value={sortValue} onValueChange={setSortValue}>
              <SelectTrigger>
                <SelectValue placeholder="Sıralama" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Kullanıcı Listesi</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{total} kayıt</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="relative px-0 py-0">
          {/* Arama / sayfalama / sıralama sırasında yükleme göstergesi */}
          {isFetching && !isLoading && !error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Kullanıcılar yüklenemedi</AlertTitle>
                <AlertDescription>
                  {error?.data?.message ||
                    error?.normalizedMessage ||
                    'Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.'}
                </AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div key={i} className="grid grid-cols-4 gap-4">
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Search className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Kullanıcı bulunamadı</p>
              <p className="text-sm text-muted-foreground">
                Filtreleri değiştirerek yeniden deneyin.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setSubmittedSearch('');
                  setStatusFilter('all');
                }}
              >
                Filtreleri sıfırla
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kullanıcı</TableHead>
                      <TableHead>E-posta</TableHead>
                      <TableHead>Roller</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Kayıt Tarihi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const s = statusMeta[u.status];
                      const cmsRoles = (u.roles ?? []).filter((r) =>
                        r.startsWith('cms:'),
                      );
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar name={u.name} size="md" />
                              <div className="min-w-0">
                                <Link
                                  href={`/cms/users/${u.id}`}
                                  className="text-sm font-medium text-foreground hover:text-primary"
                                >
                                  {u.name}
                                </Link>
                                <div
                                  className="max-w-[200px] truncate font-mono text-[11px] text-muted-foreground"
                                  title={u.id}
                                >
                                  {u.id}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {u.email ?? '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {cmsRoles.length > 0 ? (
                                cmsRoles.map((r) => (
                                  <Badge
                                    key={r}
                                    variant={roleMeta[r]?.variant ?? 'muted'}
                                  >
                                    {roleMeta[r]?.label ?? r}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={s?.variant}>{s?.label ?? u.status}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                            {formatTrDate(u.memberSince)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Sayfa <span className="font-medium text-foreground">{page}</span> / {totalPages}
                  {' · '}
                  Toplam <span className="font-medium text-foreground">{total}</span> kayıt
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  >
                    <ChevronLeft className="size-4" />
                    Önceki
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages || isFetching}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  >
                    Sonraki
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
