'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, ChevronRight, Loader2, Search, Package } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import {
  Card, CardContent, CardHeader, CardTitle, CardToolbar,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useGetCmsProductsQuery } from '@/redux/services';
import {
  typeMeta, statusMeta, pricetypeMeta,
  typeOptions, statusOptions, sortOptions, formatPrice,
} from '../_data';

const PAGE_SIZE = 10;

function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function CmsProductsListPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(1);

  // Filtre/arama/sıralama değişince ilk sayfaya dön
  useEffect(() => {
    setPage(1);
  }, [submittedSearch, typeFilter, statusFilter, sort]);

  const applySearch = () => setSubmittedSearch(search.trim());
  const [sortField, sortOrder] = sort.split(':');

  const { data, isLoading, isFetching, error } = useGetCmsProductsQuery(
    {
      query: submittedSearch || undefined,
      type: typeFilter === 'all' ? undefined : typeFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      sort: sortField,
      order: sortOrder,
      page,
      limit: PAGE_SIZE,
    },
    { skip: !authorized },
  );

  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const isEmpty = !isLoading && !error && products.length === 0;

  const resetFilters = () => {
    setSearch('');
    setSubmittedSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setSort('createdAt:desc');
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Partnerler"
        title="Ürünler & Hizmetler"
        description="Firmaların eklediği ürün ve hizmetleri görüntüleyin"
      />

      {/* Toolbar */}
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Ürün adı veya SKU ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
              className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </div>
          <Button variant="outline" onClick={applySearch} disabled={isFetching}>
            <Search className="size-4" />
            Ara
          </Button>
          <div className="w-40">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Tür" /></SelectTrigger>
              <SelectContent>
                {typeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger><SelectValue placeholder="Sırala" /></SelectTrigger>
              <SelectContent>
                {sortOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ürün / Hizmet Listesi</CardTitle>
          <CardToolbar><Badge variant="muted">{total} kayıt</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="relative px-0 py-0">
          {isFetching && !isLoading && !error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Ürünler yüklenemedi</AlertTitle>
                <AlertDescription>
                  {error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}
                </AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div key={i} className="grid grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((__, j) => <Skeleton key={j} className="h-5" />)}
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Package className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Ürün bulunamadı</p>
              <p className="text-sm text-muted-foreground">Filtreleri değiştirerek yeniden deneyin.</p>
              <Button size="sm" variant="outline" onClick={resetFilters}>Filtreleri sıfırla</Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ürün / Hizmet</TableHead>
                      <TableHead>Tür</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Fiyat</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Oluşturulma</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => {
                      const t = typeMeta[p.type];
                      const s = statusMeta[p.status];
                      const pt = pricetypeMeta[p.pricetype];
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar name={p.title} src={p.coverImage || undefined} size="md" />
                              <div className="min-w-0">
                                <Link
                                  href={`/cms/products/${p.id}`}
                                  className="text-sm font-medium text-foreground hover:text-primary"
                                >
                                  {p.title}
                                </Link>
                                <p className="truncate font-mono text-xs text-muted-foreground">{p.sku}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {t ? <Badge variant={t.variant}>{t.label}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={s?.variant}>{s?.label ?? p.status}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="text-sm font-medium text-foreground">{formatPrice(p.priceAmount, p.currency)}</span>
                            {pt && <p className="text-xs text-muted-foreground">{pt.label}</p>}
                          </TableCell>
                          <TableCell>
                            {p.company ? (
                              <Link
                                href={`/cms/companies/${p.company.id}`}
                                className="text-sm text-foreground hover:text-primary"
                              >
                                {p.company.companyName || p.company.slug || '—'}
                              </Link>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                            {formatTrDate(p.createdAt)}
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
                  {' · '}Toplam <span className="font-medium text-foreground">{total}</span> kayıt
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
                    <ChevronLeft className="size-4" />
                    Önceki
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => Math.min(p + 1, totalPages))}>
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
