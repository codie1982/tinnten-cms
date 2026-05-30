'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Plus, Search, ChevronLeft, ChevronRight, Loader2, FileText } from 'lucide-react';
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
import { useGetDocsListQuery, useGetDocCategoriesQuery } from '@/redux/services';

const PAGE_SIZE = 20;

function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function DocumentsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [submitted, category]);

  const { data: categories = [] } = useGetDocCategoriesQuery(undefined, { skip: !authorized });
  const { data, isLoading, isFetching, error } = useGetDocsListQuery(
    {
      query: submitted || undefined,
      category: category === 'all' ? undefined : category,
      locale: 'tr',
      page,
      limit: PAGE_SIZE,
    },
    { skip: !authorized },
  );

  const docs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const isEmpty = !isLoading && !error && docs.length === 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Dökümanlar"
        title="Tüm Dökümanlar"
        description="Doküman sayfalarını oluşturun, düzenleyin ve çok dilli yönetin"
        actions={
          <Link href="/cms/documents/new" className={buttonVariants()}>
            <Plus className="size-4" />
            Yeni Döküman
          </Link>
        }
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Başlık veya slug ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSubmitted(search.trim()); }}
              className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </div>
          <Button variant="outline" onClick={() => setSubmitted(search.trim())} disabled={isFetching}>
            <Search className="size-4" />
            Ara
          </Button>
          <div className="w-52">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Doküman Listesi</CardTitle>
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
                <AlertTitle>Dökümanlar yüklenemedi</AlertTitle>
                <AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6" />)}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <FileText className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Döküman bulunamadı</p>
              <p className="text-sm text-muted-foreground">Yeni bir döküman oluşturabilirsiniz.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Başlık</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Güncellenme</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((d) => (
                      <TableRow key={`${d.slug}-${d.locale}`}>
                        <TableCell>
                          <Link href={`/cms/documents/${d.slug}`} className="text-sm font-medium text-foreground hover:text-primary">
                            {d.title}
                          </Link>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">{d.slug}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.category?.name ?? '—'}</TableCell>
                        <TableCell>
                          {d.published ? <Badge variant="success">Yayında</Badge> : <Badge variant="muted">Taslak</Badge>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTrDate(d.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Sayfa <span className="font-medium text-foreground">{page}</span> / {totalPages} · Toplam{' '}
                  <span className="font-medium text-foreground">{total}</span> kayıt
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
                    <ChevronLeft className="size-4" />Önceki
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => Math.min(p + 1, totalPages))}>
                    Sonraki<ChevronRight className="size-4" />
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
