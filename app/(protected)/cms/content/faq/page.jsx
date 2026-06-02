'use client';

import { useMemo, useState } from 'react';
import { Filter, Globe, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import {
  Card, CardContent, CardHeader, CardTitle, CardToolbar,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CMS_ROLES } from '@/lib/roles';
import {
  useTranslateMutation,
  useGetCmsFaqsQuery,
  useCreateFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
} from '@/redux/services';

const ALL_LOCALES = ['tr', 'en', 'de', 'ar', 'el', 'es', 'fr', 'it', 'ru'];
const LOCALE_LABELS = {
  tr: 'TR', en: 'EN', de: 'DE', ar: 'AR', el: 'EL', es: 'ES', fr: 'FR', it: 'IT', ru: 'RU',
};
const LOCALE_FULL = {
  tr: 'Türkçe', en: 'English', de: 'Deutsch', ar: 'العربية',
  el: 'Ελληνικά', es: 'Español', fr: 'Français', it: 'Italiano', ru: 'Русский',
};

/* ─── options ─── */
const categoryOptions = [
  { value: 'all', label: 'Tüm Kategoriler' },
  { value: 'general', label: 'Genel' },
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
const categoryLabel = (v) => categoryOptions.find((o) => o.value === v)?.label || v;

/* contents[] → { [locale]: {question, answer} } */
function contentsToForms(contents) {
  const forms = Object.fromEntries(ALL_LOCALES.map((l) => [l, { question: '', answer: '' }]));
  for (const c of contents ?? []) {
    if (!c?.locale || !forms[c.locale]) continue;
    forms[c.locale] = { question: c.question ?? '', answer: c.answer ?? '' };
  }
  return forms;
}
/** Bir FAQ'tan locale (tr → ilk) soru/cevabını seçer (liste gösterimi). */
function pickContent(faq, locale = 'tr') {
  const contents = faq?.contents ?? [];
  return contents.find((c) => c.locale === locale) || contents.find((c) => c.locale === 'tr') || contents[0] || { question: '', answer: '' };
}

function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ─── inline edit form (dil sekmeli) ─── */
function FaqForm({ initial, saving, onSave, onCancel }) {
  const [shared, setShared] = useState({
    category: initial.category || 'general',
    channel: initial.channel || 'both',
    status: initial.status || 'draft',
    sortOrder: initial.sortOrder ?? 0,
  });
  const [localeForms, setLocaleForms] = useState(() => contentsToForms(initial.contents));
  const [selectedLocale, setSelectedLocale] = useState('tr');
  const [notice, setNotice] = useState(null);

  const [translate, { isLoading: translating }] = useTranslateMutation();

  const setField = (k, v) => setLocaleForms((p) => ({ ...p, [selectedLocale]: { ...p[selectedLocale], [k]: v } }));
  const current = localeForms[selectedLocale] ?? { question: '', answer: '' };
  const filledLocales = ALL_LOCALES.filter((l) => localeForms[l]?.question?.trim() && localeForms[l]?.answer?.trim());

  async function handleTranslate() {
    const src = localeForms.tr;
    if (!src.question.trim() && !src.answer.trim()) {
      setNotice({ type: 'error', text: 'Çeviri için önce Türkçe soru/cevabı doldurun.' });
      return;
    }
    setNotice(null);
    try {
      const [qRes, aRes] = await Promise.all([
        src.question.trim() ? translate({ text: src.question.trim(), context: 'FAQ question' }).unwrap() : Promise.resolve({ translations: {} }),
        src.answer.trim() ? translate({ text: src.answer.trim(), context: 'FAQ answer' }).unwrap() : Promise.resolve({ translations: {} }),
      ]);
      setLocaleForms((prev) => {
        const next = { ...prev };
        for (const l of ALL_LOCALES.filter((x) => x !== 'tr')) {
          next[l] = {
            question: qRes.translations?.[l] ?? prev[l]?.question ?? '',
            answer: aRes.translations?.[l] ?? prev[l]?.answer ?? '',
          };
        }
        return next;
      });
      setNotice({ type: 'success', text: 'Çeviri tamamlandı, dilleri inceleyin.' });
    } catch {
      setNotice({ type: 'error', text: 'Çeviri sırasında hata oluştu.' });
    }
  }

  function submit() {
    const contents = filledLocales.map((l) => ({ locale: l, question: localeForms[l].question.trim(), answer: localeForms[l].answer.trim() }));
    if (!contents.length) {
      setNotice({ type: 'error', text: 'En az bir dilde soru ve cevap zorunludur.' });
      return;
    }
    onSave({ ...shared, sortOrder: Number(shared.sortOrder) || 0, contents });
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">{initial.id ? 'SSS Düzenle' : 'Yeni SSS'}</h3>

      {notice && (
        <Alert variant={notice.type === 'error' ? 'destructive' : 'info'}>
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}

      {/* Ortak alanlar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Kategori</label>
          <Select value={shared.category} onValueChange={(v) => setShared((s) => ({ ...s, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{categoryOptions.filter((o) => o.value !== 'all').map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Kanal</label>
          <Select value={shared.channel} onValueChange={(v) => setShared((s) => ({ ...s, channel: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{channelOptions.filter((o) => o.value !== 'all').map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Durum</label>
            <Select value={shared.status} onValueChange={(v) => setShared((s) => ({ ...s, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statusOptions.filter((o) => o.value !== 'all').map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Sıra</label>
            <input type="number" value={shared.sortOrder} onChange={(e) => setShared((s) => ({ ...s, sortOrder: e.target.value }))}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
        </div>
      </div>

      {/* Dil sekmeleri */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-1">
        {ALL_LOCALES.map((locale) => {
          const filled = !!(localeForms[locale]?.question || localeForms[locale]?.answer);
          const active = selectedLocale === locale;
          return (
            <button key={locale} type="button" disabled={translating} onClick={() => setSelectedLocale(locale)}
              className={cn('relative rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground')}>
              {LOCALE_LABELS[locale]}
              {filled && !active && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-green-500" />}
            </button>
          );
        })}
      </div>

      {/* Seçili dil alanları */}
      <div className="space-y-3 rounded-lg border border-border/60 bg-background p-3">
        <p className="text-xs font-medium text-muted-foreground">
          {LOCALE_FULL[selectedLocale]}
          {selectedLocale !== 'tr' && !current.question && !current.answer && (
            <span className="ml-2 text-amber-500">· İçerik yok — "Otomatik Çevir" ile doldurun</span>
          )}
        </p>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Soru</label>
          <input value={current.question} onChange={(e) => setField('question', e.target.value)} placeholder="Soru metni..."
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Cevap</label>
          <textarea value={current.answer} onChange={(e) => setField('answer', e.target.value)} rows={3} placeholder="Cevap metni..."
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
      </div>

      {/* Aksiyonlar */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleTranslate}
            disabled={translating || saving || !localeForms.tr.question.trim()} className="gap-1.5">
            {translating ? <Loader2 className="size-3.5 animate-spin" /> : <Globe className="size-3.5" />}
            {translating ? 'Çevriliyor…' : 'Türkçe\'den Otomatik Çevir'}
          </Button>
          <span className="text-xs text-muted-foreground">{filledLocales.length}/{ALL_LOCALES.length} dil dolu</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>İptal</Button>
          <Button size="sm" onClick={submit} disabled={saving || translating}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── page ─── */
const EMPTY_FAQ = { id: '', category: 'general', channel: 'both', status: 'draft', sortOrder: 0, contents: [] };

export default function CmsContentFaqPage() {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null); // null | 'new' | id
  const [activeForm, setActiveForm] = useState(EMPTY_FAQ);

  const { data: faqList = [], isLoading, isFetching, error } = useGetCmsFaqsQuery({
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    channel: channelFilter === 'all' ? undefined : channelFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const [createFaq, { isLoading: creating }] = useCreateFaqMutation();
  const [updateFaq, { isLoading: updating }] = useUpdateFaqMutation();
  const [deleteFaq] = useDeleteFaqMutation();
  const saving = creating || updating;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...faqList]
      .filter((f) => {
        if (!q) return true;
        return (f.contents ?? []).some((c) =>
          (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
      })
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [faqList, search]);

  async function handleSave(payload) {
    try {
      if (editingId && editingId !== 'new') {
        await updateFaq({ id: editingId, ...payload }).unwrap();
      } else {
        await createFaq(payload).unwrap();
      }
      setEditingId(null);
    } catch {
      // mutation hatası — form açık kalır, kullanıcı tekrar dener
    }
  }
  async function handleDelete(id) {
    await deleteFaq(id).unwrap().catch(() => {});
  }
  function openEdit(faq) { setActiveForm(faq); setEditingId(faq.id); }
  function openCreate() { setActiveForm(EMPTY_FAQ); setEditingId('new'); }

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="İçerik"
        title="SSS Yönetimi"
        description="Sıkça sorulan soruları çok dilli olarak oluşturun ve yönetin"
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" />Yeni SSS</Button>}
      />

      {editingId === 'new' && (
        <div className="mb-5">
          <FaqForm initial={activeForm} saving={saving} onSave={handleSave} onCancel={() => setEditingId(null)} />
        </div>
      )}

      {/* Toolbar */}
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Tüm dillerde soru/cevap içinde ara..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
          </div>
          <div className="w-44">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>{categoryOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger><SelectValue placeholder="Kanal" /></SelectTrigger>
              <SelectContent>{channelOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>SSS Listesi</CardTitle>
          <CardToolbar><Badge variant="muted">{filtered.length} kayıt</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="relative px-0 py-0">
          {isFetching && !isLoading && !error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>SSS yüklenemedi</AlertTitle>
                <AlertDescription>{error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}</AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-5 gap-2">{Array.from({ length: 5 }).map((__, j) => <Skeleton key={j} className="h-4" />)}</div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Filter className="size-6 text-muted-foreground" />
              <p className="font-semibold">Gösterilecek SSS bulunamadı</p>
              <Button size="sm" variant="outline" onClick={() => { setCategoryFilter('all'); setChannelFilter('all'); setStatusFilter('all'); setSearch(''); }}>Filtreleri sıfırla</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Soru</TableHead>
                  <TableHead>Diller</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Güncelleme</TableHead>
                  <TableHead className="w-24 text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((faq) => {
                  const tr = pickContent(faq, 'tr');
                  return (
                    <>
                      <TableRow key={faq.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{faq.sortOrder}</TableCell>
                        <TableCell className="max-w-[320px]">
                          <p className="line-clamp-1 font-medium text-foreground">{tr.question || '—'}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{tr.answer}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(faq.contents ?? []).map((c) => (
                              <span key={c.locale} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{LOCALE_LABELS[c.locale] ?? c.locale}</span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{categoryLabel(faq.category)}</span>
                        </TableCell>
                        <TableCell><Badge variant={channelMeta[faq.channel]?.variant}>{channelMeta[faq.channel]?.label}</Badge></TableCell>
                        <TableCell><Badge variant={statusMeta[faq.status]?.variant}>{statusMeta[faq.status]?.label ?? faq.status}</Badge></TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{formatTrDate(faq.updatedAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(faq)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => handleDelete(faq.id)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {editingId === faq.id && (
                        <TableRow key={`edit-${faq.id}`}>
                          <TableCell colSpan={8} className="p-3">
                            <FaqForm initial={activeForm} saving={saving} onSave={handleSave} onCancel={() => setEditingId(null)} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
