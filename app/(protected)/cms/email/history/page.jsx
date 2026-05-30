'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Search, ChevronLeft, ChevronRight, Loader2, Send, X } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useGetSentMailsQuery, useGetSentMailQuery } from '@/redux/services';

const PAGE_SIZE = 20;

function formatTrDateTime(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function SentMailsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);

  useEffect(() => { setPage(1); }, [submitted, status]);

  const { data, isLoading, isFetching, error } = useGetSentMailsQuery(
    { query: submitted || undefined, status: status === 'all' ? undefined : status, page, limit: PAGE_SIZE },
    { skip: !authorized },
  );
  const { data: detail, isFetching: detailLoading } = useGetSentMailQuery(detailId, { skip: !detailId });

  const mails = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const isEmpty = !isLoading && !error && mails.length === 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader section="Email" title="Giden Mailler" description="Gönderilen tüm e-postalar (maillog)" />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Alıcı, gönderen veya konu ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSubmitted(search.trim()); }}
              className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </div>
          <Button variant="outline" onClick={() => setSubmitted(search.trim())} disabled={isFetching}>
            <Search className="size-4" /> Ara
          </Button>
          <div className="w-40">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="sent">Gönderildi</SelectItem>
                <SelectItem value="failed">Başarısız</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Giden Mailler</CardTitle>
          <CardToolbar><Badge variant="muted">{total} kayıt</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="relative px-0 py-0">
          {isFetching && !isLoading && !error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
          {error ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription></Alert></div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Send className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Gönderilmiş mail yok</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alıcı</TableHead>
                      <TableHead>Konu</TableHead>
                      <TableHead>Tür</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Tarih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mails.map((m) => (
                      <TableRow key={m.id} className="cursor-pointer" onClick={() => setDetailId(m.id)}>
                        <TableCell>
                          <span className="text-sm font-medium text-foreground hover:text-primary">{m.to}</span>
                          <p className="truncate text-[11px] text-muted-foreground">{m.from}</p>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{m.subject}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{m.emailType || '—'}</TableCell>
                        <TableCell>
                          {m.status === 'sent' ? <Badge variant="success">Gönderildi</Badge> : <Badge variant="destructive">Başarısız</Badge>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTrDateTime(m.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">Sayfa <span className="font-medium text-foreground">{page}</span> / {totalPages} · Toplam <span className="font-medium text-foreground">{total}</span></p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(p - 1, 1))}><ChevronLeft className="size-4" />Önceki</Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => Math.min(p + 1, totalPages))}>Sonraki<ChevronRight className="size-4" /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detay modalı */}
      {detailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={() => setDetailId(null)}>
          <Card className="flex max-h-[85vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Mail Detayı</CardTitle>
              <CardToolbar>
                <Button variant="ghost" size="icon" onClick={() => setDetailId(null)}><X className="size-4" /></Button>
              </CardToolbar>
            </CardHeader>
            <CardContent className="space-y-3 overflow-y-auto p-5">
              {detailLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : detail ? (
                <>
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div><span className="text-muted-foreground">Gönderen: </span>{detail.from}</div>
                    <div><span className="text-muted-foreground">Alıcı: </span>{detail.to}</div>
                    <div className="sm:col-span-2"><span className="text-muted-foreground">Konu: </span>{detail.subject}</div>
                    <div><span className="text-muted-foreground">Tür: </span>{detail.emailType || '—'}</div>
                    <div><span className="text-muted-foreground">Durum: </span>{detail.status}</div>
                  </div>
                  {detail.error && <Alert variant="destructive"><AlertDescription>{detail.error}</AlertDescription></Alert>}
                  <div className="rounded-lg border border-border">
                    <iframe title="mail" srcDoc={detail.text || ''} className="h-80 w-full rounded-lg bg-white" sandbox="" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Detay bulunamadı.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
