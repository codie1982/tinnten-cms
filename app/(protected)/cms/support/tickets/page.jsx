'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Search, X } from 'lucide-react';
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
import { useGetSupportTicketsQuery } from '@/redux/services';
import {
  formatDate,
  metaOf,
  priorityFilterOptions,
  priorityMeta,
  requesterLabel,
  statusFilterOptions,
  statusMeta,
} from '../_data';

const PAGE_SIZE = 25;

export default function SupportTicketsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.SUPPORT]);

  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [query, setQuery] = useState('');

  const { data, isLoading, isFetching, error } = useGetSupportTicketsQuery(
    {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(query.trim() ? { q: query.trim() } : {}),
      limit: PAGE_SIZE,
    },
    // Yetkisizken istek HİÇ atılmaz — gereksiz 403 üretmez.
    { skip: !authorized },
  );

  const tickets = data?.tickets ?? [];
  const hasFilter = Boolean(status || priority || query);

  const clearFilters = () => {
    setStatus('');
    setPriority('');
    setQuery('');
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.SUPPORT]}>
      <PageHeader
        section="Destek Masası"
        title="Talepler"
        description="Müşteri destek taleplerini görüntüleyin, yanıtlayın ve yönetin."
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Talep no, konu veya e-posta…"
              className="pl-9"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Durum filtresi"
          >
            <option value="">Tüm durumlar</option>
            {statusFilterOptions.map((key) => (
              <option key={key} value={key}>
                {statusMeta[key].label}
              </option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Öncelik filtresi"
          >
            <option value="">Tüm öncelikler</option>
            {priorityFilterOptions.map((key) => (
              <option key={key} value={key}>
                {priorityMeta[key].label}
              </option>
            ))}
          </select>

          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" />
              Temizle
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Talepler yüklenemedi</AlertTitle>
          <AlertDescription>
            {error?.data?.message || 'Beklenmeyen bir hata oluştu. Sayfayı yenileyip tekrar deneyin.'}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Talep Kuyruğu</CardTitle>
          <CardToolbar>
            <Badge variant="muted">
              {isFetching ? 'yükleniyor…' : `${tickets.length} kayıt`}
            </Badge>
          </CardToolbar>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <SkeletonRows rows={6} cols={6} />
            </div>
          ) : tickets.length === 0 ? (
            <EmptyState
              title={hasFilter ? 'Eşleşen talep yok' : 'Henüz talep yok'}
              description={
                hasFilter
                  ? 'Filtreleri değiştirip tekrar deneyin.'
                  : 'Müşteriler destek talebi oluşturduğunda burada görünür.'
              }
              action={
                hasFilter ? (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Filtreleri temizle
                  </Button>
                ) : null
              }
            />
          ) : (
            // Mobil öncelikli değil (operasyon ekranı) ama tablo taşmamalı.
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Talep No</TableHead>
                    <TableHead>Konu</TableHead>
                    <TableHead>Talep Eden</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Öncelik</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Son İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => {
                    const id = ticket._id || ticket.id;
                    const st = metaOf(statusMeta, ticket.status);
                    const pr = metaOf(priorityMeta, ticket.priority);

                    return (
                      <TableRow key={id} className="hover:bg-muted/40">
                        <TableCell className="font-mono text-xs">
                          <Link href={`/cms/support/tickets/${id}`} className="hover:underline">
                            {ticket.ticketNumber || '—'}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <Link
                            href={`/cms/support/tickets/${id}`}
                            className="block truncate font-medium hover:underline"
                            title={ticket.title}
                          >
                            {ticket.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{requesterLabel(ticket)}</span>
                            {/* Anonim talepler `userId` taşımaz — rozet, ajanın
                                doğrulanmamış bir kimlikle konuştuğunu gösterir. */}
                            {ticket.isAnonymous && (
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                Anonim
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ticket.category || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={pr.variant}>{pr.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(ticket.lastActivityAt || ticket.updatedAt)}
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
