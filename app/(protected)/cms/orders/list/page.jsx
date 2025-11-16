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
  CardToolbar,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  CalendarDays,
  Download,
  Filter,
  MoreVertical,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

const statusOptions = [
  { value: 'all', label: 'Tümü' },
  { value: 'new', label: 'Yeni' },
  { value: 'pending_payment', label: 'Ödeme Bekliyor' },
  { value: 'preparing', label: 'Hazırlanıyor' },
  { value: 'shipping', label: 'Kargoda' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'cancelled', label: 'İptal' },
  { value: 'refund', label: 'İade' },
];

const orderTypeOptions = [
  { value: 'all', label: 'Tümü' },
  { value: 'product', label: 'Ürün Siparişi' },
  { value: 'service', label: 'Hizmet (Teklifli)' },
  { value: 'subscription', label: 'Abonelik / Üyelik' },
];

const viewOptions = [
  { value: 'table', label: 'Tablo' },
  { value: 'compact', label: 'Kompakt' },
  { value: 'grouping', label: 'Grouping' },
];

const paymentStatusOptions = [
  { value: 'all', label: 'Ödeme Durumu' },
  { value: 'paid', label: 'Ödendi' },
  { value: 'pending', label: 'Ödeme Bekliyor' },
  { value: 'failed', label: 'Reddedildi' },
  { value: 'refunded', label: 'İade Edildi' },
];

const escrowStatusOptions = [
  { value: 'all', label: 'Escrow Durumu' },
  { value: 'blocked', label: 'Blokede' },
  { value: 'released', label: 'Serbest Bırakıldı' },
  { value: 'scheduled', label: 'Planlı Ödeme' },
  { value: 'dispute', label: 'İhtilaflı' },
];

const tabFilters = [
  { value: 'all', label: 'Tümü', match: () => true },
  {
    value: 'active',
    label: 'Aktif',
    match: (order) =>
      ['new', 'pending_payment', 'preparing', 'shipping'].includes(
        order.orderStatus,
      ),
  },
  {
    value: 'completed',
    label: 'Tamamlanan',
    match: (order) => order.orderStatus === 'completed',
  },
  {
    value: 'cancelled',
    label: 'İptal / İade',
    match: (order) =>
      ['cancelled', 'refund'].includes(order.orderStatus),
  },
  {
    value: 'risk',
    label: 'Riskli',
    match: (order) =>
      order.escrowStatus === 'dispute' || order.paymentStatus === 'failed',
  },
];

const ordersData = [
  {
    id: 'ORD-2025-001234',
    internalId: '8956123',
    createdAt: '2025-01-14T09:32:00Z',
    buyerId: 'USR-18273',
    buyer: { name: 'Ahmet Yılmaz', email: 'ahmet@example.com' },
    buyerCompany: {
      type: 'b2b',
      name: 'Yılmaz İnşaat A.Ş.',
      taxId: 'TR1234567890',
      country: 'TR',
    },
    seller: { name: 'ABC Temizlik Hizmetleri', id: 'SELL-9831', status: 'Onaylı' },
    orderType: 'product',
    amount: 12450,
    currency: 'TRY',
    paymentStatus: 'paid',
    orderStatus: 'preparing',
    escrowStatus: 'blocked',
    escrowId: 'ESC-50110',
  },
  {
    id: 'ORD-2025-001198',
    internalId: '8955888',
    createdAt: '2025-01-12T14:25:00Z',
    buyerId: 'USR-18004',
    buyer: { name: 'Selin Aksoy', email: 'selin.aksoy@firma.com' },
    buyerCompany: null,
    seller: { name: 'Delta Medikal', id: 'SELL-9711', status: 'Beklemede' },
    orderType: 'service',
    amount: 45200,
    currency: 'TRY',
    paymentStatus: 'pending',
    orderStatus: 'pending_payment',
    escrowStatus: 'scheduled',
    escrowId: 'ESC-50091',
  },
  {
    id: 'ORD-2025-001050',
    internalId: '8954800',
    createdAt: '2025-01-08T07:45:00Z',
    buyerId: 'USR-17782',
    buyer: { name: 'Logiware GmbH', email: 'orders@logiware.de' },
    buyerCompany: {
      type: 'b2b',
      name: 'Logiware GmbH',
      taxId: 'DE299554203',
      country: 'DE',
    },
    seller: { name: 'Faro Lojistik', id: 'SELL-9622', status: 'Onaylı' },
    orderType: 'service',
    amount: 11800,
    currency: 'EUR',
    paymentStatus: 'paid',
    orderStatus: 'shipping',
    escrowStatus: 'scheduled',
    escrowId: 'ESC-50040',
  },
  {
    id: 'ORD-2025-000988',
    internalId: '8954302',
    createdAt: '2024-12-29T18:02:00Z',
    buyerId: 'USR-17400',
    buyer: { name: 'Atlas Grup', email: 'satinalma@atlas.com' },
    buyerCompany: {
      type: 'b2b',
      name: 'Atlas Grup',
      taxId: 'TR1029384756',
      country: 'TR',
    },
    seller: { name: 'Nova Tekstil', id: 'SELL-9411', status: 'Onaylı' },
    orderType: 'subscription',
    amount: 8900,
    currency: 'TRY',
    paymentStatus: 'paid',
    orderStatus: 'completed',
    escrowStatus: 'released',
    escrowId: 'ESC-49988',
  },
  {
    id: 'ORD-2025-000955',
    internalId: '8954001',
    createdAt: '2024-12-20T11:12:00Z',
    buyerId: 'USR-17220',
    buyer: { name: 'Myra Digital', email: 'info@myradigital.io' },
    buyerCompany: {
      type: 'b2b',
      name: 'Myra Digital',
      taxId: 'UK88234501',
      country: 'UK',
    },
    seller: { name: 'Perla Yapı', id: 'SELL-9231', status: 'Askıda' },
    orderType: 'service',
    amount: 26500,
    currency: 'USD',
    paymentStatus: 'failed',
    orderStatus: 'cancelled',
    escrowStatus: 'dispute',
    escrowId: 'ESC-49940',
  },
  {
    id: 'ORD-2025-000921',
    internalId: '8953775',
    createdAt: '2024-12-18T09:15:00Z',
    buyerId: 'USR-17188',
    buyer: { name: 'Ekin Ofis', email: 'satinalma@ekinoffice.com' },
    buyerCompany: {
      type: 'b2b',
      name: 'Ekin Ofis',
      taxId: 'TR5566778899',
      country: 'TR',
    },
    seller: { name: 'Saltus Enerji', id: 'SELL-9182', status: 'Onaylı' },
    orderType: 'service',
    amount: 15750,
    currency: 'TRY',
    paymentStatus: 'pending',
    orderStatus: 'new',
    escrowStatus: 'blocked',
    escrowId: 'ESC-49931',
  },
];

const orderTypeMeta = {
  product: { label: 'Ürün', variant: 'primary' },
  service: { label: 'Hizmet', variant: 'info' },
  subscription: { label: 'Abonelik', variant: 'secondary' },
};

const paymentMeta = {
  paid: { label: 'Ödendi', variant: 'success' },
  pending: { label: 'Ödeme Bekliyor', variant: 'warning' },
  failed: { label: 'Reddedildi', variant: 'destructive' },
  refunded: { label: 'İade Edildi', variant: 'secondary' },
};

const orderStatusMeta = {
  new: { label: 'Yeni', variant: 'info' },
  pending_payment: { label: 'Ödeme Bekliyor', variant: 'warning' },
  preparing: { label: 'Hazırlanıyor', variant: 'info' },
  shipping: { label: 'Kargoda', variant: 'secondary' },
  completed: { label: 'Tamamlandı', variant: 'success' },
  cancelled: { label: 'İptal', variant: 'destructive' },
  refund: { label: 'İade Sürecinde', variant: 'warning' },
};

const escrowStatusMeta = {
  blocked: { label: 'Blokede', variant: 'info' },
  released: { label: 'Serbest Bırakıldı', variant: 'success' },
  scheduled: { label: 'Planlı Ödeme', variant: 'secondary' },
  dispute: { label: 'İhtilaflı', variant: 'destructive' },
};

export default function CmsOrdersListPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [tabFilter, setTabFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [secondaryFilters, setSecondaryFilters] = useState({
    orderNo: '',
    buyer: '',
    seller: '',
    paymentStatus: 'all',
    escrowStatus: 'all',
    region: '',
  });
  const [selectedOrders, setSelectedOrders] = useState([]);
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
        setError('Siparişler yüklenirken bir hata oluştu.');
      }
      setIsLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [statusFilter, orderTypeFilter, tabFilter, searchQuery, secondaryFilters, viewMode, dateRange]);

  const filteredOrders = useMemo(() => {
    const from = dateRange?.from ? startOfDay(dateRange.from).getTime() : null;
    const to = dateRange?.to ? endOfDay(dateRange.to).getTime() : null;

    return ordersData
      .filter((order) => (statusFilter === 'all' ? true : order.orderStatus === statusFilter))
      .filter((order) =>
        orderTypeFilter === 'all' ? true : order.orderType === orderTypeFilter,
      )
      .filter((order) =>
        tabFilters.find((tab) => tab.value === tabFilter)?.match(order) ?? true,
      )
      .filter((order) => {
        if (!from || !to) return true;
        const created = new Date(order.createdAt).getTime();
        return created >= from && created <= to;
      })
      .filter((order) =>
        secondaryFilters.paymentStatus === 'all'
          ? true
          : order.paymentStatus === secondaryFilters.paymentStatus,
      )
      .filter((order) =>
        secondaryFilters.escrowStatus === 'all'
          ? true
          : order.escrowStatus === secondaryFilters.escrowStatus,
      )
      .filter((order) =>
        secondaryFilters.orderNo
          ? order.id.toLowerCase().includes(secondaryFilters.orderNo.toLowerCase())
          : true,
      )
      .filter((order) =>
        secondaryFilters.buyer
          ? order.buyer.name.toLowerCase().includes(secondaryFilters.buyer.toLowerCase())
          : true,
      )
      .filter((order) =>
        secondaryFilters.seller
          ? order.seller.name.toLowerCase().includes(secondaryFilters.seller.toLowerCase())
          : true,
      )
      .filter((order) =>
        secondaryFilters.region
          ? (order.buyerCompany?.country || '')
              .toLowerCase()
              .includes(secondaryFilters.region.toLowerCase())
          : true,
      )
      .filter((order) =>
        searchQuery
          ? [
              order.id,
              order.internalId,
              order.buyer.name,
              order.buyer.email,
              order.seller.name,
              order.buyerCompany?.name,
            ]
              .filter(Boolean)
              .some((field) => field.toLowerCase().includes(searchQuery.toLowerCase()))
          : true,
      );
  }, [statusFilter, orderTypeFilter, tabFilter, secondaryFilters, searchQuery]);

  const hasError = Boolean(error);
  const isEmpty = !hasError && !isLoading && filteredOrders.length === 0;

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 400);
  };

  const handleSecondaryFilterChange = (key, value) => {
    setSecondaryFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSecondaryReset = () => {
    setSecondaryFilters({
      orderNo: '',
      buyer: '',
      seller: '',
      paymentStatus: 'all',
      escrowStatus: 'all',
      region: '',
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrders(filteredOrders.map((order) => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectRow = (orderId, checked) => {
    setSelectedOrders((prev) => {
      if (checked) {
        return prev.includes(orderId) ? prev : [...prev, orderId];
      }
      return prev.filter((id) => id !== orderId);
    });
  };

  const selectionCount = selectedOrders.length;
  const allSelected =
    filteredOrders.length > 0 && selectionCount === filteredOrders.length;

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

  return (
    <div className="app-content py-6">
      <Container className="max-w-[1440px] space-y-8">
        <section className="rounded-2xl border border-border bg-card/60 p-5 shadow-xs shadow-black/5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href="/cms/dashboard">Home</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Sipariş Yönetimi</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div>
                <p className="text-sm font-medium text-primary">CMS</p>
                <h1 className="text-2xl font-semibold tracking-tight">Sipariş Yönetimi</h1>
                <p className="text-sm text-muted-foreground">
                  Platformdaki tüm siparişlerin merkezi yönetimi
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
                  <Label>Sipariş Tipi</Label>
                  <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tip" />
                    </SelectTrigger>
                    <SelectContent>
                      {orderTypeOptions.map((option) => (
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
                  <Label>Sipariş Ara</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Sipariş no, alıcı, satıcı, firma adı..."
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
            <BulkActionsBar count={selectionCount} onClear={() => setSelectedOrders([])} />
          )}

          <Card className="border border-border/70">
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Sipariş Listesi</CardTitle>
                <CardDescription>
                  Hem alıcı hem satıcı perspektifinden tüm siparişler
                </CardDescription>
              </div>
              <CardToolbar className="flex flex-wrap items-center gap-2">
                <Select value={viewMode} onValueChange={setViewMode}>
                  <SelectTrigger className="w-40">
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
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </CardToolbar>
            </CardHeader>

            <CardContent className="space-y-4">
              <SecondaryFiltersRow
                filters={secondaryFilters}
                onChange={handleSecondaryFilterChange}
                onReset={handleSecondaryReset}
              />

              {hasError && (
                <Alert variant="destructive">
                  <AlertTitle>Hata</AlertTitle>
                  <AlertDescription>
                    {error}
                    <Button size="sm" className="ms-3" onClick={handleRetry}>
                      Yeniden Dene
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {isLoading ? (
                <TableSkeleton rows={6} columns={8} />
              ) : isEmpty ? (
                <EmptyState onReset={handleSecondaryReset} />
              ) : viewMode === 'table' ? (
                <OrdersTable
                  orders={filteredOrders}
                  selectedOrders={selectedOrders}
                  onSelectRow={handleSelectRow}
                  onSelectAll={handleSelectAll}
                  allSelected={allSelected}
                />
              ) : (
                <CompactOrdersView
                  orders={filteredOrders}
                  mode={viewMode}
                  selectedOrders={selectedOrders}
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

function OrdersTable({ orders, selectedOrders, onSelectRow, onSelectAll, allSelected }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                aria-label="Select all orders"
                onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
              />
            </TableHead>
            <TableHead>Sipariş No</TableHead>
            <TableHead>Tarih</TableHead>
            <TableHead>Alıcı</TableHead>
            <TableHead>Alıcı Firma</TableHead>
            <TableHead>Satıcı Firma</TableHead>
            <TableHead>Tip</TableHead>
            <TableHead>Toplam</TableHead>
            <TableHead>Ödeme</TableHead>
            <TableHead>Sipariş Durumu</TableHead>
            <TableHead>Escrow</TableHead>
            <TableHead>Aksiyonlar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className="align-top">
              <TableCell>
                <Checkbox
                  checked={selectedOrders.includes(order.id)}
                  onCheckedChange={(checked) => onSelectRow(order.id, Boolean(checked))}
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <Link
                    href={`/cms/orders/${order.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {order.id}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    #{order.internalId}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm font-medium">
                  {format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm')}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col text-sm">
                  <span className="font-semibold">{order.buyer.name}</span>
                  <span className="text-xs text-muted-foreground">{order.buyer.email}</span>
                </div>
              </TableCell>
              <TableCell>
                {order.buyerCompany ? (
                  <div className="flex flex-col text-sm">
                    <span className="font-semibold">{order.buyerCompany.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {order.buyerCompany.taxId} • {order.buyerCompany.country}
                    </span>
                  </div>
                ) : (
                  <Badge size="sm" appearance="light">
                    Bireysel
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col text-sm">
                  <span className="font-semibold">{order.seller.name}</span>
                  <span className="text-xs text-muted-foreground">{order.seller.id}</span>
                </div>
                <Badge
                  size="xs"
                  appearance="light"
                  className="mt-1"
                  variant={mapSellerVariant(order.seller.status)}
                >
                  {order.seller.status}
                </Badge>
              </TableCell>
              <TableCell>
                <StatusBadge meta={orderTypeMeta[order.orderType]} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-semibold">
                    {formatCurrency(order.amount, order.currency)}
                  </span>
                  <span className="text-xs text-muted-foreground">{order.currency}</span>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge meta={paymentMeta[order.paymentStatus]} />
              </TableCell>
              <TableCell>
                <StatusBadge meta={orderStatusMeta[order.orderStatus]} />
              </TableCell>
              <TableCell>
                <StatusBadge meta={escrowStatusMeta[order.escrowStatus]} />
              </TableCell>
              <TableCell>
                <ActionMenu
                  orderId={order.id}
                  sellerId={order.seller.id}
                  buyerId={order.buyerId}
                  escrowId={order.escrowId}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CompactOrdersView({ orders, mode, selectedOrders, onSelectRow }) {
  if (mode === 'grouping') {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
        Grup görünümü yakında kullanılabilir olacak. Şimdilik tablo veya kompakt görünümü
        kullanabilirsiniz.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {orders.map((order) => (
        <div
          key={order.id}
          className="rounded-xl border border-border/70 p-4 shadow-sm shadow-black/5"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Checkbox
              checked={selectedOrders.includes(order.id)}
              onCheckedChange={(checked) => onSelectRow(order.id, Boolean(checked))}
            />
            <div className="flex flex-col">
              <Link href={`/cms/orders/${order.id}`} className="font-semibold text-primary">
                {order.id}
              </Link>
              <span className="text-xs text-muted-foreground">
                {format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm')}
              </span>
            </div>
            <Badge appearance="light" size="sm">
              {orderTypeMeta[order.orderType]?.label}
            </Badge>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Alıcı</p>
              <p className="font-medium">{order.buyer.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Satıcı</p>
              <p className="font-medium">{order.seller.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tutar</p>
              <p className="font-semibold">
                {formatCurrency(order.amount, order.currency)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge meta={paymentMeta[order.paymentStatus]} />
              <StatusBadge meta={orderStatusMeta[order.orderStatus]} />
              <StatusBadge meta={escrowStatusMeta[order.escrowStatus]} />
            </div>
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
          placeholder="Sipariş No"
          value={filters.orderNo}
          onChange={(event) => onChange('orderNo', event.target.value)}
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
        <Select
          value={filters.paymentStatus}
          onValueChange={(value) => onChange('paymentStatus', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Ödeme Durumu" />
          </SelectTrigger>
          <SelectContent>
            {paymentStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.escrowStatus}
          onValueChange={(value) => onChange('escrowStatus', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Escrow Durumu" />
          </SelectTrigger>
          <SelectContent>
            {escrowStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Ülke / Bölge"
          value={filters.region}
          onChange={(event) => onChange('region', event.target.value)}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onReset}>
          Filtreleri Temizle
        </Button>
      </div>
    </div>
  );
}

function BulkActionsBar({ count, onClear }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
      <div>
        <span className="font-semibold text-primary">{count} sipariş</span> seçildi
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary">
          Durumu Toplu Güncelle
        </Button>
        <Button size="sm" variant="outline">
          Seçilileri Dışa Aktar
        </Button>
        <Button size="sm" variant="outline">
          Etiket Ekle
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Seçimi Temizle
        </Button>
      </div>
    </div>
  );
}

function ActionMenu({ orderId, sellerId, buyerId, escrowId }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href={`/cms/orders/${orderId}`}>Detayı Gör</Link>
        </DropdownMenuItem>
        <DropdownMenuItem>Durum Güncelle</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/cms/escrow/${escrowId || orderId}`}>Escrow Detayı</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/cms/users/${buyerId || orderId}`}>Alıcı Profili</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/cms/companies/${sellerId}`}>Satıcı Profili</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusBadge({ meta }) {
  if (!meta) return null;
  return (
    <Badge size="sm" appearance="light" variant={meta.variant}>
      {meta.label}
    </Badge>
  );
}

function TableSkeleton({ rows = 5, columns = 6 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
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
      <p className="text-base font-semibold">Gösterilecek sipariş bulunamadı</p>
      <p className="text-sm text-muted-foreground">
        Filtreleri değiştirerek yeniden deneyin.
      </p>
      <Button size="sm" onClick={onReset}>
        Tüm filtreleri sıfırla
      </Button>
    </div>
  );
}

function mapSellerVariant(status) {
  switch (status) {
    case 'Onaylı':
      return 'success';
    case 'Beklemede':
      return 'warning';
    case 'Askıda':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function formatCurrency(amount, currency) {
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency === 'TRY' ? 'TRY' : currency,
      currencyDisplay: 'narrowSymbol',
    }).format(amount);
  } catch (error) {
    return `${amount.toLocaleString('tr-TR')} ${currency}`;
  }
}
