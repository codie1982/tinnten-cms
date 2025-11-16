'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ApexCharts from 'react-apexcharts';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { KeenIcon } from '@/components/keenicons/keenicons';
import {
  Activity,
  AlertTriangle,
  Info,
  Percent,
  RefreshCw,
} from 'lucide-react';

const dateRangeOptions = [
  { value: 'today', label: 'Bugün' },
  { value: 'last7', label: 'Son 7 gün' },
  { value: 'last30', label: 'Son 30 gün' },
  { value: 'thisMonth', label: 'Bu ay' },
  { value: 'custom', label: 'Özel' },
];

const channelOptions = [
  { value: 'all', label: 'Tümü' },
  { value: 'product', label: 'Ürün Satışı' },
  { value: 'service', label: 'Hizmet Satışı' },
  { value: 'offers', label: 'Teklifler' },
];

const funnelSegments = [
  { value: 'all', label: 'Tümü' },
  { value: 'product', label: 'Ürün' },
  { value: 'service', label: 'Hizmet' },
  { value: 'requests', label: 'Teklif' },
];

const kpiCards = [
  {
    id: 'orders',
    icon: 'basket',
    title: 'Toplam Siparişler',
    value: '1.248',
    subLabel: 'Son 7 günde',
    trend: '+12%',
    trendVariant: 'success',
    tooltip: 'Yayınlanan ve tamamlanan siparişlerin son 7 gündeki toplamı.',
    progress: 72,
  },
  {
    id: 'requests',
    icon: 'message-text-2',
    title: 'Aktif Teklif Talepleri',
    value: '87',
    subLabel: 'Yanıt bekleyen',
    trend: '-5%',
    trendVariant: 'destructive',
    tooltip: 'Alıcı yanıtını bekleyen açık teklif talepleri.',
    progress: 45,
  },
  {
    id: 'approvals',
    icon: 'shield-tick',
    title: 'Onay Bekleyen Firmalar',
    value: '14',
    subLabel: 'Satış başvurusu',
    tooltip:
      'KYC ve operasyon ekiplerinin onayını bekleyen yeni firma başvuruları.',
    progress: 58,
  },
  {
    id: 'escrow',
    icon: 'wallet',
    title: 'Toplam Escrow Bakiyesi',
    value: '₺ 328.450',
    subLabel: 'Blokeli tutar',
    trend: '+8%',
    trendVariant: 'success',
    tooltip: 'Escrow sisteminde blokeli tutulan toplam bakiye.',
    progress: 81,
  },
];

const funnelChartDataset = {
  all: {
    categories: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    series: [
      { name: 'Siparişler', data: [120, 135, 148, 160, 172, 158, 165] },
      { name: 'Teklifler', data: [90, 102, 110, 118, 130, 125, 120] },
      { name: 'Tamamlanan İşlemler', data: [70, 78, 86, 92, 105, 101, 108] },
    ],
  },
  product: {
    categories: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    series: [
      { name: 'Siparişler', data: [78, 92, 110, 118, 124, 119, 122] },
      { name: 'Teklifler', data: [54, 60, 68, 72, 85, 82, 80] },
      { name: 'Tamamlanan İşlemler', data: [41, 50, 58, 63, 68, 66, 70] },
    ],
  },
  service: {
    categories: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    series: [
      { name: 'Siparişler', data: [42, 44, 46, 50, 58, 52, 55] },
      { name: 'Teklifler', data: [32, 40, 42, 46, 52, 50, 48] },
      { name: 'Tamamlanan İşlemler', data: [21, 23, 26, 29, 37, 35, 34] },
    ],
  },
  requests: {
    categories: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    series: [
      { name: 'Siparişler', data: [38, 40, 43, 46, 52, 48, 50] },
      { name: 'Teklifler', data: [62, 70, 74, 78, 88, 85, 84] },
      { name: 'Tamamlanan İşlemler', data: [28, 30, 33, 36, 42, 40, 41] },
    ],
  },
};

const funnelSummaries = {
  all: [
    {
      id: 'completion',
      icon: Percent,
      label: 'Sipariş Tamamlama Oranı',
      value: '72%',
      delta: '+4%',
    },
    {
      id: 'conversion',
      icon: RefreshCw,
      label: 'Tekliften Siparişe Dönüşüm',
      value: '34%',
      delta: '+2%',
    },
    {
      id: 'disputes',
      icon: Activity,
      label: 'İptal / İade Oranı',
      value: '6%',
      delta: '-1%',
    },
  ],
  product: [
    { id: 'completion', icon: Percent, label: 'Tamamlama', value: '76%', delta: '+3%' },
    { id: 'conversion', icon: RefreshCw, label: 'Dönüşüm', value: '38%', delta: '+4%' },
    { id: 'disputes', icon: Activity, label: 'İptal Oranı', value: '4%', delta: '-2%' },
  ],
  service: [
    { id: 'completion', icon: Percent, label: 'Tamamlama', value: '64%', delta: '+1%' },
    { id: 'conversion', icon: RefreshCw, label: 'Dönüşüm', value: '29%', delta: '-1%' },
    { id: 'disputes', icon: Activity, label: 'İptal Oranı', value: '9%', delta: '+2%' },
  ],
  requests: [
    { id: 'completion', icon: Percent, label: 'Tamamlama', value: '57%', delta: '-3%' },
    { id: 'conversion', icon: RefreshCw, label: 'Dönüşüm', value: '31%', delta: '+1%' },
    { id: 'disputes', icon: Activity, label: 'İptal Oranı', value: '8%', delta: '0%' },
  ],
};

const operationsData = {
  orders: [
    {
      id: 'ORD-9421',
      company: 'Beta Lojistik',
      amount: '₺18.950',
      status: 'Yeni',
      statusVariant: 'info',
      date: '12:48',
    },
    {
      id: 'ORD-9410',
      company: 'Delta Medikal',
      amount: '₺42.300',
      status: 'Ödeme Bekliyor',
      statusVariant: 'warning',
      date: '11:05',
    },
    {
      id: 'ORD-9398',
      company: 'Nova Tekstil',
      amount: '₺9.780',
      status: 'Hazırlanıyor',
      statusVariant: 'secondary',
      date: '10:26',
    },
    {
      id: 'ORD-9384',
      company: 'Atlas Bilişim',
      amount: '₺65.420',
      status: 'Yeni',
      statusVariant: 'info',
      date: '09:58',
    },
    {
      id: 'ORD-9377',
      company: 'Perla Yapı',
      amount: '₺23.150',
      status: 'Ödeme Bekliyor',
      statusVariant: 'warning',
      date: '09:32',
    },
  ],
  requests: [
    {
      id: 'REQ-10421',
      requester: 'Saltus Enerji',
      summary: 'Adana OSB ek hat izolasyonu ve bakım desteği.',
      channel: 'Ürün Satışı',
      time: '10 dk önce',
    },
    {
      id: 'REQ-10398',
      requester: 'Lima Makine',
      summary: 'Yeni CNC üretim hattı için 3 yıllık bakım sözleşmesi.',
      channel: 'Teklifler',
      time: '25 dk önce',
    },
    {
      id: 'REQ-10382',
      requester: 'Ekin Ofis',
      summary: 'İzmir ofis komple boya ve temizlik servisi.',
      channel: 'Hizmet Satışı',
      time: '42 dk önce',
    },
    {
      id: 'REQ-10370',
      requester: 'Zenith Kimya',
      summary: 'Yüksek hacimli solvent satın alımı için teklif.',
      channel: 'Ürün Satışı',
      time: '1 saat önce',
    },
  ],
  companies: [
    {
      id: 'CMP-5683',
      name: 'Mavera Temizlik',
      category: 'Temizlik',
      type: 'Hizmet Sağlayıcı',
      status: 'KYC Bekliyor',
      statusVariant: 'warning',
    },
    {
      id: 'CMP-5679',
      name: 'Faro Lojistik',
      category: 'Nakliye',
      type: 'Satıcı',
      status: 'İncelemede',
      statusVariant: 'secondary',
    },
    {
      id: 'CMP-5674',
      name: 'Northbridge IT',
      category: 'IT Hizmeti',
      type: 'Satıcı',
      status: 'KYC Bekliyor',
      statusVariant: 'warning',
    },
    {
      id: 'CMP-5668',
      name: 'Riva Metal',
      category: 'Üretim',
      type: 'Satıcı',
      status: 'İncelemede',
      statusVariant: 'secondary',
    },
  ],
};

const escrowAlerts = [
  {
    id: 'escrow-1',
    level: 'critical',
    message: '3 işlemde escrow süresi dolmak üzere (2 gün kaldı)',
    href: '/cms/escrow/disputes',
  },
  {
    id: 'escrow-2',
    level: 'warning',
    message: '1 işlemde kullanıcı ihtilafı açtı',
    href: '/cms/escrow/disputes',
  },
  {
    id: 'escrow-3',
    level: 'info',
    message: '8 işlemde ödeme serbest bırakma talebi bekliyor',
    href: '/cms/escrow/releases',
  },
];

const escrowSummary = [
  { id: 'open', label: 'Toplam Açık İhtilaf', value: '4' },
  { id: 'release', label: 'Bekleyen Serbest Bırakma', value: '12' },
  { id: 'sla', label: 'Ortalama Çözüm Süresi', value: '2.3 gün' },
];

const planDistribution = {
  total: 482,
  enterprise: 73,
  breakdown: [
    { label: 'Free', value: 218 },
    { label: 'Starter', value: 142 },
    { label: 'Pro', value: 49 },
    { label: 'Enterprise', value: 73 },
  ],
};

const usageStats = [
  { id: 'quotes', label: 'Aylık Teklif Limiti', percent: 72 },
  { id: 'ai', label: 'AI Token Kullanımı', percent: 62 },
  { id: 'volume', label: 'İşlem Hacmi Limiti', percent: 53 },
  { id: 'api', label: 'Teklif API Calls', percent: 46 },
];

export default function CmsDashboardPage() {
  const [dateRange, setDateRange] = useState('last7');
  const [channel, setChannel] = useState('all');
  const [funnelSegment, setFunnelSegment] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 600);

    return () => clearTimeout(timer);
  }, [dateRange, channel, funnelSegment]);

  const isEmptyState = !isLoading && dateRange === 'custom';
  const funnelDataset = funnelChartDataset[funnelSegment] ??
    funnelChartDataset.all;
  const funnelSeries = funnelDataset.series;
  const funnelCategories = funnelDataset.categories;
  const summaries = funnelSummaries[funnelSegment] ?? funnelSummaries.all;

  const funnelChartOptions = useMemo(
    () => ({
      chart: {
        type: 'area',
        toolbar: { show: false },
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
      },
      colors: [
        'var(--color-primary)',
        'var(--color-info-accent,var(--color-blue-500))',
        'var(--color-success-accent,var(--color-green-500))',
      ],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3 },
      markers: { size: 0 },
      grid: {
        borderColor: 'var(--color-border)',
        strokeDashArray: 4,
        padding: { left: 0, right: 0 },
      },
      xaxis: {
        categories: funnelCategories,
        axisTicks: { show: false },
        axisBorder: { show: false },
        labels: {
          style: {
            colors: 'var(--color-muted-foreground)',
          },
        },
      },
      yaxis: {
        labels: {
          style: {
            colors: 'var(--color-muted-foreground)',
          },
        },
      },
      tooltip: { theme: 'dark' },
      legend: {
        position: 'top',
        horizontalAlign: 'left',
        markers: { shape: 'circle' },
        labels: { colors: 'var(--color-muted-foreground)' },
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
        },
      },
    }),
    [funnelCategories],
  );

  const planChartOptions = useMemo(
    () => ({
      chart: { type: 'donut' },
      dataLabels: { enabled: false },
      legend: {
        position: 'bottom',
        fontSize: '13px',
        labels: { colors: 'var(--color-muted-foreground)' },
      },
      stroke: { width: 0 },
      colors: [
        'var(--color-primary)',
        'var(--color-info-accent,var(--color-indigo-400))',
        'var(--color-warning-accent,var(--color-amber-500))',
        'var(--color-success-accent,var(--color-emerald-500))',
      ],
    }),
    [],
  );

  const planChartSeries = useMemo(
    () => planDistribution.breakdown.map((item) => item.value),
    [],
  );

  const handleExpandRange = () => setDateRange('last30');

  return (
    <div className="app-content py-6">
      <Container className="space-y-8">
        <section className="rounded-2xl border border-border bg-card/60 p-5 shadow-xs shadow-black/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
                    <BreadcrumbPage>Dashboard</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">CMS</p>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Tinnten yönetim paneli için genel özet ve canlı metrikler
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="grid w-full gap-3 sm:grid-cols-2 lg:flex lg:items-end lg:gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="date-range">Tarih Aralığı</Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger id="date-range">
                      <SelectValue placeholder="Aralık seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {dateRangeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="channel-filter">Kanal</Label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger id="channel-filter">
                      <SelectValue placeholder="Kanal seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {channelOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="button"
                className="justify-center lg:ms-2"
                onClick={() => console.log('export')}
              >
                <KeenIcon icon="download" className="me-2 text-base" />
                Rapor İndir
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((card) => (
              <KpiCard key={card.id} card={card} isLoading={isLoading} />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <FunnelCard
              isLoading={isLoading}
              isEmpty={isEmptyState}
              options={funnelChartOptions}
              series={funnelSeries}
              activeSegment={funnelSegment}
              onSegmentChange={setFunnelSegment}
              summaries={summaries}
              onEmptyAction={handleExpandRange}
            />

            <OperationsCard
              isLoading={isLoading}
              isEmpty={isEmptyState}
              data={operationsData}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <EscrowAlertsCard
              isLoading={isLoading}
              isEmpty={isEmptyState}
              alerts={escrowAlerts}
              summary={escrowSummary}
            />

            <SubscriptionCard
              isLoading={isLoading}
              isEmpty={isEmptyState}
              options={planChartOptions}
              series={planChartSeries}
              distribution={planDistribution}
              usage={usageStats}
              onResetFilters={handleExpandRange}
            />
          </div>
        </section>
      </Container>
    </div>
  );
}

function KpiCard({ card, isLoading }) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b-0 pb-0">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/5 text-primary">
            <KeenIcon icon={card.icon} className="text-lg" />
          </span>
          <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground transition hover:text-foreground"
            >
              <Info className="h-4 w-4" />
              <span className="sr-only">Metrik açıklaması</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{card.tooltip}</TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold">{card.value}</span>
              {card.trend && (
                <Badge
                  variant={card.trendVariant === 'success' ? 'success' : 'destructive'}
                  appearance="light"
                  size="sm"
                >
                  {card.trend}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{card.subLabel}</p>
          </>
        )}
        {isLoading ? (
          <Skeleton className="h-1.5 w-full" />
        ) : (
          <Progress value={card.progress} className="h-1.5" />
        )}
      </CardContent>
    </Card>
  );
}

function FunnelCard({
  isLoading,
  isEmpty,
  options,
  series,
  activeSegment,
  onSegmentChange,
  summaries,
  onEmptyAction,
}) {
  return (
    <Card className="xl:col-span-7">
      <CardHeader className="items-start gap-4">
        <div className="space-y-1">
          <CardTitle>Satış & Teklif Akışı</CardTitle>
          <CardDescription>Seçilen tarih aralığındaki dönüşüm</CardDescription>
        </div>
        <CardToolbar>
          <ToggleGroup
            type="single"
            value={activeSegment}
            onValueChange={(value) => value && onSegmentChange(value)}
            variant="outline"
            size="sm"
            className="flex-wrap"
          >
            {funnelSegments.map((segment) => (
              <ToggleGroupItem key={segment.value} value={segment.value}>
                {segment.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : isEmpty ? (
          <EmptyState
            message="Bu tarih aralığında veri bulunamadı."
            actionLabel="Tarih aralığını genişlet"
            onAction={onEmptyAction}
          />
        ) : (
          <ApexCharts options={options} series={series} type="area" height={320} />
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {summaries.map((summary) => (
            <div
              key={summary.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 p-3"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-primary">
                <summary.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{summary.label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{summary.value}</span>
                  {summary.delta && (
                    <Badge appearance="ghost" size="xs" variant="secondary">
                      {summary.delta}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OperationsCard({ isLoading, isEmpty, data }) {
  const orderStatus = {
    info: 'info',
    warning: 'warning',
    secondary: 'secondary',
  };

  return (
    <Card className="xl:col-span-5">
      <CardHeader>
        <div>
          <CardTitle>Canlı İş Listeleri</CardTitle>
          <CardDescription>En yeni sipariş, talep ve başvurular</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="orders">
          <TabsList variant="line" className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="orders">Yeni Siparişler</TabsTrigger>
            <TabsTrigger value="requests">Yeni Talepler</TabsTrigger>
            <TabsTrigger value="companies">Firma Başvuruları</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            {isLoading ? (
              <TableSkeleton rows={5} columns={5} />
            ) : isEmpty ? (
              <EmptyState message="Şu anda gösterilecek kayıt yok." />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Tutar</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Tarih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.id}</TableCell>
                        <TableCell>{order.company}</TableCell>
                        <TableCell>{order.amount}</TableCell>
                        <TableCell>
                          <Badge
                            variant={orderStatus[order.statusVariant] || 'secondary'}
                            appearance="light"
                            size="sm"
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="text-right text-sm">
                  <Link
                    href="/cms/orders/list?status=new"
                    className="font-medium text-primary hover:underline"
                  >
                    Tümünü görüntüle
                  </Link>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {isLoading ? (
              <ListSkeleton items={3} />
            ) : isEmpty ? (
              <EmptyState message="Şu anda gösterilecek kayıt yok." />
            ) : (
              <div className="space-y-3">
                {data.requests.map((request) => (
                  <Link
                    key={request.id}
                    href={`/cms/requests/inbox/${request.id}`}
                    className="flex flex-col gap-1.5 rounded-xl border border-border/70 p-3 transition hover:border-primary/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-sm">{request.requester}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge appearance="light" size="xs">
                          {request.channel}
                        </Badge>
                        <span>{request.time}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {request.summary}
                    </p>
                  </Link>
                ))}
                <div className="text-right text-sm">
                  <Link
                    href="/cms/requests/inbox"
                    className="font-medium text-primary hover:underline"
                  >
                    Tüm talepleri görüntüle
                  </Link>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="companies" className="space-y-4">
            {isLoading ? (
              <ListSkeleton items={4} />
            ) : isEmpty ? (
              <EmptyState message="Şu anda gösterilecek kayıt yok." />
            ) : (
              <div className="space-y-3">
                {data.companies.map((company) => (
                  <Link
                    key={company.id}
                    href={`/cms/company-approvals/applications/${company.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-3 transition hover:border-primary/40"
                  >
                    <div>
                      <p className="text-sm font-semibold">{company.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {company.category} • {company.type}
                      </p>
                    </div>
                    <Badge
                      variant={company.statusVariant}
                      appearance="light"
                      size="sm"
                    >
                      {company.status}
                    </Badge>
                  </Link>
                ))}
                <div className="text-right text-sm">
                  <Link
                    href="/cms/company-approvals/applications"
                    className="font-medium text-primary hover:underline"
                  >
                    Başvuruları görüntüle
                  </Link>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function EscrowAlertsCard({ isLoading, isEmpty, alerts, summary }) {
  const levelVariant = {
    critical: 'destructive',
    warning: 'warning',
    info: 'info',
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Escrow Uyarıları</CardTitle>
          <CardDescription>İhtilaflar, bekleyen serbest bırakmalar</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <ListSkeleton items={3} />
        ) : isEmpty ? (
          <EmptyState message="Bu tarih aralığı için risk kaydı yok." />
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={levelVariant[alert.level] || 'secondary'}
                    appearance="light"
                    size="sm"
                  >
                    {alert.level === 'critical'
                      ? 'Critical'
                      : alert.level === 'warning'
                        ? 'Warning'
                        : 'Info'}
                  </Badge>
                  <p className="text-sm font-medium">{alert.message}</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={alert.href}>Gör</Link>
                </Button>
              </div>
            ))}
          </div>
        )}

        {!isEmpty && !isLoading && (
          <div className="grid gap-3 border-t border-dashed border-border/70 pt-4 text-sm text-muted-foreground sm:grid-cols-3">
            {summary.map((item) => (
              <div key={item.id}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground/80">
                  {item.label}
                </p>
                <p className="text-base font-semibold text-foreground">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubscriptionCard({
  isLoading,
  isEmpty,
  options,
  series,
  distribution,
  usage,
  onResetFilters,
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Üyelik & Limit Durumu</CardTitle>
          <CardDescription>Plan kullanım oranları</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : isEmpty ? (
          <EmptyState
            message="Bu filtre kombinasyonunda üyelik verisi bulunamadı."
            actionLabel="Filtreleri temizle"
            onAction={onResetFilters}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Toplam aktif firma</p>
                <p className="text-2xl font-semibold">{distribution.total}</p>
                <p className="text-xs text-muted-foreground">
                  Pro üzeri: {distribution.enterprise}
                </p>
              </div>
              <ApexCharts options={options} series={series} type="donut" height={240} />
            </div>

            <div className="space-y-4">
              {usage.map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">%{item.percent}</span>
                  </div>
                  <Progress
                    value={item.percent}
                    className="h-2"
                    indicatorClassName="bg-primary"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ rows = 4, columns = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className={`grid gap-2 ${gridColumnsClass(columns)}`}
        >
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton key={`col-${colIndex}`} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

function gridColumnsClass(columns) {
  const map = {
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  };

  return map[columns] || 'grid-cols-4';
}

function ListSkeleton({ items = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="space-y-2 rounded-xl border border-border/70 p-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/40 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {actionLabel && (
        <Button size="sm" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
