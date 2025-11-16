'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { KeenIcon } from '@/components/keenicons/keenicons';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  History,
} from 'lucide-react';

const orderStatusMeta = {
  new: { label: 'Yeni', variant: 'info' },
  pending_payment: { label: 'Ödeme Bekliyor', variant: 'warning' },
  preparing: { label: 'Hazırlanıyor', variant: 'info' },
  shipping: { label: 'Kargoda', variant: 'secondary' },
  completed: { label: 'Tamamlandı', variant: 'success' },
  cancelled: { label: 'İptal', variant: 'destructive' },
};

const paymentMeta = {
  paid: { label: 'Ödendi', variant: 'success' },
  pending: { label: 'Ödeme Bekliyor', variant: 'warning' },
  refunded: { label: 'İade Edildi', variant: 'secondary' },
};

const escrowMeta = {
  blocked: { label: 'Blokede', variant: 'info' },
  released: { label: 'Serbest Bırakıldı', variant: 'success' },
  dispute: { label: 'İhtilaflı', variant: 'destructive' },
  scheduled: { label: 'Planlı Ödeme', variant: 'secondary' },
};

const orderTypeMeta = {
  product: { label: 'Ürün', variant: 'primary' },
  service: { label: 'Hizmet', variant: 'info' },
  subscription: { label: 'Abonelik', variant: 'secondary' },
};

const stageOrder = ['new', 'pending_payment', 'preparing', 'shipping', 'completed'];

const messageFilters = [
  { value: 'all', label: 'Tümü' },
  { value: 'buyer', label: 'Alıcı' },
  { value: 'seller', label: 'Satıcı' },
  { value: 'admin', label: 'Admin' },
];

const mockOrderDetail = {
  order: {
    id: 'ORD-2025-001234',
    createdAt: '2025-03-12T14:32:00Z',
    orderType: 'product',
    channel: 'Web',
    note: 'Teslimat öncesi alıcıyla zaman penceresi teyit edilecek.',
    status: 'preparing',
    paymentStatus: 'paid',
    escrowStatus: 'blocked',
    stage: 'preparing',
  },
  buyer: {
    id: 'USR-18273',
    name: 'Ahmet Yılmaz',
    email: 'ahmet@example.com',
    phone: '+90 530 555 44 33',
    type: 'Bireysel',
    address: 'Balmumcu Mah. Barbaros Bulvarı, Beşiktaş / İstanbul',
  },
  seller: {
    id: 'SELL-9831',
    name: 'ABC Temizlik Hizmetleri',
    contact: 'Elif Demir',
    taxNo: 'TR1234567801',
    status: 'Onaylı',
    channel: 'Direkt',
  },
  lineItems: [
    {
      id: 'ITEM-1',
      name: 'Profesyonel Ofis Temizliği',
      sku: 'SRV-OFIS-001',
      type: 'service',
      quantityLabel: '3 gün',
      quantity: 3,
      unitPrice: 4500,
      subtotal: 13500,
      status: 'preparing',
      details: 'Maslak ofis katı, 2000 m² – gece vardiyası',
    },
    {
      id: 'ITEM-2',
      name: 'Yoğun Dezenfeksiyon Paketi',
      sku: 'SRV-DEZEN-009',
      type: 'service',
      quantityLabel: '1 uygulama',
      quantity: 1,
      unitPrice: 6900,
      subtotal: 6900,
      status: 'completed',
      details: 'Ekstra ULV sisleme ekipmanı kullanıldı.',
    },
    {
      id: 'ITEM-3',
      name: 'Temizlik Sarf Malzeme Seti',
      sku: 'PRD-TEM-120',
      type: 'product',
      quantityLabel: '5 adet',
      quantity: 5,
      unitPrice: 820,
      subtotal: 4100,
      status: 'preparing',
      details: 'Latex eldiven, dezenfektan, mop, kıyafet setleri',
    },
  ],
  totals: {
    subtotal: 24500,
    vat: 4410,
    commission: 1800,
    discount: 1250,
    serviceFee: 850,
    total: 30610,
    collected: 30610,
    sellerPayout: 27100,
  },
  payment: {
    method: 'Kredi Kartı',
    provider: 'iyzico',
    transactionId: 'TRX-993844',
    paidAt: '2025-03-12T14:35:00Z',
    installment: 'Tek Çekim',
    secure3d: true,
    referenceCode: 'AUTH-8832',
  },
  escrow: {
    id: 'ESC-50110',
    status: 'blocked',
    total: 27100,
    releasePlan: [
      {
        name: 'Başlangıç Avansı',
        amount: 9000,
        plannedAt: '2025-03-18T12:00:00Z',
        releasedAt: null,
        status: 'Bekliyor',
      },
      {
        name: 'Hizmet Tamamlandı',
        amount: 12100,
        plannedAt: '2025-03-25T12:00:00Z',
        releasedAt: null,
        status: 'Bekliyor',
      },
      {
        name: 'Kontrol & Onay',
        amount: 6000,
        plannedAt: '2025-03-30T12:00:00Z',
        releasedAt: null,
        status: 'Planlandı',
      },
    ],
  },
  paymentHistory: [
    {
      id: 'PH-1',
      time: '2025-03-12T14:32:00Z',
      action: 'Ödeme talebi oluşturuldu',
      source: 'Sistem',
    },
    {
      id: 'PH-2',
      time: '2025-03-12T14:33:21Z',
      action: '3D Secure doğrulaması',
      source: 'Alıcı',
    },
    {
      id: 'PH-3',
      time: '2025-03-12T14:35:09Z',
      action: 'Ödeme başarılı',
      source: 'iyzico',
    },
  ],
  shipping: {
    type: 'Kargo',
    carrier: 'Yurtiçi Kargo',
    tracking: 'YK4321123TR',
    shippedAt: '2025-03-13T09:20:00Z',
    eta: '2025-03-15T18:00:00Z',
    status: 'Kargoda',
    trackUrl: 'https://yurticikargo.com/track/YK4321123TR',
  },
  service: {
    start: '2025-03-14T09:00:00Z',
    end: '2025-03-16T18:00:00Z',
    location: 'İstanbul, Maslak 1453',
    steps: [
      { id: 'svc-1', label: 'Planlama', done: true },
      { id: 'svc-2', label: 'Saha Ziyareti', done: true },
      { id: 'svc-3', label: 'Uygulama', done: false },
      { id: 'svc-4', label: 'Teslim / Rapor', done: false },
    ],
  },
  returnInfo: {
    requestedAt: '2025-03-20T11:05:00Z',
    reason: 'Son teslim tarihlerinde revizyon talep edildi.',
    status: 'Talep Alındı',
    requestId: 'RET-5566',
  },
  messages: [
    {
      id: 'MSG-1',
      role: 'buyer',
      author: 'Ahmet Yılmaz',
      time: '2025-03-13T08:10:00Z',
      message: 'Temizlik ekibinin giriş kartı teslimi için güvenlik ofisinden destek alabilirsiniz.',
    },
    {
      id: 'MSG-2',
      role: 'seller',
      author: 'ABC Operasyon',
      time: '2025-03-13T09:45:00Z',
      message: 'Ekip 10:00’da sahada olacak. Teslimat listesi hazırlandı.',
    },
    {
      id: 'MSG-3',
      role: 'admin',
      author: 'Tinnten Support',
      time: '2025-03-14T07:30:00Z',
      message: 'Escrow serbest bırakma planı için alıcı onayı bekleniyor.',
    },
  ],
  notes: [
    {
      id: 'NOTE-1',
      author: 'Admin • Ezgi Çetin',
      time: '2025-03-13T12:20:00Z',
      visibility: 'Sadece Admin',
      text: 'Satıcı tarafında saha ekibi değişikliği oldu, yeni ekip bilgileri CRM’de güncellendi.',
    },
  ],
  timeline: [
    {
      id: 'TL-1',
      time: '2025-03-12T14:32:00Z',
      actor: 'System',
      action: 'Sipariş oluşturuldu',
      description: 'Kanal: Web',
    },
    {
      id: 'TL-2',
      time: '2025-03-12T14:35:09Z',
      actor: 'iyzico',
      action: 'Ödeme başarılı',
      description: 'Transaction ID: TRX-993844',
    },
    {
      id: 'TL-3',
      time: '2025-03-13T09:20:00Z',
      actor: 'ABC Operasyon',
      action: 'Kargo bilgisi girildi',
      description: 'Yurtiçi Kargo • YK4321123TR',
    },
    {
      id: 'TL-4',
      time: '2025-03-13T10:10:00Z',
      actor: 'Tinnten Admin',
      action: 'Sipariş durumu Hazırlanıyor olarak güncellendi',
      description: 'Ek not: Malzeme tedariği tamamlandı.',
    },
  ],
  risks: [
    {
      id: 'risk-1',
      level: 'warning',
      text: 'Bu alıcı son 30 günde 2 iade talebi oluşturdu.',
      href: '/cms/orders/list?buyerId=USR-18273&filter=returns',
    },
    {
      id: 'risk-2',
      level: 'info',
      text: 'Escrow süresi dolmasına 2 gün kaldı.',
      href: '/cms/escrow/ESC-50110',
    },
  ],
};

export default function CmsOrdersIdPage() {
  const [orderData, setOrderData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [messageFilter, setMessageFilter] = useState('all');
  const [notes, setNotes] = useState([]);
  const [noteValue, setNoteValue] = useState('');
  const [noteVisibility, setNoteVisibility] = useState('Sadece Admin');
  const [expandedRows, setExpandedRows] = useState([]);
  const [workflowStage, setWorkflowStage] = useState('preparing');

  useEffect(() => {
    const timer = setTimeout(() => {
      setOrderData(mockOrderDetail);
      setNotes(mockOrderDetail.notes);
      setWorkflowStage(mockOrderDetail.order.stage);
      setIsLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  const summaryMessages = useMemo(() => {
    if (!orderData) return [];
    return orderData.messages.filter((message) =>
      messageFilter === 'all' ? true : message.role === messageFilter,
    );
  }, [orderData, messageFilter]);

  const toggleRow = (id) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id],
    );
  };

  const handleAddNote = () => {
    if (!noteValue.trim()) return;
    const newNote = {
      id: `NOTE-${notes.length + 1}`,
      author: 'Admin • Siz',
      time: new Date().toISOString(),
      visibility: noteVisibility,
      text: noteValue.trim(),
    };
    setNotes((prev) => [newNote, ...prev]);
    setNoteValue('');
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      setOrderData(mockOrderDetail);
      setNotes(mockOrderDetail.notes);
      setIsLoading(false);
    }, 500);
  };

  if (error) {
    return (
      <div className="app-content py-6">
        <Container className="max-w-[1440px]">
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertTitle>Sipariş bilgileri yüklenemedi.</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.
              <Button size="sm" onClick={handleRetry}>
                Tekrar dene
              </Button>
            </AlertDescription>
          </Alert>
        </Container>
      </div>
    );
  }

  if (isLoading || !orderData) {
    return <OrderDetailSkeleton />;
  }

  const { order, buyer, seller, lineItems, totals, payment, escrow, paymentHistory, shipping, service, returnInfo, timeline, risks } =
    orderData;

  const headerSubtitle = `Alıcı: ${buyer.name} • Satıcı: ${seller.name} • Durum: ${
    orderStatusMeta[order.status]?.label || 'Bilinmiyor'
  }`;

  const summarySubtitle = `Oluşturulma: ${formatDateTime(order.createdAt)} • Tip: ${
    orderTypeMeta[order.orderType]?.label || 'Sipariş'
  } • Kanal: ${order.channel}`;

  const orderStageIndex = stageOrder.findIndex((stage) => stage === workflowStage);

  return (
    <div className="app-content py-6">
      <Container className="max-w-[1440px] space-y-6">
        <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-xs shadow-black/5 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                    <BreadcrumbLink asChild>
                      <Link href="/cms/orders/list">Sipariş Yönetimi</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{order.id}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <div className="space-y-2">
                <p className="text-sm font-medium text-primary">CMS</p>
                <h1 className="text-3xl font-semibold leading-tight">
                  Sipariş #{order.id}
                </h1>
                <p className="text-sm text-muted-foreground">{headerSubtitle}</p>
                <p className="text-sm text-muted-foreground">{summarySubtitle}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge appearance="light" variant={orderTypeMeta[order.orderType]?.variant}>
                  {orderTypeMeta[order.orderType]?.label}
                </Badge>
                <Badge appearance="light" variant={paymentMeta[order.paymentStatus]?.variant}>
                  {paymentMeta[order.paymentStatus]?.label}
                </Badge>
                <Badge appearance="light" variant={escrowMeta[order.escrowStatus]?.variant}>
                  {escrowMeta[order.escrowStatus]?.label}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col lg:items-end">
              <Button className="w-full sm:w-auto" size="lg">
                <KeenIcon icon="arrow-right-left" className="me-2 text-base" />
                Sipariş Durumunu Güncelle
              </Button>
              <Button variant="secondary" className="w-full sm:w-auto" size="lg">
                <KeenIcon icon="lock-3" className="me-2 text-base" />
                Escrow İşlemi
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" className="w-full sm:w-auto" size="lg">
                  <KeenIcon icon="file-down" className="me-2 text-base" />
                  PDF / Fatura
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <KeenIcon icon="dots-vertical" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Siparişi Kopyala</DropdownMenuItem>
                    <DropdownMenuItem>Riskli Olarak İşaretle</DropdownMenuItem>
                    <DropdownMenuItem>Not Ekle</DropdownMenuItem>
                    <DropdownMenuItem>Logları Gör</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Sipariş Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="Sipariş No" value={order.id} />
              <InfoRow label="Oluşturulma" value={formatDateTime(order.createdAt)} />
              <InfoRow label="Sipariş Tipi" value={orderTypeMeta[order.orderType]?.label} />
              <InfoRow label="Kaynak Kanal" value={order.channel} />
              <InfoRow label="Para Birimi" value="TRY" />
              <InfoRow
                label="Sipariş Notu"
                value={order.note}
                multiline
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alıcı</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="Ad Soyad" value={buyer.name} />
              <InfoRow label="Kullanıcı ID" value={buyer.id} />
              <InfoRow label="Email" value={buyer.email} />
              <InfoRow label="Telefon" value={buyer.phone} />
              <InfoRow label="Alıcı Tipi" value={buyer.type} />
              <InfoRow label="Teslimat Adresi" value={buyer.address} multiline />
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/cms/users/${buyer.id}`}>Kullanıcı Profiline Git</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/cms/orders/list?buyerId=${buyer.id}`}>Alıcı Geçmişi</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Satıcı</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="Firma Adı" value={seller.name} />
              <InfoRow label="Firma ID" value={seller.id} />
              <InfoRow label="Yetkili" value={seller.contact} />
              <InfoRow label="Vergi No" value={seller.taxNo} />
              <InfoRow label="Satıcı Durumu" value={seller.status} />
              <InfoRow label="Satıcı Kanalı" value={seller.channel} />
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/cms/companies/${seller.id}`}>Firma Profiline Git</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/cms/orders/list?sellerId=${seller.id}`}>
                  Firma Siparişleri
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2">
                  <CardTitle>Ana Bilgiler</CardTitle>
                  <CardDescription>
                    Siparişe ait kalemler, ödemeler, teslimat ve iletişim detayları
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                  <TabsList className="w-full flex-wrap justify-start overflow-x-auto">
                    <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
                    <TabsTrigger value="payments">Ödeme & Escrow</TabsTrigger>
                    <TabsTrigger value="delivery">Teslimat / Hizmet Durumu</TabsTrigger>
                    <TabsTrigger value="messages">Mesajlar & Notlar</TabsTrigger>
                    <TabsTrigger value="logs">Log & Zaman Çizelgesi</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-6">
                    <LineItemsTable
                      items={lineItems}
                      expandedRows={expandedRows}
                      onToggle={toggleRow}
                    />
                    <OrderTotalsCard totals={totals} />
                  </TabsContent>

                  <TabsContent value="payments" className="space-y-6">
                    <PaymentSummary payment={payment} paymentStatus={order.paymentStatus} />
                    <EscrowPlan escrow={escrow} />
                    <PaymentHistory history={paymentHistory} />
                  </TabsContent>

                  <TabsContent value="delivery" className="space-y-6">
                    <DeliveryInfo shipping={shipping} />
                    <ServiceInfo service={service} />
                    <ReturnInfo info={returnInfo} />
                  </TabsContent>

                  <TabsContent value="messages" className="space-y-6">
                    <MessagesPanel
                      messages={summaryMessages}
                      allMessages={orderData.messages}
                      filter={messageFilter}
                      onFilterChange={setMessageFilter}
                    />
                    <NotesPanel
                      notes={notes}
                      value={noteValue}
                      onChange={setNoteValue}
                      visibility={noteVisibility}
                      onVisibilityChange={setNoteVisibility}
                      onAdd={handleAddNote}
                    />
                  </TabsContent>

                  <TabsContent value="logs">
                    <Timeline timeline={timeline} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:col-span-4">
            <StatusPanel
              statusMeta={orderStatusMeta[order.status]}
              workflowStage={workflowStage}
              onChangeStage={setWorkflowStage}
              stageIndex={orderStageIndex}
            />
            <RiskAlertsCard risks={risks} />
            <QuickActions buyer={buyer} seller={seller} />
          </div>
        </section>
      </Container>
    </div>
  );
}

function InfoRow({ label, value, multiline }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('font-medium text-foreground', multiline && 'whitespace-pre-wrap')}>
        {value}
      </p>
    </div>
  );
}

function LineItemsTable({ items, expandedRows, onToggle }) {
  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>Sipariş Kalemleri</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Ürün / Hizmet</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Adet / Süre</TableHead>
                <TableHead>Birim Fiyat</TableHead>
                <TableHead>Ara Toplam</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <TableRow key={item.id} className="align-top">
                    <TableCell className="w-8">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onToggle(item.id)}
                      >
                        {expandedRows.includes(item.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground">{item.sku}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge size="sm" appearance="light" variant={item.type === 'product' ? 'primary' : 'info'}>
                        {item.type === 'product' ? 'Ürün' : 'Hizmet'}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.quantityLabel}</TableCell>
                    <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell>{formatCurrency(item.subtotal)}</TableCell>
                    <TableCell>
                      <Badge appearance="light" variant={item.status === 'completed' ? 'success' : 'secondary'}>
                        {item.status === 'completed' ? 'Tamamlandı' : 'Hazırlanıyor'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {expandedRows.includes(item.id) && (
                    <TableRow key={`${item.id}-details`}>
                      <TableCell colSpan={7}>
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                          {item.details}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderTotalsCard({ totals }) {
  const rows = [
    { label: 'Ara Toplam', value: totals.subtotal },
    { label: 'KDV', value: totals.vat },
    { label: 'Komisyon', value: totals.commission },
    { label: 'İndirimler', value: -totals.discount },
    { label: 'Kargo / Hizmet Ücreti', value: totals.serviceFee },
    { label: 'Toplam Tutar', value: totals.total, highlight: true },
    { label: 'Alıcıdan Tahsil Edilen', value: totals.collected },
    { label: 'Satıcıya Ödenecek', value: totals.sellerPayout },
  ];

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>Özet Tutar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className={cn('text-muted-foreground', row.highlight && 'text-foreground font-semibold')}>
              {row.label}
            </span>
            <span className={cn('font-medium', row.highlight && 'text-lg')}>
              {formatCurrency(row.value)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PaymentSummary({ payment, paymentStatus }) {
  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>Ödeme Özeti</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 text-sm">
          <InfoRow label="Ödeme Durumu" value={paymentMeta[paymentStatus]?.label} />
          <InfoRow label="Ödeme Yöntemi" value={payment.method} />
          <InfoRow label="Ödeme Sağlayıcı" value={payment.provider} />
          <InfoRow label="Transaction ID" value={payment.transactionId} />
        </div>
        <div className="space-y-3 text-sm">
          <InfoRow label="Ödeme Tarihi" value={formatDateTime(payment.paidAt)} />
          <InfoRow label="Taksit" value={payment.installment} />
          <InfoRow label="3D Secure" value={payment.secure3d ? 'Evet' : 'Hayır'} />
          <InfoRow label="Referans" value={payment.referenceCode} />
        </div>
      </CardContent>
    </Card>
  );
}

function EscrowPlan({ escrow }) {
  if (!escrow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Escrow Planı</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Bu sipariş için aktif escrow kaydı yok.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Escrow Planı</CardTitle>
          <CardDescription>Escrow ID: {escrow.id}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <InfoRow label="Escrow Durumu" value={escrowMeta[escrow.status]?.label} />
        <InfoRow label="Toplam Escrow Tutarı" value={formatCurrency(escrow.total)} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Taksit / Milestone</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Planlanan</TableHead>
                <TableHead>Gerçekleşen</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {escrow.releasePlan.map((item) => (
                <TableRow key={item.name}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{formatCurrency(item.amount)}</TableCell>
                  <TableCell>{formatDateTime(item.plannedAt)}</TableCell>
                  <TableCell>{item.releasedAt ? formatDateTime(item.releasedAt) : '-'}</TableCell>
                  <TableCell>
                    <Badge appearance="light" variant="secondary">
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentHistory({ history }) {
  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>Ödeme İşlem Geçmişi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{item.action}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(item.time)} • {item.source}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DeliveryInfo({ shipping }) {
  if (!shipping) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Teslimat Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Bu sipariş için teslimat bilgisi bulunamadı.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>Teslimat Bilgileri</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
        <InfoRow label="Teslimat Tipi" value={shipping.type} />
        <InfoRow label="Kargo Firması" value={shipping.carrier} />
        <InfoRow label="Takip No" value={shipping.tracking} />
        <InfoRow label="Gönderim Tarihi" value={formatDateTime(shipping.shippedAt)} />
        <InfoRow label="Tahmini Teslim" value={formatDateTime(shipping.eta)} />
        <InfoRow label="Teslim Durumu" value={shipping.status} />
        <Button asChild variant="outline" size="sm" className="md:col-span-2">
          <Link href={shipping.trackUrl} target="_blank" rel="noreferrer">
            Kargo Takibini Aç <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ServiceInfo({ service }) {
  if (!service) {
    return null;
  }

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>Hizmet Durumu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <InfoRow label="Hizmet Başlangıç" value={formatDateTime(service.start)} />
          <InfoRow label="Hizmet Bitiş" value={formatDateTime(service.end)} />
          <InfoRow label="Lokasyon" value={service.location} multiline />
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Hizmet Aşamaları</p>
          <div className="space-y-2">
            {service.steps.map((step) => (
              <div key={step.id} className="flex items-center gap-3">
                <Checkbox checked={step.done} readOnly />
                <span className="text-sm font-medium">{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReturnInfo({ info }) {
  if (!info) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>İade / İptal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Bu sipariş için iade veya iptal talebi bulunmuyor.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>İade / İptal Bilgileri</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
        <InfoRow label="İade Talep Tarihi" value={formatDateTime(info.requestedAt)} />
        <InfoRow label="İade Durumu" value={info.status} />
        <InfoRow label="İade Nedeni" value={info.reason} multiline />
        <Button asChild size="sm" variant="outline">
          <Link href={`/cms/orders/returns/${info.requestId}`}>Return Request ID: {info.requestId}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function MessagesPanel({ messages, allMessages, filter, onFilterChange }) {
  const hasMessages = allMessages.length > 0;

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <div className="flex flex-col gap-2">
          <CardTitle>Mesajlar</CardTitle>
          <div className="flex flex-wrap gap-2">
            {messageFilters.map((item) => (
              <Button
                key={item.value}
                variant={filter === item.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onFilterChange(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasMessages && (
          <p className="text-sm text-muted-foreground">
            Bu sipariş için henüz mesaj yok.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'rounded-2xl border px-4 py-3 text-sm shadow-sm shadow-black/5',
              message.role === 'buyer' && 'border-primary/40 bg-primary/5',
              message.role === 'seller' && 'border-secondary/40 bg-secondary/5',
              message.role === 'admin' && 'border-info/40 bg-info/5',
            )}
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{message.author}</span>
              <span>{formatDateTime(message.time)}</span>
            </div>
            <p className="mt-2 text-foreground">{message.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NotesPanel({ notes, value, onChange, visibility, onVisibilityChange, onAdd }) {
  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>Yönetici Notları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Not ekleyin..."
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={visibility} onValueChange={onVisibilityChange}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Görünürlük" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sadece Admin">Sadece Admin</SelectItem>
                <SelectItem value="Admin + Satıcı">Admin + Satıcı</SelectItem>
                <SelectItem value="Admin + Alıcı">Admin + Alıcı</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={onAdd}>
              Notu Kaydet
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-xl border border-border/60 p-3 text-sm">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{note.author}</span>
                <span>{formatDateTime(note.time)}</span>
              </div>
              <p className="mt-2 text-foreground">{note.text}</p>
              <Badge appearance="light" variant="secondary" className="mt-2">
                {note.visibility}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Timeline({ timeline }) {
  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>Log & Zaman Çizelgesi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {timeline.map((event, idx) => (
          <div key={event.id} className="relative pl-10">
            {idx !== timeline.length - 1 && (
              <div className="absolute left-[18px] top-6 h-full border-l border-border" aria-hidden />
            )}
            <div className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted">
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">{event.action}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(event.time)} • {event.actor}
              </p>
              <p className="text-sm text-muted-foreground">{event.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StatusPanel({ statusMeta, workflowStage, onChangeStage, stageIndex }) {
  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>Sipariş Durumu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge appearance="light" variant={statusMeta?.variant} className="text-lg">
          {statusMeta?.label}
        </Badge>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">İlerleme</p>
          <div className="flex justify-between text-xs text-muted-foreground">
            {stageOrder.map((stage) => (
              <span key={stage}>{orderStatusMeta[stage]?.label || stage}</span>
            ))}
          </div>
          <Progress value={((stageIndex + 1) / stageOrder.length) * 100} />
        </div>
        <div className="space-y-2">
          <Select value={workflowStage} onValueChange={onChangeStage}>
            <SelectTrigger>
              <SelectValue placeholder="İşlem Aşaması" />
            </SelectTrigger>
            <SelectContent>
              {stageOrder.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {orderStatusMeta[stage]?.label || stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="w-full" variant="secondary">
            Durumu Güncelle
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskAlertsCard({ risks }) {
  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>Risk Uyarıları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {risks.map((risk) => (
          <div key={risk.id} className="rounded-xl border border-border/60 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span>{risk.level === 'warning' ? 'Uyarı' : 'Bilgi'}</span>
            </div>
            <p className="mt-1 text-foreground">{risk.text}</p>
            <Button variant="link" className="px-0" asChild>
              <Link href={risk.href}>Detayı Gör</Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function QuickActions({ buyer, seller }) {
  const actions = [
    { label: 'Alıcı Profiline Git', href: `/cms/users/${buyer.id}` },
    { label: 'Satıcı Profiline Git', href: `/cms/companies/${seller.id}` },
    { label: 'Bu Alıcının Tüm Siparişleri', href: `/cms/orders/list?buyerId=${buyer.id}` },
    { label: 'Bu Satıcının Tüm Siparişleri', href: `/cms/orders/list?sellerId=${seller.id}` },
    { label: 'Benzer Siparişleri Gör', href: '/cms/orders/list?channel=web&type=service' },
  ];

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle>Hızlı İşlemler</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <Button key={action.label} asChild variant="outline" className="w-full justify-start">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function OrderDetailSkeleton() {
  return (
    <div className="app-content py-6">
      <Container className="max-w-[1440px] space-y-6">
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-[600px] rounded-2xl lg:col-span-8" />
          <div className="space-y-4 lg:col-span-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </div>
      </Container>
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
