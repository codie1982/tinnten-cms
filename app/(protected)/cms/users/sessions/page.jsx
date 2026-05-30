'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { MonitorSmartphone, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
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
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useGetAllSessionsQuery } from '@/redux/services';

const PAGE_SIZE = 20;

function formatTrDateTime(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} · ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function CmsSessionsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, error } = useGetAllSessionsQuery(
    { page, limit: PAGE_SIZE },
    { skip: !authorized },
  );

  const sessions = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const isEmpty = !isLoading && !error && sessions.length === 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Kullanıcılar"
        title="Oturumlar & Güvenlik"
        description="Tüm kullanıcı oturumları, en yeniden eskiye doğru listelenir"
      />

      <Card>
        <CardHeader>
          <CardTitle>Oturumlar</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{total} oturum</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="relative px-0 py-0">
          {/* Sayfalama sırasında yükleme göstergesi */}
          {isFetching && !isLoading && !error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}

          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Oturumlar yüklenemedi</AlertTitle>
                <AlertDescription>
                  {error?.data?.message ||
                    error?.normalizedMessage ||
                    'Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.'}
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
              <MonitorSmartphone className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Oturum kaydı yok</p>
              <p className="text-sm text-muted-foreground">Henüz kayıtlı bir oturum bulunmuyor.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kullanıcı</TableHead>
                      <TableHead>Cihaz</TableHead>
                      <TableHead>IP Adresi</TableHead>
                      <TableHead>Konum</TableHead>
                      <TableHead>Son Görülme</TableHead>
                      <TableHead>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar name={s.userName} size="sm" />
                            <div className="min-w-0">
                              {s.userKeyId ? (
                                <Link
                                  href={`/cms/users/${s.userKeyId}`}
                                  className="text-sm font-medium text-foreground hover:text-primary"
                                >
                                  {s.userName}
                                </Link>
                              ) : (
                                <span className="text-sm font-medium text-foreground">
                                  {s.userName}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MonitorSmartphone className="size-4 shrink-0 text-muted-foreground" />
                            <span className="text-sm">{s.device}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {s.ip}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.location}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {formatTrDateTime(s.time)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {s.blocked && <Badge variant="destructive">Engelli</Badge>}
                            {s.trusted && <Badge variant="success">Güvenilir</Badge>}
                            {!s.blocked && !s.trusted && (
                              <Badge variant="muted">Normal</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Sayfa <span className="font-medium text-foreground">{page}</span> / {totalPages}
                  {' · '}
                  Toplam <span className="font-medium text-foreground">{total}</span> oturum
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
