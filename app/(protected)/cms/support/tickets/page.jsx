'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  callbackStatusMeta,
  categoryMeta,
  contactPreferenceMeta,
  formatDate,
  metaOf,
  requesterId,
  requesterLabel,
  statusFilterOptions,
  statusMeta,
  verificationMeta,
} from '../_data';

const PAGE_SIZE = 50;

const firstCallbackWindow = (ticket) => {
  const callback = ticket?.callbackPreference;
  if (!callback) return '—';
  if (callback.confirmedSlot?.startsAt) return formatDate(callback.confirmedSlot.startsAt);
  const first = callback.preferredWindows?.[0];
  return first ? `${first.date} · ${first.slotKey}` : '—';
};

export default function SupportTicketsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.SUPPORT]);
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState(() => ({
    status: '',
    category: '',
    contactPreference: searchParams.get('contactPreference') || '',
    verificationStatus: '',
    requesterType: '',
    callbackStatus: '',
    callbackDate: '',
    assignedTo: '',
    q: '',
  }));

  const params = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => String(value).trim()),
  );
  if (params.assignedTo && !/^[a-f\d]{24}$/i.test(params.assignedTo)) {
    delete params.assignedTo;
  }
  const { data, isLoading, isFetching, error } = useGetSupportTicketsQuery(
    { ...params, limit: PAGE_SIZE },
    { skip: !authorized },
  );

  const tickets = data?.tickets ?? [];
  const hasFilter = Object.values(filters).some(Boolean);
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => setFilters({
    status: '', category: '', contactPreference: '', verificationStatus: '',
    requesterType: '', callbackStatus: '', callbackDate: '', assignedTo: '', q: '',
  });

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.SUPPORT]}>
      <PageHeader
        section="Destek Masası"
        title="Talepler"
        description="E-posta ve telefon tercihlerini aynı talep kuyruğunda yönetin."
      />

      <Card className="mb-5">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(event) => updateFilter('q', event.target.value)}
              placeholder="Talep no, sistem başlığı veya kullanıcı…"
              className="pl-9"
            />
          </div>
          <FilterSelect label="Durum" value={filters.status} onChange={(value) => updateFilter('status', value)}>
            {statusFilterOptions.map((key) => <option key={key} value={key}>{statusMeta[key].label}</option>)}
          </FilterSelect>
          <FilterSelect label="Kategori" value={filters.category} onChange={(value) => updateFilter('category', value)}>
            {Object.entries(categoryMeta).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </FilterSelect>
          <FilterSelect label="İletişim tercihi" value={filters.contactPreference} onChange={(value) => updateFilter('contactPreference', value)}>
            <option value="email">E-posta</option><option value="phone">Telefon</option>
          </FilterSelect>
          <FilterSelect label="Doğrulama" value={filters.verificationStatus} onChange={(value) => updateFilter('verificationStatus', value)}>
            <option value="verified">Doğrulandı</option><option value="unverified">Doğrulanmadı</option>
          </FilterSelect>
          <FilterSelect label="Talep sahibi" value={filters.requesterType} onChange={(value) => updateFilter('requesterType', value)}>
            <option value="user">Hesaplı kullanıcı</option><option value="guest">Misafir kullanıcı</option>
          </FilterSelect>
          <FilterSelect label="Aranma durumu" value={filters.callbackStatus} onChange={(value) => updateFilter('callbackStatus', value)}>
            {Object.entries(callbackStatusMeta).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
          </FilterSelect>
          <Input
            type="date"
            value={filters.callbackDate}
            onChange={(event) => updateFilter('callbackDate', event.target.value)}
            aria-label="Aranma tarihi filtresi"
          />
          <Input
            value={filters.assignedTo}
            onChange={(event) => updateFilter('assignedTo', event.target.value)}
            placeholder="Atanan çalışan ID"
            aria-label="Atanan çalışan filtresi"
          />
          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="justify-self-start">
              <X className="size-4" /> Filtreleri temizle
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Talepler yüklenemedi</AlertTitle>
          <AlertDescription>{error?.data?.message || 'Beklenmeyen bir hata oluştu.'}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tek Talep Kuyruğu</CardTitle>
          <CardToolbar><Badge variant="muted">{isFetching ? 'yükleniyor…' : `${tickets.length} kayıt`}</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><SkeletonRows rows={6} cols={9} /></div>
          ) : tickets.length === 0 ? (
            <EmptyState
              title={hasFilter ? 'Eşleşen talep yok' : 'Henüz talep yok'}
              description={hasFilter ? 'Filtreleri değiştirip tekrar deneyin.' : 'Yeni talepler burada görünür.'}
              action={hasFilter ? <Button variant="outline" size="sm" onClick={clearFilters}>Filtreleri temizle</Button> : null}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Talep / Sistem Başlığı</TableHead>
                    <TableHead>Talep Sahibi</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>İletişim</TableHead>
                    <TableHead>Doğrulama</TableHead>
                    <TableHead>Aranma Zamanı</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Atanan</TableHead>
                    <TableHead>Oluşturulma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => {
                    const id = ticket._id || ticket.id;
                    const ownerId = requesterId(ticket);
                    const status = metaOf(statusMeta, ticket.status);
                    const preference = metaOf(contactPreferenceMeta, ticket.contactPreference);
                    const verification = metaOf(verificationMeta, ticket.verification?.status);
                    return (
                      <TableRow key={id} className="hover:bg-muted/40">
                        <TableCell className="max-w-[300px]">
                          <Link href={`/cms/support/tickets/${id}`} className="block font-medium hover:underline">
                            {ticket.ticketNumber || '—'}
                          </Link>
                          <span className="block truncate text-xs text-muted-foreground" title={ticket.title}>{ticket.title}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <span>{requesterLabel(ticket)}</span>
                            {!ownerId && <Badge variant="outline" className="text-[10px]">Misafir</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate font-mono text-xs" title={ownerId || ''}>{ownerId || '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{categoryMeta[ticket.category] || ticket.category || 'Mevcut değil'}</TableCell>
                        <TableCell><Badge variant={preference.variant}>{preference.label}</Badge></TableCell>
                        <TableCell><Badge variant={verification.variant}>{verification.label}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{firstCallbackWindow(ticket)}</TableCell>
                        <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                        <TableCell className="max-w-[140px] truncate font-mono text-xs">{ticket.assignedTo || 'Atanmadı'}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(ticket.createdAt)}</TableCell>
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

function FilterSelect({ label, value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      aria-label={`${label} filtresi`}
    >
      <option value="">{label}: Tümü</option>
      {children}
    </select>
  );
}
