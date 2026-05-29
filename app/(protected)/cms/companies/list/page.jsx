'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Filter, Plus, Search } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { CMS_ROLES } from '@/lib/roles';

/* ─── meta ─── */
const statusOptions = [
  { value: 'all', label: 'Tüm Durumlar' },
  { value: 'approved', label: 'Onaylı' },
  { value: 'pending', label: 'Beklemede' },
  { value: 'suspended', label: 'Askıda' },
  { value: 'blocked', label: 'Engelli' },
];
const typeOptions = [
  { value: 'all', label: 'Firma Tipi' },
  { value: 'service', label: 'Hizmet' },
  { value: 'product', label: 'Ürün Satıcısı' },
  { value: 'both', label: 'Her İkisi' },
];
const membershipOptions = [
  { value: 'all', label: 'Üyelik' },
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

const typeMeta = {
  service: { label: 'Hizmet', variant: 'secondary' },
  product: { label: 'Ürün Satıcısı', variant: 'primary' },
  both: { label: 'Her İkisi', variant: 'warning' },
};
const statusMeta = {
  approved: { label: 'Onaylı', variant: 'success' },
  pending: { label: 'Beklemede', variant: 'warning' },
  suspended: { label: 'Askıda', variant: 'muted' },
  blocked: { label: 'Engelli', variant: 'destructive' },
};
const membershipMeta = {
  free: { label: 'Free', variant: 'muted' },
  pro: { label: 'Pro', variant: 'primary' },
  enterprise: { label: 'Enterprise', variant: 'secondary' },
};

/* ─── mock ─── */
const companiesMock = [
  { id: 'COMP-1023', name: 'ABC Temizlik Hizmetleri', type: 'service', owner: 'Mehmet Kılıç', email: 'info@abctemizlik.com', status: 'approved', membership: 'pro', createdAt: '12.03.2025' },
  { id: 'COMP-1042', name: 'Yılmaz Teknoloji Ltd.', type: 'product', owner: 'Selin Yılmaz', email: 'destek@yilmaztech.com', status: 'pending', membership: 'free', createdAt: '22.03.2025' },
  { id: 'COMP-1050', name: 'Nova Enerji ve Teknoloji', type: 'both', owner: 'Cemre Danış', email: 'contact@novaenergy.io', status: 'approved', membership: 'enterprise', createdAt: '05.02.2025' },
  { id: 'COMP-0891', name: 'Perla Yapı & İnşaat', type: 'service', owner: 'İlker Parlak', email: 'iletisim@perlayapi.com', status: 'suspended', membership: 'pro', createdAt: '19.01.2025' },
  { id: 'COMP-0755', name: 'Mavera Temizlik', type: 'service', owner: 'Deniz Ak', email: 'info@mavera.com', status: 'pending', membership: 'free', createdAt: '08.01.2025' },
  { id: 'COMP-0612', name: 'Atlas Bilişim', type: 'product', owner: 'Kaan Arslan', email: 'kaan@atlasbilisim.io', status: 'blocked', membership: 'pro', createdAt: '14.12.2024' },
];

/* ─── page ─── */
export default function CmsCompaniesListPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [membershipFilter, setMembershipFilter] = useState('all');
  const [showSecondary, setShowSecondary] = useState(false);
  const [secondary, setSecondary] = useState({ name: '', status: 'all', type: 'all', membership: 'all' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, [search, statusFilter, typeFilter, membershipFilter, secondary]);

  const filtered = useMemo(() => {
    return companiesMock
      .filter((c) => (statusFilter === 'all' ? true : c.status === statusFilter))
      .filter((c) => (typeFilter === 'all' ? true : c.type === typeFilter))
      .filter((c) => (membershipFilter === 'all' ? true : c.membership === membershipFilter))
      .filter((c) => (secondary.status === 'all' ? true : c.status === secondary.status))
      .filter((c) => (secondary.type === 'all' ? true : c.type === secondary.type))
      .filter((c) => (secondary.membership === 'all' ? true : c.membership === secondary.membership))
      .filter((c) =>
        secondary.name ? c.name.toLowerCase().includes(secondary.name.toLowerCase()) : true,
      )
      .filter((c) =>
        search
          ? [c.name, c.email, c.id].some((f) => f.toLowerCase().includes(search.toLowerCase()))
          : true,
      );
  }, [search, statusFilter, typeFilter, membershipFilter, secondary]);

  const isEmpty = !isLoading && !error && filtered.length === 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Partnerler"
        title="Firmalar"
        description="Platforma kayıtlı firma hesaplarını yönetin"
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Firma Ekle
          </Button>
        }
      />

      {/* Toolbar */}
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Firma adı, e-posta veya ID ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </div>

          <div className="w-40">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tip" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-36">
            <Select value={membershipFilter} onValueChange={setMembershipFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Üyelik" />
              </SelectTrigger>
              <SelectContent>
                {membershipOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={() => setShowSecondary((v) => !v)}
            className="gap-1.5"
          >
            <Filter className="size-3.5" />
            {showSecondary ? 'Gizle' : 'Detaylı Filtre'}
          </Button>
        </CardContent>

        {showSecondary && (
          <div className="border-t border-dashed border-border/70 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                placeholder="Firma Adı"
                value={secondary.name}
                onChange={(e) => setSecondary((p) => ({ ...p, name: e.target.value }))}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
              />
              <Select value={secondary.status} onValueChange={(v) => setSecondary((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={secondary.type} onValueChange={(v) => setSecondary((p) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue placeholder="Tip" /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={secondary.membership} onValueChange={(v) => setSecondary((p) => ({ ...p, membership: v }))}>
                <SelectTrigger><SelectValue placeholder="Üyelik" /></SelectTrigger>
                <SelectContent>
                  {membershipOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSecondary({ name: '', status: 'all', type: 'all', membership: 'all' })}
              >
                Filtreleri Sıfırla
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Firma Listesi</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{filtered.length} kayıt</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {error && (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Hata</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <Skeleton key={j} className="h-4" />
                  ))}
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Filter className="size-6 text-muted-foreground" />
              <p className="font-semibold">Gösterilecek firma bulunamadı</p>
              <p className="text-sm text-muted-foreground">Filtreleri değiştirerek yeniden deneyin.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                  setMembershipFilter('all');
                  setSecondary({ name: '', status: 'all', type: 'all', membership: 'all' });
                }}
              >
                Filtreleri sıfırla
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firma</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Yetkili</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Üyelik</TableHead>
                    <TableHead>Oluşturulma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Link
                            href={`/cms/companies/${c.id}`}
                            className="font-medium text-foreground hover:text-primary"
                          >
                            {c.name}
                          </Link>
                          <span className="text-xs text-muted-foreground">{c.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={typeMeta[c.type]?.variant}>{typeMeta[c.type]?.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.owner}</TableCell>
                      <TableCell>
                        <Badge variant={statusMeta[c.status]?.variant}>{statusMeta[c.status]?.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={membershipMeta[c.membership]?.variant}>
                          {membershipMeta[c.membership]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{c.createdAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
