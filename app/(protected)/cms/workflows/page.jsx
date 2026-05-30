'use client';

import { useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useGetWorkflowsQuery } from '@/redux/services';

const PAGE_SIZE = 20;

const statusMeta = {
  draft: { label: 'Taslak', variant: 'muted' },
  active: { label: 'Aktif', variant: 'success' },
  inactive: { label: 'Pasif', variant: 'warning' },
};

function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function WorkflowsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ACCESS]);

  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [submittedSearch]);

  const applySearch = () => setSubmittedSearch(search.trim());

  const { data, isLoading, isFetching, error } = useGetWorkflowsQuery(
    { query: submittedSearch || undefined, page, limit: PAGE_SIZE },
    { skip: !authorized },
  );

  const workflows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const isEmpty = !isLoading && !error && workflows.length === 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ACCESS]}>
      <PageHeader
        section="Yapay Zeka"
        title="İş Akışları"
        description="Otomasyon ve asistan iş akışlarını görüntüleyin ve yönetin"
        actions={
          <Button>
            <Plus className="size-4" />
            Yeni İş Akışı
          </Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="İş akışı adı veya slug ile ara..."
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>İş Akışı Listesi</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{total} kayıt</Badge>
          </CardToolbar>
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
                <AlertTitle>İş akışları yüklenemedi</AlertTitle>
                <AlertDescription>
                  {error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}
                </AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Search className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">İş akışı bulunamadı</p>
              <p className="text-sm text-muted-foreground">Kayıtlı iş akışı bulunmuyor.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>İş Akışı</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Yayın Tarihi</TableHead>
                      <TableHead>Güncellenme</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workflows.map((w) => {
                      const s = statusMeta[w.status] ?? { label: w.status, variant: 'muted' };
                      return (
                        <TableRow key={w.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{w.name}</p>
                              <p className="truncate font-mono text-[11px] text-muted-foreground" title={w.id}>
                                {w.id}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {w.slug ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={s.variant}>{s.label}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                            {w.publishedAt ? formatTrDate(w.publishedAt) : '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                            {formatTrDate(w.updatedAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Sayfa <span className="font-medium text-foreground">{page}</span> / {totalPages}
                  {' · '}
                  Toplam <span className="font-medium text-foreground">{total}</span> iş akışı
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
