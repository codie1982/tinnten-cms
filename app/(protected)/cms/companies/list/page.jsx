'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/container';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Filter, MoreVertical } from 'lucide-react';

const statusOptions = [
  { value: 'all', label: 'Tümü' },
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

const companiesMock = [
  {
    id: 'COMP-1023',
    name: 'ABC Temizlik Hizmetleri',
    type: 'service',
    owner: 'Mehmet Kılıç',
    email: 'info@abctemizlik.com',
    status: 'approved',
    membership: 'pro',
    createdAt: '12.03.2025',
  },
  {
    id: 'COMP-1042',
    name: 'Yılmaz Teknoloji Ltd.',
    type: 'product',
    owner: 'Selin Yılmaz',
    email: 'destek@yilmaztech.com',
    status: 'pending',
    membership: 'free',
    createdAt: '22.03.2025',
  },
  {
    id: 'COMP-1050',
    name: 'Nova Enerji ve Teknoloji',
    type: 'both',
    owner: 'Cemre Danış',
    email: 'contact@novaenergy.io',
    status: 'approved',
    membership: 'enterprise',
    createdAt: '05.02.2025',
  },
  {
    id: 'COMP-0891',
    name: 'Perla Yapı & İnşaat',
    type: 'service',
    owner: 'İlker Parlak',
    email: 'iletisim@perlayapi.com',
    status: 'suspended',
    membership: 'pro',
    createdAt: '19.01.2025',
  },
];

const typeMeta = {
  service: { label: 'Hizmet', variant: 'info' },
  product: { label: 'Ürün Satıcısı', variant: 'secondary' },
  both: { label: 'Her İkisi', variant: 'primary' },
};

const statusMeta = {
  approved: { label: 'Onaylı', variant: 'success' },
  pending: { label: 'Beklemede', variant: 'warning' },
  suspended: { label: 'Askıda', variant: 'secondary' },
  blocked: { label: 'Engelli', variant: 'destructive' },
};

const membershipMeta = {
  free: { label: 'Free', variant: 'secondary' },
  pro: { label: 'Pro', variant: 'primary' },
  enterprise: { label: 'Enterprise', variant: 'info' },
};

export default function CmsCompaniesListPage() {
  const [search, setSearch] = useState('');
  const [statusFilterValue, setStatusFilterValue] = useState('all');
  const [typeFilterValue, setTypeFilterValue] = useState('all');
  const [membershipFilter, setMembershipFilter] = useState('all');
  const [secondaryFilters, setSecondaryFilters] = useState({
    name: '',
    status: 'all',
    type: 'all',
    membership: 'all',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      if (search.toLowerCase().includes('error')) {
        setError('Firmalar yüklenemedi');
      }
      setIsLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [search, statusFilterValue, typeFilterValue, membershipFilter, secondaryFilters]);

  const filteredCompanies = useMemo(() => {
    return companiesMock
      .filter((company) =>
        search
          ? [company.name, company.email, company.id]
              .some((field) => field.toLowerCase().includes(search.toLowerCase()))
          : true,
      )
      .filter((company) =>
        statusFilterValue === 'all' ? true : company.status === statusFilterValue,
      )
      .filter((company) => (typeFilterValue === 'all' ? true : company.type === typeFilterValue))
      .filter((company) =>
        membershipFilter === 'all' ? true : company.membership === membershipFilter,
      )
      .filter((company) =>
        secondaryFilters.status === 'all' ? true : company.status === secondaryFilters.status,
      )
      .filter((company) =>
        secondaryFilters.type === 'all' ? true : company.type === secondaryFilters.type,
      )
      .filter((company) =>
        secondaryFilters.membership === 'all'
          ? true
          : company.membership === secondaryFilters.membership,
      )
      .filter((company) =>
        secondaryFilters.name
          ? company.name.toLowerCase().includes(secondaryFilters.name.toLowerCase())
          : true,
      );
  }, [search, statusFilterValue, typeFilterValue, membershipFilter, secondaryFilters]);

  const handleSecondaryChange = (key, value) => {
    setSecondaryFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSecondaryReset = () => {
    setSecondaryFilters({ name: '', status: 'all', type: 'all', membership: 'all' });
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 400);
  };

  const isEmpty = !isLoading && !error && filteredCompanies.length === 0;

  return (
    <div className="app-content py-6">
      <Container className="max-w-[1440px] space-y-6">
        <section className="rounded-2xl border border-border bg-card/60 p-5 shadow-xs shadow-black/5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href="/cms/dashboard">Home</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Firma Yönetimi</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div>
                <p className="text-sm font-medium text-primary">CMS</p>
                <h1 className="text-2xl font-semibold tracking-tight">Firma Yönetimi</h1>
                <p className="text-sm text-muted-foreground">
                  Platformdaki tüm firmaların durumu, üyelikleri ve satış yetkileri
                </p>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:flex lg:items-end lg:gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="company-search">Firma Ara</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="company-search"
                    placeholder="Firma ara..."
                    className="pl-9"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Label>Durum</Label>
                <Select value={statusFilterValue} onValueChange={setStatusFilterValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Durum" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label>Firma Tipi</Label>
                <Select value={typeFilterValue} onValueChange={setTypeFilterValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Firma Tipi" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label>Üyelik</Label>
                <Select value={membershipFilter} onValueChange={setMembershipFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Üyelik" />
                  </SelectTrigger>
                  <SelectContent>
                    {membershipOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button className="w-full">Yeni Firma Ekle</Button>
              </div>
            </div>
          </div>
        </section>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Firma Listesi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SecondaryFiltersRow
              filters={secondaryFilters}
              onChange={handleSecondaryChange}
              onReset={handleSecondaryReset}
            />

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Hata</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-4">
                  {error}
                  <Button size="sm" onClick={handleRetry}>
                    Tekrar dene
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <TableSkeleton rows={6} columns={6} />
            ) : isEmpty ? (
              <EmptyState onReset={handleSecondaryReset} />
            ) : (
              <CompaniesTable data={filteredCompanies} />
            )}
          </CardContent>
        </Card>
      </Container>
    </div>
  );
}

function CompaniesTable({ data }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Firma</TableHead>
            <TableHead>Firma Tipi</TableHead>
            <TableHead>Yetkili Kişi</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Üyelik</TableHead>
            <TableHead>Oluşturulma</TableHead>
            <TableHead>Aksiyonlar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((company) => (
            <TableRow key={company.id}>
              <TableCell>
                <div className="flex flex-col">
                  <Link
                    href={`/cms/companies/${company.id}`}
                    className="font-semibold text-primary"
                  >
                    {company.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{company.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge appearance="light" variant={typeMeta[company.type]?.variant}>
                  {typeMeta[company.type]?.label}
                </Badge>
              </TableCell>
              <TableCell>{company.owner}</TableCell>
              <TableCell>
                <Badge appearance="light" variant={statusMeta[company.status]?.variant}>
                  {statusMeta[company.status]?.label}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge appearance="light" variant={membershipMeta[company.membership]?.variant}>
                  {membershipMeta[company.membership]?.label}
                </Badge>
              </TableCell>
              <TableCell>{company.createdAt}</TableCell>
              <TableCell>
                <CompanyActionMenu companyId={company.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SecondaryFiltersRow({ filters, onChange, onReset }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Firma Adı"
          value={filters.name}
          onChange={(event) => onChange('name', event.target.value)}
        />
        <Select value={filters.status} onValueChange={(value) => onChange('status', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.type} onValueChange={(value) => onChange('type', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Tip" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.membership}
          onValueChange={(value) => onChange('membership', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Üyelik" />
          </SelectTrigger>
          <SelectContent>
            {membershipOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onReset}>
          Filtreleri Sıfırla
        </Button>
      </div>
    </div>
  );
}

function CompanyActionMenu({ companyId }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/cms/companies/${companyId}`}>Detay</Link>
        </DropdownMenuItem>
        <DropdownMenuItem>Onaya Gönder</DropdownMenuItem>
        <DropdownMenuItem>Askıya Al</DropdownMenuItem>
        <DropdownMenuItem>Engelle</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TableSkeleton({ rows = 6, columns = 6 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton key={`${rowIndex}-${colIndex}`} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onReset }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/40 px-6 py-12 text-center">
      <Filter className="h-6 w-6 text-muted-foreground" />
      <p className="text-base font-semibold">Gösterilecek firma bulunamadı</p>
      <p className="text-sm text-muted-foreground">
        Filtreleri değiştirerek yeniden deneyin.
      </p>
      <Button size="sm" onClick={onReset}>
        Filtreleri sıfırla
      </Button>
    </div>
  );
}
