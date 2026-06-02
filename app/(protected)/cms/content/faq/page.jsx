'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Filter, Globe, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
import { useTranslateMutation } from '@/redux/services';

const LOCALE_LABELS = {
  tr: 'Türkçe', en: 'English', de: 'Deutsch',
  ar: 'العربية', el: 'Ελληνικά', es: 'Español',
  fr: 'Français', it: 'Italiano', ru: 'Русский',
};

/* ─── options ─── */
const categoryOptions = [
  { value: 'all', label: 'Tüm Kategoriler' },
  { value: 'account', label: 'Hesap' },
  { value: 'orders', label: 'Sipariş' },
  { value: 'returns', label: 'İade' },
  { value: 'payment', label: 'Ödeme' },
  { value: 'security', label: 'Güvenlik' },
];
const channelOptions = [
  { value: 'all', label: 'Tüm Kanallar' },
  { value: 'buyer', label: 'Alıcı' },
  { value: 'seller', label: 'Satıcı' },
  { value: 'both', label: 'Her İkisi' },
];
const statusOptions = [
  { value: 'all', label: 'Tüm Durumlar' },
  { value: 'active', label: 'Aktif' },
  { value: 'draft', label: 'Taslak' },
  { value: 'archived', label: 'Arşiv' },
];

/* ─── meta ─── */
const statusMeta = {
  active: { label: 'Aktif', variant: 'success' },
  draft: { label: 'Taslak', variant: 'muted' },
  archived: { label: 'Arşiv', variant: 'secondary' },
};
const channelMeta = {
  buyer: { label: 'Alıcı', variant: 'primary' },
  seller: { label: 'Satıcı', variant: 'secondary' },
  both: { label: 'Her İkisi', variant: 'muted' },
};

/* ─── mock ─── */
const MOCK_FAQ = [
  { id: 'faq-1', category: 'orders', categoryLabel: 'Sipariş', question: 'Siparişimin durumunu nereden takip edebilirim?', answer: 'Hesabım > Siparişlerim sayfasındaki ilgili siparişe tıklayarak kargo bilgilerini görebilirsiniz.', channel: 'buyer', status: 'active', sortOrder: 1, updatedAt: '12.03.2025' },
  { id: 'faq-2', category: 'returns', categoryLabel: 'İade', question: 'Ürün iadesi yapmak için hangi adımları izlemeliyim?', answer: 'İade Talebi Başlat butonuna tıklayın, iade nedeninizi seçin ve kargo etiketi oluşturun.', channel: 'buyer', status: 'active', sortOrder: 2, updatedAt: '10.03.2025' },
  { id: 'faq-3', category: 'payment', categoryLabel: 'Ödeme', question: 'Satıcı ödemeleri escrow üzerinden nasıl serbest bırakılır?', answer: 'Talep tamamlandığında satıcı panelindeki Escrow bölümünden serbest bırakma isteği gönderebilirsiniz.', channel: 'seller', status: 'draft', sortOrder: 3, updatedAt: '11.03.2025' },
  { id: 'faq-4', category: 'account', categoryLabel: 'Hesap', question: 'KYC doğrulaması ne kadar sürer?', answer: 'KYC işlemi genellikle 1-3 iş günü içinde tamamlanır. Eksik belgeleriniz varsa email ile bilgilendirilirsiniz.', channel: 'both', status: 'active', sortOrder: 4, updatedAt: '08.03.2025' },
  { id: 'faq-5', category: 'security', categoryLabel: 'Güvenlik', question: 'İki faktörlü doğrulama (2FA) nasıl etkinleştirilir?', answer: 'Güvenlik ayarlarından Authenticator uygulamasını bağlayabilir veya SMS 2FA\'yı aktif edebilirsiniz.', channel: 'both', status: 'active', sortOrder: 5, updatedAt: '05.03.2025' },
  { id: 'faq-6', category: 'orders', categoryLabel: 'Sipariş', question: 'Satıcı siparişimi onaylamadı, ne yapmalıyım?', answer: 'Satıcının 48 saat içinde yanıt vermesi beklenir. Süre geçerse destek ekibimiz devreye girer.', channel: 'buyer', status: 'draft', sortOrder: 6, updatedAt: '02.03.2025' },
];

/* ─── inline edit form ─── */
function FaqForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const [translate, { isLoading: translating }] = useTranslateMutation();
  const [translations, setTranslations] = useState(null); // { en: { question, answer }, ... }
  const [transOpen, setTransOpen] = useState(false);

  const handleTranslate = async () => {
    if (!form.question.trim() && !form.answer.trim()) return;
    try {
      const [qRes, aRes] = await Promise.all([
        form.question.trim()
          ? translate({ text: form.question.trim(), context: 'FAQ question' }).unwrap()
          : Promise.resolve({ translations: {} }),
        form.answer.trim()
          ? translate({ text: form.answer.trim(), context: 'FAQ answer' }).unwrap()
          : Promise.resolve({ translations: {} }),
      ]);
      const merged = {};
      const locales = Object.keys({ ...qRes.translations, ...aRes.translations });
      for (const l of locales) {
        merged[l] = {
          question: qRes.translations?.[l] ?? '',
          answer: aRes.translations?.[l] ?? '',
        };
      }
      setTranslations(merged);
      setTransOpen(true);
    } catch {
      // hata sessizce geçer — kullanıcı tekrar deneyebilir
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
      <h3 className="font-semibold text-sm text-foreground">
        {initial.id ? 'SSS Düzenle' : 'Yeni SSS'}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Soru</label>
          <input
            value={form.question}
            onChange={(e) => { set('question', e.target.value); setTranslations(null); }}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            placeholder="Soru metni..."
          />
        </div>
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Cevap</label>
          <textarea
            value={form.answer}
            onChange={(e) => { set('answer', e.target.value); setTranslations(null); }}
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-none"
            placeholder="Cevap metni..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Kategori</label>
          <Select value={form.category} onValueChange={(v) => set('category', v)}>
            <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              {categoryOptions.filter((o) => o.value !== 'all').map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Kanal</label>
          <Select value={form.channel} onValueChange={(v) => set('channel', v)}>
            <SelectTrigger><SelectValue placeholder="Kanal" /></SelectTrigger>
            <SelectContent>
              {channelOptions.filter((o) => o.value !== 'all').map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Durum</label>
          <Select value={form.status} onValueChange={(v) => set('status', v)}>
            <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              {statusOptions.filter((o) => o.value !== 'all').map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Sıra No</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => set('sortOrder', Number(e.target.value))}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      {/* ─── Çeviri paneli ─── */}
      {translations && (
        <div className="rounded-lg border border-border bg-background">
          <button
            type="button"
            onClick={() => setTransOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Globe className="size-3.5 text-primary" />
              Çeviri Sonuçları
              <Badge variant="muted" className="text-xs">{Object.keys(translations).length} dil</Badge>
            </span>
            {transOpen
              ? <ChevronDown className="size-4 text-muted-foreground" />
              : <ChevronRight className="size-4 text-muted-foreground" />}
          </button>
          {transOpen && (
            <div className="divide-y border-t">
              {Object.entries(translations).map(([locale, t]) => (
                <div key={locale} className="px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-primary">
                    {LOCALE_LABELS[locale] ?? locale.toUpperCase()}
                  </p>
                  {t.question && (
                    <p className="text-sm font-medium text-foreground">{t.question}</p>
                  )}
                  {t.answer && (
                    <p className="text-xs text-muted-foreground">{t.answer}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTranslate}
          disabled={translating || (!form.question.trim() && !form.answer.trim())}
          className="gap-1.5"
        >
          <Globe className="size-3.5" />
          {translating ? 'Çevriliyor…' : translations ? 'Yeniden Çevir' : 'Otomatik Çevir'}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>İptal</Button>
          <Button size="sm" onClick={() => onSave(form)}>Kaydet</Button>
        </div>
      </div>
    </div>
  );
}

/* ─── page ─── */
const defaultForm = { id: '', category: 'orders', categoryLabel: 'Sipariş', question: '', answer: '', channel: 'buyer', status: 'draft', sortOrder: 1 };

export default function CmsContentFaqPage() {
  const [faqList, setFaqList] = useState(MOCK_FAQ);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null); // null=none, 'new'=create, string=id
  const [activeForm, setActiveForm] = useState(defaultForm);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(t);
  }, [categoryFilter, channelFilter, statusFilter, search]);

  const filtered = useMemo(() => {
    return faqList
      .filter((f) => categoryFilter === 'all' || f.category === categoryFilter)
      .filter((f) => channelFilter === 'all' || f.channel === channelFilter || f.channel === 'both')
      .filter((f) => statusFilter === 'all' || f.status === statusFilter)
      .filter((f) => !search || f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [faqList, categoryFilter, channelFilter, statusFilter, search]);

  const handleSave = (form) => {
    const today = new Date().toLocaleDateString('tr-TR');
    if (form.id) {
      setFaqList((prev) => prev.map((f) => f.id === form.id ? { ...form, updatedAt: today } : f));
    } else {
      const newItem = { ...form, id: `faq-${Date.now()}`, updatedAt: today, categoryLabel: categoryOptions.find((c) => c.value === form.category)?.label || form.category };
      setFaqList((prev) => [...prev, newItem]);
    }
    setEditingId(null);
  };

  const handleDelete = (id) => {
    setFaqList((prev) => prev.filter((f) => f.id !== id));
  };

  const handleToggleStatus = (id) => {
    setFaqList((prev) =>
      prev.map((f) => f.id === id ? { ...f, status: f.status === 'active' ? 'draft' : 'active' } : f),
    );
  };

  const openEdit = (faq) => {
    setActiveForm(faq);
    setEditingId(faq.id);
  };

  const openCreate = () => {
    setActiveForm(defaultForm);
    setEditingId('new');
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="İçerik"
        title="SSS Yönetimi"
        description="Sıkça sorulan soruları oluşturun, düzenleyin ve yayınlayın"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Yeni SSS
          </Button>
        }
      />

      {/* New item form */}
      {editingId === 'new' && (
        <div className="mb-5">
          <FaqForm
            initial={activeForm}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      {/* Toolbar */}
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Soru veya cevap içinde ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </div>
          <div className="w-44">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                {categoryOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger><SelectValue placeholder="Kanal" /></SelectTrigger>
              <SelectContent>
                {channelOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>SSS Listesi</CardTitle>
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
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 5 }).map((__, j) => <Skeleton key={j} className="h-4" />)}
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Filter className="size-6 text-muted-foreground" />
              <p className="font-semibold">Gösterilecek SSS bulunamadı</p>
              <Button size="sm" variant="outline" onClick={() => { setCategoryFilter('all'); setChannelFilter('all'); setStatusFilter('all'); setSearch(''); }}>
                Filtreleri sıfırla
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Soru</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Kanal</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Güncelleme</TableHead>
                    <TableHead className="w-24 text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((faq) => (
                    <>
                      <TableRow key={faq.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{faq.sortOrder}</TableCell>
                        <TableCell className="max-w-[360px]">
                          <p className="font-medium text-foreground line-clamp-1">{faq.question}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{faq.answer}</p>
                        </TableCell>
                        <TableCell>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {faq.categoryLabel}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={channelMeta[faq.channel]?.variant}>
                            {channelMeta[faq.channel]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button onClick={() => handleToggleStatus(faq.id)}>
                            <Badge variant={statusMeta[faq.status]?.variant}>
                              {statusMeta[faq.status]?.label}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{faq.updatedAt}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(faq)}
                              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(faq.id)}
                              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {editingId === faq.id && (
                        <TableRow key={`edit-${faq.id}`}>
                          <TableCell colSpan={7} className="p-3">
                            <FaqForm
                              initial={activeForm}
                              onSave={handleSave}
                              onCancel={() => setEditingId(null)}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
