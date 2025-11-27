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
  CardDescription,
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Filter, Plus } from 'lucide-react';

const categories = [
  { value: 'all', label: 'Tümü' },
  { value: 'account', label: 'Hesap' },
  { value: 'orders', label: 'Sipariş' },
  { value: 'returns', label: 'İade' },
  { value: 'payment', label: 'Ödeme' },
  { value: 'security', label: 'Güvenlik' },
];

const statusMeta = {
  active: { label: 'Aktif', variant: 'success' },
  draft: { label: 'Taslak', variant: 'secondary' },
  archived: { label: 'Arşiv', variant: 'outline' },
};

const channelMeta = {
  buyer: { label: 'Alıcı' },
  seller: { label: 'Satıcı' },
  both: { label: 'Tümü' },
};

const MOCK_FAQ_LIST = [
  {
    id: 'faq-1',
    category: 'orders',
    categoryLabel: 'Sipariş',
    question: 'Siparişimin durumunu nereden takip edebilirim?',
    answer:
      'Hesabım > Siparişlerim sayfasındaki ilgili siparişe tıklayarak kargo bilgilerini görebilirsiniz.',
    channel: 'buyer',
    language: 'tr-TR',
    status: 'active',
    sortOrder: 1,
    createdAt: '2025-03-10 14:22',
    updatedAt: '2025-03-12 09:10',
  },
  {
    id: 'faq-2',
    category: 'returns',
    categoryLabel: 'İade',
    question: 'Ürün iadesi yapmak için hangi adımları izlemeliyim?',
    answer:
      'İade Talebi Başlat butonuna tıklayın, iade nedeninizi seçin ve kargo etiketi oluşturun.',
    channel: 'buyer',
    language: 'tr-TR',
    status: 'active',
    sortOrder: 2,
    createdAt: '2025-03-10 14:40',
    updatedAt: '2025-03-10 14:40',
  },
  {
    id: 'faq-3',
    category: 'payment',
    categoryLabel: 'Ödeme',
    question: 'Satıcı ödemeleri escrow üzerinden nasıl serbest bırakılır?',
    answer:
      'Talep tamamlandığında satıcı panelindeki Escrow bölümünden serbest bırakma isteği gönderebilirsiniz.',
    channel: 'seller',
    language: 'tr-TR',
    status: 'draft',
    sortOrder: 3,
    createdAt: '2025-03-11 08:05',
    updatedAt: '2025-03-11 08:05',
  },
];

const defaultForm = {
  id: '',
  category: 'orders',
  categoryLabel: 'Sipariş',
  question: '',
  answer: '',
  channel: 'buyer',
  language: 'tr-TR',
  status: 'draft',
  sortOrder: 1,
  notes: '',
};

export default function CmsContentFaqPage() {
  const [language, setLanguage] = useState('tr-TR');
  const [channelFilter, setChannelFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tableChannel, setTableChannel] = useState('all');
  const [faqList, setFaqList] = useState(MOCK_FAQ_LIST);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(defaultForm);
  const [isCreate, setIsCreate] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      if (search.toLowerCase().includes('error')) {
        setError('SSS kayıtları yüklenirken bir hata oluştu.');
      }
      setIsLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [language, channelFilter, categoryFilter, statusFilter, tableChannel, search]);

  const filteredFaqs = useMemo(() => {
    return faqList
      .filter((item) => (language === 'all' ? true : item.language === language))
      .filter((item) => (channelFilter === 'all' ? true : item.channel === channelFilter || item.channel === 'both'))
      .filter((item) => (categoryFilter === 'all' ? true : item.category === categoryFilter))
      .filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter))
      .filter((item) =>
        tableChannel === 'all' ? true : item.channel === tableChannel || item.channel === 'both',
      )
      .filter((item) =>
        search
          ? item.question.toLowerCase().includes(search.toLowerCase()) ||
            item.answer.toLowerCase().includes(search.toLowerCase())
          : true,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [faqList, language, channelFilter, categoryFilter, statusFilter, tableChannel, search]);

  const previewFaqs = filteredFaqs.filter((item) => item.channel === 'buyer' || item.channel === 'both');

  const handleOpenSheet = (faq = defaultForm, mode = 'create') => {
    setIsCreate(mode === 'create');
    setActiveFaq(faq);
    setIsSheetOpen(true);
  };

  const handleSheetClose = () => {
    setIsSheetOpen(false);
    setActiveFaq(defaultForm);
  };

  const handleToggleStatus = (id) => {
    setFaqList((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === 'active' ? 'draft' : 'active',
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  };

  const handleArchive = (id) => {
    setFaqList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'archived' } : item)),
    );
  };

  const handleCopy = (faq) => {
    const newFaq = {
      ...faq,
      id: `faq-${Date.now()}`,
      question: `${faq.question} (kopya)`,
      status: 'draft',
      sortOrder: faq.sortOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setFaqList((prev) => [...prev, newFaq]);
  };

  const handleDelete = (id) => {
    setFaqList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    if (!activeFaq.question.trim() || !activeFaq.answer.trim()) {
      return;
    }

    if (isCreate) {
      const newFaq = {
        ...activeFaq,
        id: `faq-${Date.now()}`,
        categoryLabel: getCategoryLabel(activeFaq.category),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setFaqList((prev) => [...prev, newFaq]);
    } else {
      setFaqList((prev) =>
        prev.map((item) =>
          item.id === activeFaq.id
            ? {
                ...activeFaq,
                categoryLabel: getCategoryLabel(activeFaq.category),
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
    }

    handleSheetClose();
  };

  const formatStatus = (status) => statusMeta[status]?.label || status;

  const isEmpty = !isLoading && !error && filteredFaqs.length === 0;

  return (
    <div className="app-content py-6">
      <Container className="max-w-[1200px] space-y-6">
        <section className="rounded-2xl border border-border bg-card/60 p-5 shadow-xs shadow-black/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                    <BreadcrumbPage>İçerik Yönetimi</BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>SSS Yönetimi</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div>
                <p className="text-sm font-medium text-primary">Content</p>
                <h1 className="text-3xl font-semibold tracking-tight">SSS Yönetimi</h1>
                <p className="text-sm text-muted-foreground">
                  Tinnten için Sık Sorulan Sorular içeriğini kategori ve dil bazında yönet
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label>Dil</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Dil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tr-TR">tr-TR</SelectItem>
                      <SelectItem value="en-US">en-US</SelectItem>
                      <SelectItem value="all">Tümü</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Kanal</Label>
                  <Select value={channelFilter} onValueChange={setChannelFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kanal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Genel</SelectItem>
                      <SelectItem value="buyer">Alıcı</SelectItem>
                      <SelectItem value="seller">Satıcı</SelectItem>
                      <SelectItem value="both">Hem Alıcı Hem Satıcı</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => handleOpenSheet(defaultForm, 'create')}>
                  <Plus className="me-2 h-4 w-4" /> Yeni SSS Ekle
                </Button>
                <Button variant="ghost" asChild>
                  <Link href={`/accounts/support/faq?lang=${language}`}>Önizleme</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>SSS Filtreleri</CardTitle>
            <CardDescription>CMS içerisinden kategori ve arama filtreleri ile kayıtları daraltın.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category.value}
                  variant={categoryFilter === category.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryFilter(category.value)}
                >
                  {category.label}
                </Button>
              ))}
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Input
                placeholder="SSS içinde ara..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full sm:max-w-xs"
              />
              <Button variant="secondary" onClick={() => setSearch(search.trim())}>
                Ara
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>SSS Kayıtları</CardTitle>
            <CardDescription>Durum ve kanal filtreleri ile tüm kayıtları yönetin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Durum:</span>
                {['all', 'active', 'draft', 'archived'].map((state) => (
                  <Button
                    key={state}
                    variant={statusFilter === state ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => setStatusFilter(state)}
                  >
                    {state === 'all' ? 'Tümü' : formatStatus(state)}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Kanal:</span>
                {['all', 'buyer', 'seller', 'both'].map((state) => (
                  <Button
                    key={state}
                    variant={tableChannel === state ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => setTableChannel(state)}
                  >
                    {state === 'all' ? 'Tümü' : channelMeta[state]?.label}
                  </Button>
                ))}
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Hata</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-4">
                  {error}
                  <Button size="sm" onClick={() => setError(null)}>
                    Tekrar dene
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : isEmpty ? (
              <EmptyState onReset={() => {
                setStatusFilter('all');
                setTableChannel('all');
                setSearch('');
              }} />
            ) : (
              <FaqTable
                data={filteredFaqs}
                onEdit={(faq) => handleOpenSheet(faq, 'edit')}
                onToggleStatus={handleToggleStatus}
                onCopy={handleCopy}
                onArchive={handleArchive}
                onDelete={handleDelete}
              />
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>SSS Önizleme</CardTitle>
          <CardDescription>
            Seçili dil, kanal ve kategoriye göre kullanıcıların göreceği görünüm
          </CardDescription>
          </CardHeader>
          <CardContent>
            {previewFaqs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bu filtrelerle eşleşen önizleme kaydı bulunamadı.
              </p>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {previewFaqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger>
                      <span className="text-sm font-semibold">{faq.question}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm text-muted-foreground">{faq.answer}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => navigator.clipboard.writeText(faq.answer)}
                      >
                        Cevabı Kopyala
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </Container>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isCreate ? 'Yeni SSS Kaydı' : `SSS Düzenle – ${activeFaq.id}`}</SheetTitle>
            <SheetDescription>SSS kayıtlarını düzenleyin veya yeni içerikler ekleyin.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Soru</Label>
              <Input
                value={activeFaq.question}
                onChange={(event) =>
                  setActiveFaq((prev) => ({ ...prev, question: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Cevap</Label>
              <Textarea
                value={activeFaq.answer}
                onChange={(event) =>
                  setActiveFaq((prev) => ({ ...prev, answer: event.target.value }))
                }
                rows={4}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select
                  value={activeFaq.category}
                  onValueChange={(value) =>
                    setActiveFaq((prev) => ({
                      ...prev,
                      category: value,
                      categoryLabel: getCategoryLabel(value),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((item) => item.value !== 'all')
                      .map((item) => (
                        <SelectItem value={item.value} key={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kanal</Label>
                <Select
                  value={activeFaq.channel}
                  onValueChange={(value) =>
                    setActiveFaq((prev) => ({ ...prev, channel: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">Sadece Alıcı</SelectItem>
                    <SelectItem value="seller">Sadece Satıcı</SelectItem>
                    <SelectItem value="both">Alıcı + Satıcı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dil</Label>
                <Select
                  value={activeFaq.language}
                  onValueChange={(value) =>
                    setActiveFaq((prev) => ({ ...prev, language: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tr-TR">tr-TR</SelectItem>
                    <SelectItem value="en-US">en-US</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Durum</Label>
                <Select
                  value={activeFaq.status}
                  onValueChange={(value) =>
                    setActiveFaq((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Taslak</SelectItem>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="archived">Arşiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Sıra</Label>
                <Input
                  type="number"
                  value={activeFaq.sortOrder}
                  onChange={(event) =>
                    setActiveFaq((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Not / İç Açıklama</Label>
                <Textarea
                  value={activeFaq.notes || ''}
                  onChange={(event) =>
                    setActiveFaq((prev) => ({ ...prev, notes: event.target.value }))
                }
                  rows={2}
                />
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="ghost" onClick={handleSheetClose}>
              İptal
            </Button>
            <Button onClick={handleSave}>Kaydet</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FaqTable({ data, onEdit, onToggleStatus, onCopy, onArchive, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sıra</TableHead>
            <TableHead>Soru</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Dil</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Güncellendi</TableHead>
            <TableHead>Aksiyonlar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((faq) => (
            <TableRow key={faq.id} className="align-top">
              <TableCell className="font-semibold">{faq.sortOrder}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-semibold">{faq.question}</span>
                  <span className="text-xs text-muted-foreground">
                    {faq.categoryLabel} • {channelMeta[faq.channel]?.label || 'Genel'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge appearance="light" variant="outline">
                  {faq.categoryLabel}
                </Badge>
              </TableCell>
              <TableCell>{faq.language === 'tr-TR' ? 'TR' : 'EN'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge appearance="light" variant={statusMeta[faq.status]?.variant}>
                    {statusMeta[faq.status]?.label}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onToggleStatus(faq.id)}
                  >
                    {faq.status === 'active' ? 'Taslak Yap' : 'Aktif Et'}
                  </Button>
                </div>
              </TableCell>
              <TableCell>{faq.updatedAt}</TableCell>
              <TableCell>
                <FaqActions
                  faq={faq}
                  onEdit={onEdit}
                  onCopy={onCopy}
                  onArchive={onArchive}
                  onDelete={onDelete}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FaqActions({ faq, onEdit, onCopy, onArchive, onDelete }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => onEdit(faq)}>
        Düzenle
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onCopy(faq)}>
        Kopyala
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onArchive(faq.id)}>
        Arşivle
      </Button>
      <Button size="sm" variant="destructive" onClick={() => onDelete(faq.id)}>
        Sil
      </Button>
    </div>
  );
}

function TableSkeleton({ rows = 5, columns = 7 }) {
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
      <p className="text-base font-semibold">Bu filtrelerle eşleşen SSS kaydı bulunamadı.</p>
      <Button size="sm" onClick={onReset}>
        Filtreleri sıfırla
      </Button>
    </div>
  );
}

function getCategoryLabel(value) {
  return categories.find((item) => item.value === value)?.label ?? value;
}
