'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, endOfDay, format, startOfDay } from 'date-fns';
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
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarDays, Download, Filter, MoreVertical, Search, Settings2 } from 'lucide-react';

const statusOptions = [
  { value: 'all', label: 'Tümü' },
  { value: 'received', label: 'Talep Alındı' },
  { value: 'reviewing', label: 'İncelemede' },
  { value: 'approved', label: 'Onaylandı' },
  { value: 'rejected', label: 'Reddedildi' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'escrow', label: 'Escrow’da Bekliyor' },
];

const typeOptions = [
  { value: 'all', label: 'Tümü' },
  { value: 'full', label: 'Tam İade' },
  { value: 'partial', label: 'Parçalı İade' },
  { value: 'cancel', label: 'Sipariş İptali' },
  { value: 'service', label: 'Hizmet İadesi' },
];

const tabFilters = [
  { value: 'all', label: 'Tümü', match: () => true },
  {
    value: 'pending',
    label: 'Bekleyen',
    match: (item) => ['received', 'reviewing'].includes(item.status),
  },
  {
    value: 'done',
    label: 'Tamamlanan',
    match: (item) => ['approved', 'completed'].includes(item.status),
  },
  {
    value: 'rejected',
    label: 'Reddedilen',
    match: (item) => item.status === 'rejected',
  },
  {
    value: 'partial',
    label: 'Parçalı',
    match: (item) => item.requestType === 'partial',
  },
];

const viewOptions = [
  { value: 'table', label: 'Tablo' },
  { value: 'compact', label: 'Kompakt' },
];

const requestTypeMeta = {
  full: { label: 'Tam İade', variant: 'primary' },
  partial: { label: 'Parçalı İade', variant: 'secondary' },
  cancel: { label: 'Sipariş İptali', variant: 'warning' },
  service: { label: 'Hizmet İadesi', variant: 'info' },
};

const returnStatusMeta = {
  received: { label: 'Talep Alındı', variant: 'info' },
  reviewing: { label: 'İncelemede', variant: 'secondary' },
  approved: { label: 'Onaylandı', variant: 'success' },
  rejected: { label: 'Reddedildi', variant: 'destructive' },
  completed: { label: 'Tamamlandı', variant: 'success' },
  escrow: { label: 'Escrow’da Bekliyor', variant: 'warning' },
};

const mockReturns = [
  {
    id: 'RET-2025-00412',
    orderId: 'ORD-2025-001234',
    orderType: 'product',
    requestType: 'full',
    buyer: { name: 'Ahmet Yılmaz', email: 'ahmet@example.com' },
    seller: { name: 'ABC Temizlik Hizmetleri', id: 'SELL-9831' },
    reason: 'Ürün hasarlı geldi, fotoğraflar ektedir.',
    items: ['Koltuk Temizliği', 'Temizlik Sarf Seti'],
    amount: 3200,
    orderTotal: 4800,
    status: 'reviewing',
    createdAt: '2025-03-15T09:20:00Z',
    paymentProvider: 'iyzico',
    channel: 'Alıcı',
  },
  {
    id: 'RET-2025-00405',
    orderId: 'ORD-2025-001120',
    orderType: 'service',
    requestType: 'partial',
    buyer: { name: 'Selin Aksoy', email: 'selin@firma.com' },
    seller: { name: 'Delta Medikal', id: 'SELL-9711' },
    reason: 'Hizmetin 2. günü yapılamadı, ücret iadesi isteniyor.',
    items: ['Sterilizasyon Paketi'],
    amount: 1850,
    orderTotal: 5400,
    status: 'received',
    createdAt: '2025-03-14T11:05:00Z',
    paymentProvider: 'stripe',
    channel: 'Satıcı',
  },
  {
    id: 'RET-2025-00388',
    orderId: 'ORD-2025-000955',
    orderType: 'service',
    requestType: 'cancel',
    buyer: { name: 'Myra Digital', email: 'ops@myradigital.io' },
    seller: { name: 'Perla Yapı', id: 'SELL-9231' },
    reason: 'Proje ertelendiği için sipariş iptal edildi.',
    items: ['Ofis tadilat hizmeti'],
    amount: 26500,
    orderTotal: 26500,
    status: 'approved',
    createdAt: '2025-03-12T16:45:00Z',
    paymentProvider: 'iyzico',
    channel: 'Admin',
  },
  {
    id: 'RET-2025-00370',
    orderId: 'ORD-2024-009821',
    orderType: 'product',
    requestType: 'full',
    buyer: { name: 'Atlas Grup', email: 'satinalma@atlas.com' },
    seller: { name: 'Nova Tekstil', id: 'SELL-9411' },
    reason: 'Ürün renkleri farklı geldiği için iade talep edildi.',
    items: ['Uniforma Seti', 'Kişisel Koruyucu Ekipman'],
    amount: 7800,
    orderTotal: 7800,
    status: 'rejected',
    createdAt: '2025-03-10T08:55:00Z',
    paymentProvider: 'stripe',
    channel: 'Alıcı',
  },
  {
    id: 'RET-2025-00340',
    orderId: 'ORD-2024-008765',
    orderType: 'product',
    requestType: 'partial',
    buyer: { name: 'Ekin Ofis', email: 'ops@ekinoffice.com' },
    seller: { name: 'Saltus Enerji', id: 'SELL-9182' },
    reason: '3 üründen biri yanlış geldi, yalnızca ilgili kalem iade edilecek.',
    items: ['Enerji Tasarruf Sensörü'],
    amount: 950,
    orderTotal: 5400,
    status: 'completed',
    createdAt: '2025-03-08T13:15:00Z',
    paymentProvider: 'iyzico',
    channel: 'Alıcı',
  },
  {
    id: 'RET-2025-00322',
    orderId: 'ORD-2024-007111',
    orderType: 'service',
    requestType: 'service',
    buyer: { name: 'Logiware GmbH', email: 'orders@logiware.de' },
    seller: { name: 'Faro Lojistik', id: 'SELL-9622' },
    reason: 'Hizmet kalitesi SLA standartlarını karşılamadı.',
    items: ['Depo temizliği hizmeti'],
    amount: 11800,
    orderTotal: 11800,
    status: 'escrow',
    createdAt: '2025-03-06T17:40:00Z',
    paymentProvider: 'stripe',
    channel: 'Satıcı',
  },
];

export default function CmsOrdersReturnsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [tabFilter, setTabFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [secondaryFilters, setSecondaryFilters] = useState({
    requestId: '',
    orderId: '',
    buyer: '',
    seller: '',
    status: 'all',
    type: 'all',
    provider: 'all',
    channel: 'all',
  });
  const [selected, setSelected] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [tempRange, setTempRange] = useState(dateRange);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      if (searchQuery.toLowerCase().includes('error')) {
        setError('İade talepleri yüklenirken bir hata oluştu.');
      }
      setIsLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [statusFilter, typeFilter, tabFilter, searchQuery, secondaryFilters, viewMode, dateRange]);

  const filteredReturns = useMemo(() => {
    const from = dateRange?.from ? startOfDay(dateRange.from).getTime() : null;
    const to = dateRange?.to ? endOfDay(dateRange.to).getTime() : null;

    return mockReturns
      .filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter))
      .filter((item) => (typeFilter === 'all' ? true : item.requestType === typeFilter))
      .filter((item) => tabFilters.find((tab) => tab.value === tabFilter)?.match(item) ?? true)
      .filter((item) =>
        secondaryFilters.status === 'all' ? true : item.status === secondaryFilters.status,
      )
      .filter((item) =>
        secondaryFilters.type === 'all' ? true : item.requestType === secondaryFilters.type,
      )
      .filter((item) =>
        secondaryFilters.provider === 'all'
          ? true
          : item.paymentProvider === secondaryFilters.provider,
      )
      .filter((item) =>
        secondaryFilters.channel === 'all' ? true : item.channel === secondaryFilters.channel,
      )
      .filter((item) =>
        secondaryFilters.requestId
          ? item.id.toLowerCase().includes(secondaryFilters.requestId.toLowerCase())
          : true,
      )
      .filter((item) =>
        secondaryFilters.orderId
          ? item.orderId.toLowerCase().includes(secondaryFilters.orderId.toLowerCase())
          : true,
      )
      .filter((item) =>
        secondaryFilters.buyer
          ? item.buyer.name.toLowerCase().includes(secondaryFilters.buyer.toLowerCase())
          : true,
      )
      .filter((item) =>
        secondaryFilters.seller
          ? item.seller.name.toLowerCase().includes(secondaryFilters.seller.toLowerCase())
          : true,
      )
      .filter((item) =>
        searchQuery
          ? [item.id, item.orderId, item.buyer.name, item.seller.name]
              .some((field) => field.toLowerCase().includes(searchQuery.toLowerCase()))
          : true,
      )
      .filter((item) => {
        if (!from || !to) return true;
        const created = new Date(item.createdAt).getTime();
        return created >= from && created <= to;
      });
  }, [statusFilter, typeFilter, tabFilter, secondaryFilters, searchQuery, dateRange]);

  const isEmpty = !isLoading && !error && filteredReturns.length === 0;
  const selectionCount = selected.length;
  const allSelected =
    filteredReturns.length > 0 && selectionCount === filteredReturns.length;

  const stats = useMemo(() => {
    const today = filteredReturns.filter((item) =>
      new Date(item.createdAt).toDateString() === new Date().toDateString(),
    ).length;
    const pending = filteredReturns.filter((item) =>
      ['received', 'reviewing'].includes(item.status),
    ).length;
    const approved = filteredReturns.filter((item) => item.status === 'approved').length;
    const rejected = filteredReturns.filter((item) => item.status === 'rejected').length;
    const totalAmount = filteredReturns.reduce((sum, item) => sum + item.amount, 0);
    return {
      today,
      pending,
      approved,
      rejected,
      avg: '3.2',
      total: totalAmount,
    };
  }, [filteredReturns]);

  const dateRangeDisplay =
    dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`
      : 'Son 30 gün';

  const applyDateRange = () => {
    setDateRange(tempRange);
    setIsDatePickerOpen(false);
  };

  const resetDateRange = () => {
    const range = { from: addDays(new Date(), -30), to: new Date() };
    setTempRange(range);
    setDateRange(range);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelected(filteredReturns.map((item) => item.id));
    } else {
      setSelected([]);
    }
  };

  const handleSelectRow = (id, checked) => {
    setSelected((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  };

  const handleSecondaryChange = (key, value) => {
    setSecondaryFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSecondaryReset = () => {
    setSecondaryFilters({
      requestId: '',
      orderId: '',
      buyer: '',
      seller: '',
      status: 'all',
      type: 'all',
      provider: 'all',
      channel: 'all',
    });
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 400);
  };

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
                    <BreadcrumbLink asChild>
                      <Link href="/cms/orders/list">Sipariş Yönetimi</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>İade / İptal</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div>
                <p className="text-sm font-medium text-primary">CMS</p>
                <h1 className="text-2xl font-semibold tracking-tight">İade / İptal Yönetimi</h1>
                <p className="text-sm text-muted-foreground">
                  Alıcı veya satıcı tarafından başlatılan tüm iade / iptal talepleri
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 lg:w-auto">
              <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-end lg:gap-4">
                <div className="flex flex-col gap-1">
                  <Label>Durum</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                  <Label>Tür</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tür" />
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
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex flex-col gap-1">
                  <Label>Tarih Aralığı</Label>
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start">
                        <CalendarDays className="me-2 h-4 w-4" /> {dateRangeDisplay}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="range"
                        numberOfMonths={2}
                        selected={tempRange}
                        defaultMonth={tempRange?.from || new Date()}
                        onSelect={setTempRange}
                      />
                      <div className="flex items-center justify-end gap-2 border-t border-border p-3">
                        <Button variant="ghost" size="sm" onClick={resetDateRange}>
                          Varsayılan
                        </Button>
                        <Button size="sm" onClick={applyDateRange}>
                          Uygula
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex w-full flex-col gap-1">
                  <Label>Ara</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Sipariş no, kullanıcı, firma, takip no..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <StatsGrid stats={stats} isLoading={isLoading} />

        <section>
          <Tabs value={tabFilter} onValueChange={setTabFilter}>
            <TabsList variant="line" className="w-full overflow-x-auto">
              {tabFilters.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={tabFilter} className="mt-0" />
          </Tabs>
        </section>

        <section className="space-y-4">
          {selectionCount > 0 && (
            <BulkActions count={selectionCount} onClear={() => setSelected([])} />
          )}

          <Card className="border border-border/70">
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>İade Talepleri</CardTitle>
                <CardDescription>Siparişlere bağlı tüm iade ve iptal vakaları</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={viewMode} onValueChange={setViewMode}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Görünüm" />
                  </SelectTrigger>
                  <SelectContent>
                    {viewOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon">
                  <Settings2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
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
                <TableSkeleton rows={6} columns={8} />
              ) : isEmpty ? (
                <EmptyState onReset={handleSecondaryReset} />
              ) : viewMode === 'table' ? (
                <ReturnsTable
                  data={filteredReturns}
                  selected={selected}
                  onSelectRow={handleSelectRow}
                  onSelectAll={handleSelectAll}
                  allSelected={allSelected}
                />
              ) : (
                <ReturnsCompactView
                  data={filteredReturns}
                  selected={selected}
                  onSelectRow={handleSelectRow}
                />
              )}
            </CardContent>
          </Card>
        </section>
      </Container>
    </div>
  );
}

function StatsGrid({ stats, isLoading }) {
  const safeStats = stats || {};
  const items = [
    { label: 'Bugün Gelen Talepler', value: safeStats.today ?? '-' },
    { label: 'Bekleyen Talepler', value: safeStats.pending ?? '-' },
    { label: 'Onaylananlar', value: safeStats.approved ?? '-' },
    { label: 'Reddedilenler', value: safeStats.rejected ?? '-' },
    { label: 'Ort. Çözüm Süresi (gün)', value: safeStats.avg ?? '-' },
    {
      label: 'Aylık Toplam İade Tutarı',
      value: safeStats.total != null ? formatCurrency(safeStats.total) : '-',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} className="border border-border/70">
          <CardContent className="flex h-full flex-col justify-between py-6">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            {isLoading ? (
              <Skeleton className="mt-3 h-6 w-24" />
            ) : (
              <p className="text-2xl font-semibold">{item.value ?? '-'}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReturnsTable({ data, selected, onSelectRow, onSelectAll, allSelected }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
                aria-label="Select all returns"
              />
            </TableHead>
            <TableHead>Talep No</TableHead>
            <TableHead>Sipariş No</TableHead>
            <TableHead>Talep Türü</TableHead>
            <TableHead>Alıcı</TableHead>
            <TableHead>Satıcı Firma</TableHead>
            <TableHead>Talep Nedeni</TableHead>
            <TableHead>Kalemler</TableHead>
            <TableHead>Tutar</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Tarih</TableHead>
            <TableHead>Aksiyonlar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id} className="align-top">
              <TableCell>
                <Checkbox
                  checked={selected.includes(item.id)}
                  onCheckedChange={(checked) => onSelectRow(item.id, Boolean(checked))}
                />
              </TableCell>
              <TableCell>
                <Link href={`/cms/orders/returns/${item.id}`} className="font-semibold text-primary">
                  {item.id}
                </Link>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{item.orderId}</span>
                  <Badge appearance="light" size="xs" className="w-fit">
                    {item.orderType === 'service' ? 'Hizmet' : 'Ürün'}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <Badge appearance="light" variant={requestTypeMeta[item.requestType]?.variant}>
                  {requestTypeMeta[item.requestType]?.label}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col text-sm">
                  <span className="font-semibold">{item.buyer.name}</span>
                  <span className="text-xs text-muted-foreground">{item.buyer.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col text-sm">
                  <span className="font-semibold">{item.seller.name}</span>
                  <span className="text-xs text-muted-foreground">{item.seller.id}</span>
                </div>
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="line-clamp-1 text-sm text-muted-foreground">
                      {item.reason}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm text-sm">
                    {item.reason}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge appearance="light" size="sm">
                      {item.items.length} kalem
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <ul className="space-y-1 text-xs">
                      {item.items.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-semibold">{formatCurrency(item.amount)}</span>
                  <span className="text-xs text-muted-foreground">
                    Toplam: {formatCurrency(item.orderTotal)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge appearance="light" variant={returnStatusMeta[item.status]?.variant}>
                  {returnStatusMeta[item.status]?.label || 'Durum'}
                </Badge>
              </TableCell>
              <TableCell>{formatDateTime(item.createdAt)}</TableCell>
              <TableCell>
                <ActionMenu returnId={item.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReturnsCompactView({ data, selected, onSelectRow }) {
  return (
    <div className="grid gap-3">
      {data.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-border/70 p-4 shadow-sm shadow-black/5"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <Link href={`/cms/orders/returns/${item.id}`} className="font-semibold text-primary">
                {item.id}
              </Link>
              <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
            </div>
            <Badge appearance="light" variant={returnStatusMeta[item.status]?.variant}>
              {returnStatusMeta[item.status]?.label}
            </Badge>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <p className="font-medium">Sipariş: {item.orderId}</p>
            <p>Alıcı: {item.buyer.name}</p>
            <p>Satıcı: {item.seller.name}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge appearance="light" variant={requestTypeMeta[item.requestType]?.variant}>
              {requestTypeMeta[item.requestType]?.label}
            </Badge>
            <span className="font-semibold">{formatCurrency(item.amount)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Checkbox
              checked={selected.includes(item.id)}
              onCheckedChange={(checked) => onSelectRow(item.id, Boolean(checked))}
            />
            <Button asChild size="sm" variant="outline">
              <Link href={`/cms/orders/returns/${item.id}`}>Detayı Gör</Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SecondaryFiltersRow({ filters, onChange, onReset }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Input
          placeholder="Talep No"
          value={filters.requestId}
          onChange={(event) => onChange('requestId', event.target.value)}
        />
        <Input
          placeholder="Sipariş No"
          value={filters.orderId}
          onChange={(event) => onChange('orderId', event.target.value)}
        />
        <Input
          placeholder="Alıcı"
          value={filters.buyer}
          onChange={(event) => onChange('buyer', event.target.value)}
        />
        <Input
          placeholder="Satıcı Firma"
          value={filters.seller}
          onChange={(event) => onChange('seller', event.target.value)}
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
            <SelectValue placeholder="Tür" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.provider} onValueChange={(value) => onChange('provider', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Ödeme Sağlayıcı" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Ödeme Sağlayıcı</SelectItem>
            <SelectItem value="iyzico">iyzico</SelectItem>
            <SelectItem value="stripe">stripe</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.channel} onValueChange={(value) => onChange('channel', value)}>
          <SelectTrigger>
            <SelectValue placeholder="İade Kanalı" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">İade Kanalı</SelectItem>
            <SelectItem value="Alıcı">Alıcı tarafından</SelectItem>
            <SelectItem value="Satıcı">Satıcı tarafından</SelectItem>
            <SelectItem value="Admin">Otomatik / Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onReset}>
          Filtreleri Temizle
        </Button>
      </div>
    </div>
  );
}

function BulkActions({ count, onClear }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
      <div>
        <span className="font-semibold text-primary">{count} talep</span> seçildi
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary">
          Durumu Toplu Güncelle
        </Button>
        <Button size="sm" variant="outline">
          İadeyi Onayla
        </Button>
        <Button size="sm" variant="outline">
          İadeyi Reddet
        </Button>
        <Button size="sm" variant="outline">
          Parçalı İade Oluştur
        </Button>
        <Button size="sm" variant="outline">
          Etiket Ekle
        </Button>
        <Button size="sm" variant="outline">
          Export Seçili
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Seçimi Temizle
        </Button>
      </div>
    </div>
  );
}

function ActionMenu({ returnId }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/cms/orders/returns/${returnId}`}>Detayı Gör</Link>
        </DropdownMenuItem>
        <DropdownMenuItem>Durum Güncelle</DropdownMenuItem>
        <DropdownMenuItem>Not Ekle</DropdownMenuItem>
        <DropdownMenuItem>İade Etiketleri</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TableSkeleton({ rows = 5, columns = 6 }) {
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
      <p className="text-base font-semibold">Gösterilecek iade talebi bulunamadı</p>
      <p className="text-sm text-muted-foreground">
        Filtreleri değiştirerek yeniden deneyin.
      </p>
      <Button size="sm" onClick={onReset}>
        Tüm filtreleri sıfırla
      </Button>
    </div>
  );
}

function formatDateTime(date) {
  return format(new Date(date), 'dd.MM.yyyy HH:mm');
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    currencyDisplay: 'narrowSymbol',
  }).format(amount);
}
