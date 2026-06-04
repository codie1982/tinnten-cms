'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Sparkles,
  Eye,
  Pencil,
  Trash2,
  Globe,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Share2,
  Radio,
  Flame,
  Star,
  Zap,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useSession } from 'next-auth/react';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetNewsListQuery,
  useGetCategoryTreeQuery,
  useGenerateNewsMutation,
  useGetNewsJobQuery,
} from '@/redux/services';
import { cn } from '@/lib/utils';
import { NEWS_COUNTRIES, DEFAULT_NEWS_COUNTRY } from '@/config/api';
import { statusMeta } from './_data';

const DEFAULT_COUNTRY = DEFAULT_NEWS_COUNTRY;
const PAGE_SIZE = 20;

const CONTENT_TYPE_META = {
  richSections: { label: 'Zengin Bölümler', variant: 'primary' },
  sections: { label: 'Bölümler', variant: 'secondary' },
  markdown: { label: 'Markdown', variant: 'muted' },
  html: { label: 'HTML', variant: 'muted' },
};
const CONTENT_TYPE_OPTIONS = [
  { value: 'all', label: 'Tüm Tipler' },
  { value: 'richSections', label: 'Zengin Bölümler' },
  { value: 'sections', label: 'Bölümler' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML' },
];
const SORT_OPTIONS = [
  { value: 'updatedAt:desc', label: 'Güncelleme (Yeni → Eski)' },
  { value: 'updatedAt:asc', label: 'Güncelleme (Eski → Yeni)' },
  { value: 'publishedAt:desc', label: 'Yayın Tarihi (Yeni → Eski)' },
  { value: 'publishedAt:asc', label: 'Yayın Tarihi (Eski → Yeni)' },
  { value: 'createdAt:desc', label: 'Oluşturma (Yeni → Eski)' },
  { value: 'title:asc', label: 'Başlık (A → Z)' },
  { value: 'title:desc', label: 'Başlık (Z → A)' },
  { value: 'viewCount:desc', label: 'Görüntülenme (Çok → Az)' },
  { value: 'trendScore:desc', label: 'Trend Skoru (Yüksek → Düşük)' },
];

function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Kategori ağacını düz listeye indirger (id + name). */
function flattenTree(nodes, acc = []) {
  for (const n of nodes || []) {
    acc.push({ id: n._id ?? n.id, name: n.name });
    if (n.children?.length) flattenTree(n.children, acc);
  }
  return acc;
}

/* ─── Canlı üretim takip paneli (polling) ─── */
const JOB_STATUS_META = {
  running: { label: 'Çalışıyor', variant: 'warning' },
  done: { label: 'Tamamlandı', variant: 'success' },
  failed: { label: 'Hata', variant: 'destructive' },
};
const LOG_LEVEL_COLOR = {
  info: 'text-muted-foreground',
  success: 'text-emerald-600',
  warn: 'text-amber-600',
  error: 'text-destructive',
};

function JobLivePanel({ jobId, onClose }) {
  const [terminal, setTerminal] = useState(false);
  const { data: job } = useGetNewsJobQuery(jobId, {
    pollingInterval: terminal ? 0 : 3000,
    skip: !jobId,
  });
  const status = job?.status || 'running';
  useEffect(() => {
    if (status === 'done' || status === 'failed') setTerminal(true);
  }, [status]);

  const meta = JOB_STATUS_META[status] || JOB_STATUS_META.running;
  const c = job?.counts || {};
  const logs = job?.logs || [];

  const fmtTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === 'running'
            ? <Loader2 className="size-5 animate-spin text-primary" />
            : status === 'done'
              ? <CheckCircle2 className="size-5 text-emerald-600" />
              : <AlertTriangle className="size-5 text-destructive" />}
          <span className="font-medium text-foreground">
            {status === 'running' ? 'Üretim sürüyor…' : status === 'done' ? 'Üretim tamamlandı' : 'Üretim hata ile bitti'}
          </span>
        </div>
        <Badge variant={meta.variant} dot={status === 'running'}>{meta.label}</Badge>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Makale', value: c.articles ?? 0 },
          { label: 'Yayında', value: c.published ?? 0 },
          { label: 'Taslak', value: c.drafts ?? 0 },
          { label: 'Atlandı', value: c.skipped ?? 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border p-2">
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-border p-2.5">
          <Share2 className="size-4 text-violet-600" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Sosyal Medya</p>
            <p className="truncate text-sm font-medium text-foreground">
              {job?.social?.queued ? `${job.social.queued} gönderi (${(job.social.platforms || []).join(', ')})` : 'Yok'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border p-2.5">
          <Radio className={cn('size-4', job?.indexNow?.ok ? 'text-emerald-600' : job?.indexNow?.called ? 'text-amber-600' : 'text-muted-foreground')} />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">IndexNow</p>
            <p className="truncate text-sm font-medium text-foreground">
              {job?.indexNow?.called ? `${job.indexNow.submitted} URL${job.indexNow.ok ? ' ✓' : ' ⚠'}` : 'Çağrılmadı'}
            </p>
          </div>
        </div>
      </div>

      {job?.error && (
        <Alert variant="destructive">
          <AlertTitle>Hata</AlertTitle>
          <AlertDescription className="break-words">{job.error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-border bg-muted/30">
        <div className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">Canlı Log</div>
        <div className="max-h-48 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed">
          {logs.length === 0 ? (
            <p className="px-1 py-3 text-center text-muted-foreground">Henüz log yok…</p>
          ) : (
            logs.slice(-60).map((l, i) => (
              <div key={i} className="flex gap-2 px-1 py-0.5">
                <span className="shrink-0 text-muted-foreground/60">{fmtTime(l.ts)}</span>
                <span className={cn('break-words', LOG_LEVEL_COLOR[l.level] || 'text-muted-foreground')}>{l.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant={terminal ? 'default' : 'outline'} onClick={onClose}>
          {terminal ? 'Kapat' : 'Arka planda devam etsin'}
        </Button>
      </div>
    </div>
  );
}

/* ─── AI Generate Modal ─── */
const AI_COUNTRIES = NEWS_COUNTRIES.map((c) => c.code);
const AI_CONTENT_TYPES = [
  { value: 'richSections', label: 'Zengin Bölümler' },
  { value: 'sections', label: 'Bölümler' },
  { value: 'html', label: 'HTML' },
  { value: 'markdown', label: 'Markdown' },
];

function FormatSelect({ value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="text-2sm font-medium">İçerik Formatı</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {AI_CONTENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function AIGenerateModal({ onClose }) {
  const [phase, setPhase] = useState('form'); // form | loading | done
  const [mode, setMode] = useState('topic'); // topic | general
  const [errorMsg, setErrorMsg] = useState('');
  const [jobId, setJobId] = useState(null);
  const [form, setForm] = useState({
    topic: '',
    direction: '',
    categoryId: '',
    country: 'TR',
    countries: ['TR'],
    wordCount: '800',
    contentType: 'richSections',
    maxCategories: '5',
    jobsJson: '[\n  { "topic": "Örnek konu", "country": "TR", "contentType": "richSections" }\n]',
  });
  const [generateNews] = useGenerateNewsMutation();

  const canSubmit =
    mode === 'general' ? form.countries.length > 0
      : mode === 'batch' ? !!form.jobsJson.trim()
      : !!form.topic;

  function toggleCountry(code) {
    setForm((f) => ({
      ...f,
      countries: f.countries.includes(code)
        ? f.countries.filter((c) => c !== code)
        : [...f.countries, code],
    }));
  }

  function selectAllCountries() {
    setForm((f) => ({ ...f, countries: [...AI_COUNTRIES] }));
  }
  function clearCountries() {
    setForm((f) => ({ ...f, countries: [] }));
  }

  async function handleGenerate() {
    if (!canSubmit) return;
    setErrorMsg('');

    let body;
    if (mode === 'general') {
      body = {
        mode: 'general',
        countries: form.countries,
        contentType: form.contentType,
        // 'all' → 1000 (backend üst sınırı = tüm kategoriler; script ülke başına uygular)
        maxCategories: form.maxCategories === 'all' ? 1000 : (form.maxCategories ? Number(form.maxCategories) : undefined),
      };
    } else if (mode === 'batch') {
      let jobs;
      try {
        jobs = JSON.parse(form.jobsJson);
      } catch {
        setErrorMsg('Geçersiz JSON. Lütfen biçimi kontrol edin.');
        return;
      }
      if (!Array.isArray(jobs) || jobs.length === 0) {
        setErrorMsg('JSON bir iş dizisi (array) olmalı ve boş olmamalı.');
        return;
      }
      body = { mode: 'batch', jobs };
    } else {
      body = {
        topic: form.topic,
        direction: form.direction || undefined,
        category: form.categoryId || undefined,
        country: form.country,
        wordcount: form.wordCount,
        contentType: form.contentType,
      };
    }

    setPhase('loading');
    const res = await generateNews(body)
      .unwrap()
      .catch((e) => {
        setErrorMsg(e?.data?.message || e?.normalizedMessage || 'Üretim başlatılamadı.');
        return null;
      });
    setJobId(res?.jobId || null);
    setPhase(res ? 'done' : 'form');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
              <Sparkles className="size-4" />
            </div>
            <CardTitle>Yapay Zeka ile Haber Oluştur</CardTitle>
          </div>
          <CardToolbar>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
          </CardToolbar>
        </CardHeader>
        <CardContent>
          {phase === 'form' && (
            <div className="space-y-4">
              {/* Mod seçici */}
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-1">
                {[
                  { key: 'topic', label: 'Konu Bazlı' },
                  { key: 'general', label: 'Genel' },
                  { key: 'batch', label: 'Toplu / JSON' },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMode(m.key)}
                    className={cn(
                      'rounded-md py-1.5 text-sm font-medium transition-colors',
                      mode === m.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* ── Konu Bazlı ── */}
              {mode === 'topic' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-2sm font-medium">Konu / Başlık *</label>
                    <input
                      value={form.topic}
                      onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                      placeholder="örn. Türkiye'de B2B e-ticaret büyümesi"
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-2sm font-medium">Yön / Ek Bağlam</label>
                    <textarea
                      value={form.direction}
                      onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
                      rows={2}
                      placeholder="Analitik, pozitif/negatif bakış açısı..."
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-2sm font-medium">Ülke</label>
                      <Select value={form.country} onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NEWS_COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-2sm font-medium">Kelime Sayısı</label>
                      <Select value={form.wordCount} onValueChange={(v) => setForm((f) => ({ ...f, wordCount: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['400', '600', '800', '1200', '1600'].map((n) => (
                            <SelectItem key={n} value={n}>{n} kelime</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <FormatSelect value={form.contentType} onChange={(v) => setForm((f) => ({ ...f, contentType: v }))} />
                </>
              )}

              {/* ── Genel (çoklu ülke) ── */}
              {mode === 'general' && (
                <>
                  <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Genel araştırma: seçili ülkelerin aktif kategorileri için Google News trendlerinden
                    otomatik haber üretilir. Diller ülkeden türetilir. Çok sayıda LLM çağrısı yapılabilir.
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-2sm font-medium">Ülkeler / Diller (çoklu) *</label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={selectAllCountries} className="text-xs font-medium text-primary hover:underline">
                          Tümünü seç
                        </button>
                        <span className="text-muted-foreground/40">·</span>
                        <button type="button" onClick={clearCountries} className="text-xs text-muted-foreground hover:underline">
                          Temizle
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {NEWS_COUNTRIES.map((c) => {
                        const on = form.countries.includes(c.code);
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => toggleCountry(c.code)}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                              on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                            )}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-2sm font-medium">Maks. Kategori</label>
                      <Select value={form.maxCategories} onValueChange={(v) => setForm((f) => ({ ...f, maxCategories: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['3', '5', '10', '20', '50'].map((n) => (
                            <SelectItem key={n} value={n}>{n} kategori</SelectItem>
                          ))}
                          <SelectItem value="all">Tüm kategoriler</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <FormatSelect value={form.contentType} onChange={(v) => setForm((f) => ({ ...f, contentType: v }))} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Seçim:{' '}
                    <span className="font-medium text-foreground">{form.countries.length}</span> dil/ülke
                    {' × '}
                    <span className="font-medium text-foreground">{form.maxCategories === 'all' ? 'tüm' : form.maxCategories}</span> kategori
                    {(form.maxCategories === 'all' || form.countries.length >= 5) && (
                      <span className="text-amber-600"> — büyük üretim; uzun sürebilir ve yüksek LLM maliyeti oluşabilir.</span>
                    )}
                  </p>
                </>
              )}

              {/* ── Toplu / JSON ── */}
              {mode === 'batch' && (
                <>
                  <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    İş listesini JSON dizisi olarak girin. Her iş: <code>topic</code> (zorunlu),
                    <code> direction</code>, <code>category</code>, <code>country</code>,
                    <code> targetWordCount</code>, <code>contentType</code>.
                  </p>
                  <textarea
                    value={form.jobsJson}
                    onChange={(e) => setForm((f) => ({ ...f, jobsJson: e.target.value }))}
                    rows={10}
                    spellCheck={false}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/30 resize-y"
                  />
                </>
              )}
              {errorMsg && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>İptal</Button>
                <Button onClick={handleGenerate} disabled={!canSubmit}>
                  <Sparkles className="size-4" />
                  {mode === 'general' ? 'Araştır & Üret' : 'Oluştur'}
                </Button>
              </div>
            </div>
          )}

          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative flex size-16 items-center justify-center">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                <Sparkles className="size-6 text-primary" />
              </div>
              <div className="space-y-1 text-center">
                <p className="font-medium">İçerik oluşturuluyor…</p>
                <p className="text-sm text-muted-foreground">Bu işlem birkaç saniye sürebilir.</p>
              </div>
            </div>
          )}

          {phase === 'done' && (
            jobId
              ? <JobLivePanel jobId={jobId} onClose={onClose} />
              : (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="size-7" />
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="font-medium">Haber üretimi başlatıldı!</p>
                    <p className="text-sm text-muted-foreground">Üretim arka planda sürüyor; birkaç dakika içinde listede görünecek.</p>
                  </div>
                  <Button onClick={onClose}>Listeye Dön</Button>
                </div>
              )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── page ─── */
export default function NewsListPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [contentTypeFilter, setContentTypeFilter] = useState('all');
  const [sortValue, setSortValue] = useState('updatedAt:desc');
  const [page, setPage] = useState(1);
  const [showAI, setShowAI] = useState(false);

  // Ülke değişince kategori filtresini sıfırla (kategoriler ülkeye özgü)
  useEffect(() => {
    setCategoryFilter('all');
  }, [country]);

  // Filtre/arama/sıralama değişince ilk sayfaya dön
  useEffect(() => {
    setPage(1);
  }, [country, submittedSearch, statusFilter, categoryFilter, contentTypeFilter, sortValue]);

  const { data: tree = [] } = useGetCategoryTreeQuery(
    { countryCode: country },
    { skip: !authorized },
  );
  const categories = useMemo(() => flattenTree(tree), [tree]);
  const catMap = useMemo(() => {
    const m = {};
    for (const c of categories) m[c.id] = c.name;
    return m;
  }, [categories]);

  const [sortField, sortOrder] = sortValue.split(':');
  const applySearch = () => setSubmittedSearch(search.trim());

  const { data, isLoading, isFetching, error } = useGetNewsListQuery(
    {
      status: statusFilter === 'all' ? undefined : statusFilter,
      categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      contentType: contentTypeFilter === 'all' ? undefined : contentTypeFilter,
      query: submittedSearch || undefined,
      countryCode: country,
      sort: sortField,
      order: sortOrder,
      limit: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    },
    { skip: !authorized },
  );

  const total = data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const filtered = (data?.items ?? []).map((n) => ({
    ...n,
    id: n._id ?? n.id,
    categoryName: n.category?.name ?? n.categoryId?.name ?? catMap[n.categoryId] ?? '—',
    thumb: n.imageUrl || n.coverImages?.[0]?.path || null,
  }));
  const isEmpty = !isLoading && !error && filtered.length === 0;

  const resetFilters = () => {
    setSearch(''); setSubmittedSearch(''); setStatusFilter('all');
    setCategoryFilter('all'); setContentTypeFilter('all'); setSortValue('updatedAt:desc');
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      {showAI && <AIGenerateModal onClose={() => setShowAI(false)} />}

      <PageHeader
        section="Haberler"
        title="Tüm Haberler"
        description="Platformdaki haber ve makale içeriklerini yönetin"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowAI(true)}>
              <Sparkles className="size-4" />
              AI ile Oluştur
            </Button>
            <Link href="/cms/content/news/new">
              <Button>
                <Plus className="size-4" />
                Yeni Haber
              </Button>
            </Link>
          </div>
        }
      />

      {/* Toolbar */}
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Başlık veya slug ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
              className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </div>
          <Button variant="outline" onClick={applySearch} disabled={isFetching}>
            <Search className="size-4" />Ara
          </Button>
          <div className="w-36">
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Ülke" /></SelectTrigger>
              <SelectContent>
                {NEWS_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="published">Yayında</SelectItem>
                <SelectItem value="draft">Taslak</SelectItem>
                <SelectItem value="archived">Arşivlenmiş</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger><SelectValue placeholder="İçerik Tipi" /></SelectTrigger>
              <SelectContent>
                {CONTENT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <Select value={sortValue} onValueChange={setSortValue}>
              <SelectTrigger><SelectValue placeholder="Sıralama" /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Haber Listesi</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{data?.total ?? filtered.length} kayıt</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="relative px-0 py-0">
          {isFetching && !isLoading && !error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <div className="size-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            </div>
          )}
          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Haberler yüklenemedi</AlertTitle>
                <AlertDescription>
                  {error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı. (news:editor yetkisi gerekebilir.)'}
                </AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-12 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                  <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <FileText className="size-6 text-muted-foreground" />
              <p className="font-semibold">Haber bulunamadı</p>
              <p className="text-sm text-muted-foreground">Filtreleri değiştirerek yeniden deneyin.</p>
              <Button size="sm" variant="outline" onClick={resetFilters}>
                Filtreleri sıfırla
              </Button>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" />
                    <TableHead>Başlık</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>İçerik Tipi</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Görüntülenme</TableHead>
                    <TableHead>Süre</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((n) => (
                    <TableRow key={n.id}>
                      {/* Thumbnail */}
                      <TableCell className="py-2">
                        {n.thumb ? (
                          <img src={n.thumb} alt={n.title} className="size-11 rounded-md object-cover" />
                        ) : (
                          <div className="flex size-11 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <FileText className="size-4" />
                          </div>
                        )}
                      </TableCell>
                      {/* Title + flags */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/cms/content/news/${n.id}`} className="line-clamp-1 max-w-xs font-medium text-foreground hover:text-primary">
                              {n.title}
                            </Link>
                            {n.isBreaking && <Flame className="size-3.5 shrink-0 text-red-500" title="Son dakika" />}
                            {n.isHero && <Zap className="size-3.5 shrink-0 text-amber-500" title="Hero" />}
                            {n.isFeatured && <Star className="size-3.5 shrink-0 text-violet-500" title="Öne çıkan" />}
                          </div>
                          <span className="line-clamp-1 max-w-xs text-xs text-muted-foreground">{n.subtitle}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{n.categoryName}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={CONTENT_TYPE_META[n.contentType]?.variant ?? 'muted'}>
                          {CONTENT_TYPE_META[n.contentType]?.label ?? n.contentType ?? '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusMeta[n.status]?.variant ?? 'muted'}>
                          {statusMeta[n.status]?.label ?? n.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {(n.viewCount ?? 0) > 0 ? n.viewCount.toLocaleString('tr-TR') : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {n.readingTimeMinutes ? `${n.readingTimeMinutes} dk` : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatTrDate(n.publishedAt ?? n.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Link href={`/cms/content/news/${n.id}`}>
                            <Button variant="ghost" size="icon" className="size-7"><Pencil className="size-3.5" /></Button>
                          </Link>
                          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Sayfa <span className="font-medium text-foreground">{page}</span> / {totalPages}
                {' · '}Toplam <span className="font-medium text-foreground">{total}</span> haber
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
                  <ChevronLeft className="size-4" />Önceki
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => Math.min(p + 1, totalPages))}>
                  Sonraki<ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
