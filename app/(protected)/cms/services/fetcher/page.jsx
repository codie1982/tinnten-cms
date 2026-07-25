'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Activity, Globe, ScrollText, Server, RefreshCw, X, Search,
  Play, Square, RotateCw, Trash2, Plus, CircleDot, OctagonX, Loader2, Inbox, Wand2,
  Rss, ShieldAlert, Pause, Ban, Radio, Pencil, ShieldCheck, FileText, SlidersHorizontal,
  ChevronsUpDown, Building2, Check, Gauge, Braces, FlaskConical, Users, RotateCcw,
  AlertTriangle, Clock, Undo2,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { cn } from '@/lib/utils';
import CompanySelect from '@/components/cms/company-select';
import DomainWizard from './DomainWizard';
import {
  useGetFetcherStatusQuery,
  useStopAllScrapingMutation,
  useGetFetcherDomainsQuery,
  useGetFetcherDomainQuery,
  useGetFetcherDomainStatsQuery,
  useGetFetcherDomainUrlsQuery,
  useStartDomainScrapingMutation,
  useStopDomainScrapingMutation,
  useRestartDomainScrapingMutation,
  useGetFetcherLogsQuery,
  useGetFetcherNodesQuery,
  useCreateFetcherNodeMutation,
  useDeleteFetcherNodeMutation,
  useNodeActionMutation,
  useGetFetcherSubscriptionsQuery,
  useGetFetcherSubscriptionStatsQuery,
  useGetSchedulerTuningQuery,
  useUpdateSchedulerTuningMutation,
  useUpdateFetcherSubscriptionMutation,
  useReindexFetcherSubscriptionMutation,
  useDeleteFetcherSubscriptionMutation,
  useGetRestrictedDomainsQuery,
  useGetRabbitmqHealthQuery,
  useAddFetcherDomainMutation,
  useUpdateFetcherDomainMutation,
  useDeleteFetcherDomainMutation,
  useVerifyFetcherDomainMutation,
  useCreateFetcherDomainUrlMutation,
  useDeleteFetcherDomainUrlMutation,
  useGetFetcherUrlContentQuery,
  useGetScrapingConfigQuery,
  useSaveScrapingConfigMutation,
  useDeleteScrapingConfigMutation,
  useResetDomainScrapingMutation,
  useGenerateDomainSchemasMutation,
  useTestDomainSchemaMutation,
  useCommitDomainSchemasMutation,
  useGetCompanyQuery,
  useGetCompaniesQuery,
} from '@/redux/services';

const PAGE_SIZE = 25;

/**
 * Fetcher tarihleri naive UTC döner (datetime.utcnow().isoformat() — offset taşımaz).
 * JS offsetsiz girdiyi lokal saat sayar; UTC olarak işaretleyip kaymayı önlüyoruz.
 */
function parseDate(input) {
  if (!input) return null;
  const raw = typeof input === 'string' ? input.trim() : input;
  const norm = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}[T ][\d:.]+$/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw;
  const d = new Date(norm);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTr(input) {
  const d = parseDate(input);
  if (!d) return '—';
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

const domainStatusVariant = (s) =>
  s === 'ACTIVE' ? 'success' : ['RESTRICTED', 'PAUSED'].includes(s) ? 'warning' : 'muted';
const urlStatusVariant = (s) =>
  s === 'DONE' ? 'success' : s === 'ERROR' ? 'destructive' : s === 'READY' ? 'primary' : s === 'PAUSED' ? 'muted' : 'warning';
// Backend heartbeat'i eskiyen node'u çevrimdışı sayar: NODE_OFFLINE_SECONDS(30) + 10sn tolerans.
const NODE_OFFLINE_MS = 40_000;

/**
 * Node'un gerçek durumu — backend iki ekseni birleştirir: kayıtlı durum
 * (enabled/status) ve canlılık (last_heartbeat tazeliği). Static node'lar
 * heartbeat göndermediği için tazelik kontrolünden muaftır (mongo_store.list_nodes).
 * `passive` olan node iş almaz; başlat/yeniden başlat ile geri alınır.
 */
function nodeState(n) {
  if (n.status === 'DECOMMISSIONED') return { label: 'Devre dışı', variant: 'destructive', dot: 'text-muted-foreground', passive: true };
  if (n.enabled === false || n.status === 'DISABLED') return { label: 'Kapalı', variant: 'muted', dot: 'text-muted-foreground', passive: true };
  const hb = parseDate(n.last_heartbeat);
  if (n.type !== 'static' && (!hb || Date.now() - hb.getTime() > NODE_OFFLINE_MS)) {
    return { label: 'Çevrimdışı', variant: 'warning', dot: 'text-amber-500', passive: true };
  }
  return { label: 'Aktif', variant: 'success', dot: 'text-green-500', passive: false };
}
const httpVariant = (code) =>
  !code ? 'muted' : code < 300 ? 'success' : code < 400 ? 'warning' : 'destructive';
// Abonelik state machine (mongo_store.py): 7 durum.
const subStateVariant = (s) =>
  s === 'live' ? 'success' : s === 'paused' ? 'muted' : s === 'removed' ? 'destructive' : 'warning';
// Yapısal upstream hata detayı ApiResponse.error.data → fetcher body altında kalır.
const upstreamErr = (err) => err?.data?.data || {};
const SITE_TYPES = ['ecommerce', 'service', 'blog'];

// Domain listeleme sıralama seçenekleri (değer: `${alan}:${yön}`).
// Alanlar fetcher'daki MongoStore.ALLOWED_DOMAIN_SORT_FIELDS ile birebir
// eşleşmeli — whitelist dışı bir alan sessizce updatedAt'e düşer.
const DOMAIN_SORTS = [
  { value: 'createdAt:desc', label: 'Eklenme: Yeni → Eski' },
  { value: 'createdAt:asc', label: 'Eklenme: Eski → Yeni' },
  { value: 'updatedAt:desc', label: 'Güncelleme: Yeni → Eski' },
  { value: 'domain:asc', label: 'Domain: A → Z' },
  { value: 'domain:desc', label: 'Domain: Z → A' },
  { value: 'status:asc', label: 'Duruma göre' },
  { value: 'priority:desc', label: 'Öncelik: Yüksek → Düşük' },
  { value: 'stats.last_crawl_at:desc', label: 'Son tarama: Yeni → Eski' },
  { value: 'stats.last_crawl_at:asc', label: 'Son tarama: Eski → Yeni' },
  { value: 'stats.total_pages_crawled:desc', label: 'Taranan sayfa: Çok → Az' },
];

const DOMAIN_STATUSES = ['ACTIVE', 'PAUSED', 'RESTRICTED', 'REMOVED'];
const LOG_WINDOWS = [
  { value: '1', label: 'Son 1 saat' },
  { value: '6', label: 'Son 6 saat' },
  { value: '24', label: 'Son 24 saat' },
  { value: '72', label: 'Son 3 gün' },
  { value: '168', label: 'Son 7 gün' },
  { value: '720', label: 'Son 30 gün' },
];

const nfmt = (n) => (n == null ? '—' : Number(n).toLocaleString('tr-TR'));

/** "3 sa önce" gibi kısa göreli zaman — liste hücrelerinde tam tarihten okunaklı. */
function relativeTr(input) {
  const d = parseDate(input);
  if (!d) return '—';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} gün önce`;
  return formatTr(input);
}

/** Domain kaydındaki url_schemas — ikiz yazılan iki konumdan dolu olanı. */
function domainSchemas(doc) {
  return doc?.scraping_config?.url_schemas || doc?.config?.scraping?.url_schemas || [];
}

/**
 * Silme artık asenkron: domain anında REMOVED işaretlenip `deletion` alanı
 * yazılıyor, ağır cascade arka planda koşuyor. Liste bunu ayrı göstermeli —
 * yoksa "sildim ama duruyor" gibi görünür.
 */
function deletionState(doc) {
  const del = doc?.deletion;
  if (!del?.state) return null;
  if (del.state === 'failed') return { label: 'Silme başarısız', variant: 'destructive', error: del.error };
  if (del.state === 'running') return { label: 'Siliniyor…', variant: 'warning', error: null };
  return null;
}

function shortId(id) {
  const s = String(id || '');
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

/**
 * Domaine ekli firma/kullanıcıyı ID yerine kimliğiyle (isim + e-posta) gösterir.
 * Öncelik: domain kaydına gömülü companyContext (ek istek yok). Bu snapshot yoksa
 * ama companyId varsa (eski kayıtlar) firma detayını lazily çözer.
 */
function CompanyOwnerCell({ companyId, context }) {
  const ctxName = context?.company?.name;
  const ctxEmail = context?.owner?.email || context?.company?.email;
  const needLookup = !ctxName && Boolean(companyId);
  const { data: company } = useGetCompanyQuery(companyId, { skip: !needLookup });

  const name = ctxName || company?.companyName;
  const email = ctxEmail || company?.email;

  if (!companyId && !name) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="min-w-0" title={companyId || undefined}>
      <div className="truncate text-sm text-foreground">{name || shortId(companyId)}</div>
      {email ? <div className="truncate text-xs text-muted-foreground">{email}</div> : null}
    </div>
  );
}

// NOT: Global "URL'ler" sekmesi kaldırıldı — domain bağlamı olmadan düz bir URL
// kuyruğu listesi tek başına bir şey anlatmıyordu ve aynı veri (üstelik durum
// dağılımı + içerik önizlemesiyle) domain detayında zaten var.
const SECTIONS = [
  { key: 'status', label: 'Genel Durum', icon: Activity, desc: 'Sistem & node özeti' },
  { key: 'domains', label: 'Domainler', icon: Globe, desc: 'Domain & scraping kontrolü' },
  { key: 'subscriptions', label: 'Abonelikler', icon: Rss, desc: 'Firma ↔ domain abonelik yönetimi' },
  { key: 'tuning', label: 'Hız Kontrolü', icon: Gauge, desc: 'Canlı crawl hızı & eşzamanlılık' },
  { key: 'logs', label: 'Crawl Logları', icon: ScrollText, desc: 'Tarama denemesi kayıtları' },
  { key: 'nodes', label: "Node'lar", icon: Server, desc: 'Scraper worker yönetimi' },
  { key: 'reports', label: 'Raporlar', icon: ShieldAlert, desc: 'Kısıtlı domainler & RabbitMQ' },
];

/* ════════════ Genel Durum ════════════ */
function StatusSection({ authorized }) {
  const { data, isFetching, isError, refetch } = useGetFetcherStatusQuery(undefined, {
    skip: !authorized,
    pollingInterval: 15000,
  });
  const [stopAll, { isLoading: stopping }] = useStopAllScrapingMutation();

  const onStopAll = async () => {
    if (!window.confirm('Tüm domainlerde scraping durdurulsun mu? Bu işlem tüm aktif taramaları sonlandırır.')) return;
    await stopAll().unwrap().catch(() => {});
  };

  const stat = (label, value, tone) => (
    <Card><CardContent className="p-4">
      <p className="text-2sm text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{isFetching && data == null ? '…' : value}</p>
    </CardContent></Card>
  );

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Fetcher servisine ulaşılamadı</AlertTitle>
        <AlertDescription>Köprü (tinnten-server /fetcher) veya fetcher servisi (port 5005) çalışmıyor olabilir.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.scheduling_paused ? <Badge variant="warning">Zamanlama duraklatıldı</Badge> : <Badge variant="success">Zamanlama aktif</Badge>}
          {data?.message ? <span className="ms-2">{data.message}</span> : null}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /> Yenile
          </Button>
          <Button variant="destructive" size="sm" onClick={onStopAll} disabled={stopping}>
            <OctagonX className="size-4" /> Tümünü Durdur
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stat('Aktif Node', data?.active_nodes ?? 0, 'text-green-600')}
        {stat('Toplam Node', data?.total_nodes ?? 0)}
        {stat('İşlemdeki URL', data?.inflight_urls ?? 0, 'text-primary')}
        {stat('Durum', data?.scheduling_paused ? 'Duraklı' : 'Çalışıyor', data?.scheduling_paused ? 'text-amber-600' : 'text-green-600')}
      </div>
    </div>
  );
}

/* ════════════ Domain modalları ════════════ */

const SCHEMA_FAMILIES = ['article', 'product', 'category', 'static'];
const EMPTY_SCHEMA_DRAFT = { pattern: '', label: '', knowledge_source: '', css: '' };

/**
 * URL şema yönetimi — domain düzenlemenin ikinci sekmesi.
 *
 * İki farklı yazma yolu var ve ikisi de gerekli:
 *  • Ekleme/güncelleme → `schemas/commit`. Bu uç MERGE eder; analizörün ürettiği
 *    ve burada listelenmeyen girdileri korur.
 *  • Silme → `scraping-config` POST. Commit silme yapamıyor (yalnız ekler), bu
 *    yüzden tek yol config'in TAMAMINI eksik girdiyle yeniden yazmak.
 * `startCrawl: false` gönderiyoruz — şema düzenlemek taramayı başlatmamalı.
 */
function DomainSchemasPanel({ domain }) {
  const { data: cfgData, isFetching, isError, error, refetch } = useGetScrapingConfigQuery(domain);
  const noConfig = isError && error?.status === 404;
  const config = cfgData?.scraping_config || {};
  const schemas = config.url_schemas || [];

  const [commitSchemas, { isLoading: committing }] = useCommitDomainSchemasMutation();
  const [saveCfg, { isLoading: replacing }] = useSaveScrapingConfigMutation();
  const [testSchema, { isLoading: testing }] = useTestDomainSchemaMutation();
  const [generateSchemas, { isLoading: generating }] = useGenerateDomainSchemasMutation();

  const [draft, setDraft] = useState(null); // { index|null, ...EMPTY_SCHEMA_DRAFT }
  const [msg, setMsg] = useState(null);     // { tone, text }
  const [testResult, setTestResult] = useState(null);
  const [genPattern, setGenPattern] = useState({ pattern: '', family: 'article' });

  const openDraft = (entry, index) => {
    setTestResult(null); setMsg(null);
    setDraft(entry
      ? {
          index,
          pattern: entry.pattern || '',
          label: entry.label || '',
          knowledge_source: entry.knowledge_source || '',
          css: entry.css_schema ? JSON.stringify(entry.css_schema, null, 2) : '',
        }
      : { index: null, ...EMPTY_SCHEMA_DRAFT });
  };

  /** css_schema boş bırakılabilir (sadece pattern eşleme); doluysa JSON nesnesi olmalı. */
  const parseCss = () => {
    const raw = (draft.css || '').trim();
    if (!raw) return { ok: true, value: null };
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        return { ok: false, error: 'css_schema bir JSON nesnesi olmalı.' };
      }
      return { ok: true, value: parsed };
    } catch { return { ok: false, error: 'css_schema geçerli JSON değil.' }; }
  };

  const runTest = async () => {
    const css = parseCss();
    if (!css.ok) { setMsg({ tone: 'destructive', text: css.error }); return; }
    if (!css.value) { setMsg({ tone: 'destructive', text: 'Test için css_schema gerekli.' }); return; }
    setMsg(null); setTestResult(null);
    try {
      const res = await testSchema({
        domain,
        pattern: draft.pattern.trim() || undefined,
        css_schema: css.value,
        maxSamples: 2,
      }).unwrap();
      setTestResult(res);
    } catch (e) {
      const u = upstreamErr(e);
      setMsg({
        tone: 'destructive',
        text: e?.status === 504
          ? 'Test zaman aşımına uğradı — örnek sayfalar uzak scraper üzerinden çekiliyor, tekrar deneyin.'
          : (u.error || 'Şema testi başarısız.'),
      });
    }
  };

  const saveDraft = async () => {
    if (!draft.pattern.trim()) { setMsg({ tone: 'destructive', text: 'Pattern zorunlu (ör. /urun/*).' }); return; }
    const css = parseCss();
    if (!css.ok) { setMsg({ tone: 'destructive', text: css.error }); return; }
    setMsg(null);
    const entry = { pattern: draft.pattern.trim(), css_schema: css.value };
    if (draft.label.trim()) entry.label = draft.label.trim();
    if (draft.knowledge_source.trim()) entry.knowledge_source = draft.knowledge_source.trim();
    try {
      const res = await commitSchemas({ domain, schemas: [entry], startCrawl: false }).unwrap();
      setMsg({ tone: 'success', text: `Kaydedildi · ${res?.schemasWritten ?? 1} şema yazıldı.` });
      setDraft(null); setTestResult(null);
      refetch();
    } catch (e) {
      setMsg({ tone: 'destructive', text: upstreamErr(e).error || 'Şema kaydedilemedi.' });
    }
  };

  const removeSchema = async (index) => {
    const entry = schemas[index];
    if (!window.confirm(`"${entry.pattern || entry.label}" şeması silinsin mi?`)) return;
    setMsg(null);
    try {
      // Commit silemez; config'in tamamını eksik girdiyle yeniden yazıyoruz.
      await saveCfg({ domain, ...config, url_schemas: schemas.filter((_, i) => i !== index) }).unwrap();
      setMsg({ tone: 'success', text: 'Şema silindi.' });
      refetch();
    } catch (e) {
      setMsg({ tone: 'destructive', text: upstreamErr(e).error || 'Şema silinemedi.' });
    }
  };

  const runGenerate = async () => {
    if (!genPattern.pattern.trim()) { setMsg({ tone: 'destructive', text: 'Üretim için pattern gerekli.' }); return; }
    setMsg(null);
    try {
      const res = await generateSchemas({
        domain,
        patterns: [{ pattern: genPattern.pattern.trim(), family: genPattern.family }],
      }).unwrap();
      setMsg({
        tone: 'success',
        text: res?.status === 'already_queued'
          ? 'Zaten kuyrukta — analiz bitince şemalar burada görünür.'
          : 'Üretim kuyruğa alındı. Arka planda çalışır; birkaç dakika sonra yenileyin.',
      });
      setGenPattern({ pattern: '', family: 'article' });
    } catch (e) {
      setMsg({ tone: 'destructive', text: upstreamErr(e).error || 'Şema üretimi başlatılamadı.' });
    }
  };

  if (isFetching && !cfgData) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-3">
      {msg && <Alert variant={msg.tone === 'destructive' ? 'destructive' : undefined}><AlertDescription>{msg.text}</AlertDescription></Alert>}
      {isError && !noConfig && <Alert variant="destructive"><AlertDescription>Şema config'i alınamadı.</AlertDescription></Alert>}

      {schemas.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-8 text-center">
          <Braces className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Bu domainde URL şeması yok</p>
          <p className="text-xs text-muted-foreground">Şemasız taramada sayfalar yalnız düz metin olarak alınır.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {schemas.map((s, i) => {
            const fields = s.css_schema?.fields;
            const fieldCount = Array.isArray(fields) ? fields.length : Object.keys(s.css_schema || {}).length;
            return (
              <div key={`${s.pattern || s.label}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm text-foreground">{s.pattern || (s.sitemaps ? `sitemap: ${s.sitemaps.length}` : '—')}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {s.label ? <span>{s.label}</span> : null}
                    <Badge variant="muted">{s.css_schema ? `${fieldCount} alan` : 'şemasız'}</Badge>
                    {s.source ? <Badge variant={s.source === 'user_reviewed' ? 'primary' : 'muted'}>{s.source}</Badge> : null}
                    {s.knowledge_source ? <span>· {s.knowledge_source}</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="size-7" title="Düzenle" onClick={() => openDraft(s, i)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7" title="Sil" disabled={replacing} onClick={() => removeSchema(i)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!draft && (
        <Button variant="outline" size="sm" onClick={() => openDraft(null, null)}>
          <Plus className="size-3.5" /> Şema ekle
        </Button>
      )}

      {draft && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-2.5 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-2sm font-medium">URL pattern *</label>
                <Input value={draft.pattern} onChange={(e) => setDraft((d) => ({ ...d, pattern: e.target.value }))} placeholder="/urun/*" />
              </div>
              <div className="space-y-1">
                <label className="text-2sm font-medium">Etiket</label>
                <Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder="product_page" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-2sm font-medium">Bilgi kaynağı (opsiyonel)</label>
              <Input value={draft.knowledge_source} onChange={(e) => setDraft((d) => ({ ...d, knowledge_source: e.target.value }))} placeholder="RAG havuzunu ayırmak için" />
            </div>
            <div className="space-y-1">
              <label className="text-2sm font-medium">css_schema (JSON — boş bırakılabilir)</label>
              <textarea
                value={draft.css}
                onChange={(e) => setDraft((d) => ({ ...d, css: e.target.value }))}
                spellCheck={false}
                placeholder={'{\n  "name": "product",\n  "baseSelector": ".product",\n  "fields": [{ "name": "title", "selector": "h1", "type": "text" }]\n}'}
                className="h-40 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed"
              />
            </div>

            {testResult && (
              <Alert variant={testResult.verdict === 'pass' ? undefined : 'destructive'}>
                <AlertTitle>Test: {testResult.verdict === 'pass' ? 'geçti' : 'kaldı'} ({testResult.passed}/{testResult.total})</AlertTitle>
                <AlertDescription>
                  <div className="mt-1 space-y-1">
                    {(testResult.samples || []).map((s, i) => (
                      <div key={i} className="truncate text-xs">
                        {s.ok ? '✓' : '✗'} {s.url} {s.ok ? `· ${nfmt(s.chars)} karakter` : `· ${s.error || 'içerik alınamadı'}`}
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" size="sm" disabled={testing} onClick={runTest} title="Örnek sayfalarda çalıştırır — 1 dakikaya kadar sürebilir">
                {testing ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />} Test et
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setDraft(null); setTestResult(null); }}>İptal</Button>
                <Button size="sm" disabled={committing} onClick={saveDraft}>
                  {committing ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Kaydet
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Şemayı otomatik ürettir</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Analizör örnek sayfalardan css_schema çıkarır. Arka planda çalışır — kuyruğa alındıktan
          birkaç dakika sonra bu listede belirir.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1 space-y-1">
            <label className="text-2sm font-medium">Pattern</label>
            <Input value={genPattern.pattern} onChange={(e) => setGenPattern((g) => ({ ...g, pattern: e.target.value }))} placeholder="/blog/*" />
          </div>
          <div className="w-36 space-y-1">
            <label className="text-2sm font-medium">Aile</label>
            <Select value={genPattern.family} onValueChange={(v) => setGenPattern((g) => ({ ...g, family: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCHEMA_FAMILIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" disabled={generating} onClick={runGenerate}>
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />} Ürettir
          </Button>
        </div>
      </div>
    </div>
  );
}

function DomainFormModal({ mode, domain, onSubmit, onClose }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    domain: '',
    companyId: isEdit ? (domain?.companyId || '') : '',
    site_type: '',
    seedWeight: '',
    autoStart: isEdit ? 'keep' : 'true',
    sitemap: '',
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('general'); // düzenlemede: general | schemas

  const submit = async () => {
    const payload = {};
    if (isEdit) {
      payload.domain = domain.domain;
      if (form.companyId.trim()) payload.companyId = form.companyId.trim();
      if (form.site_type) payload.site_type = form.site_type;
      if (form.seedWeight !== '') payload.seedWeight = Number(form.seedWeight);
      if (form.autoStart !== 'keep') payload.autoStartScraping = form.autoStart === 'true';
      if (Object.keys(payload).length <= 1) { setErr({ error: 'Değişiklik yok.' }); return; }
    } else {
      if (!form.domain.trim()) { setErr({ error: 'Domain zorunlu.' }); return; }
      payload.domain = form.domain.trim();
      if (form.companyId.trim()) payload.companyId = form.companyId.trim();
      if (form.site_type) payload.site_type = form.site_type;
      payload.autoStartScraping = form.autoStart === 'true';
      const sm = form.sitemap.split(/\s+/).map((x) => x.trim()).filter(Boolean);
      if (sm.length) payload.sitemap = sm;
    }
    setErr(null); setSaving(true);
    try { await onSubmit(payload); onClose(); }
    catch (e) { setErr(upstreamErr(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className={cn('flex max-h-[90vh] w-full flex-col', isEdit ? 'max-w-2xl' : 'max-w-md')} onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate">{isEdit ? `Domain düzenle · ${domain.domain}` : 'Domain ekle'}</CardTitle>
          <CardToolbar><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></CardToolbar>
        </CardHeader>
        {isEdit && (
          <div className="flex gap-1 border-b border-border px-5">
            {[{ k: 'general', label: 'Genel', icon: SlidersHorizontal }, { k: 'schemas', label: 'Şemalar', icon: Braces }].map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => setTab(t.k)}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  tab === t.k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <t.icon className="size-3.5" /> {t.label}
              </button>
            ))}
          </div>
        )}
        <CardContent className={cn('space-y-3 overflow-y-auto p-5', isEdit && tab === 'schemas' && 'space-y-0')}>
          {isEdit && tab === 'schemas' ? <DomainSchemasPanel domain={domain.domain} /> : (
          <>
          {err && <Alert variant="destructive"><AlertDescription>{err.error || 'İşlem başarısız.'}</AlertDescription></Alert>}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-2sm font-medium">Domain *</label>
              <Input value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} placeholder="example.com" />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-2sm font-medium">Firma {isEdit ? '' : '(opsiyonel)'}</label>
            <CompanySelect
              value={form.companyId}
              initialLabel={isEdit ? (domain?.companyContext?.company?.name || '') : ''}
              onChange={(id) => setForm((f) => ({ ...f, companyId: id }))}
              placeholder="Firma ara ve seç"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-2sm font-medium">Site tipi</label>
              <Select value={form.site_type || 'auto'} onValueChange={(v) => setForm((f) => ({ ...f, site_type: v === 'auto' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Otomatik</SelectItem>
                  {SITE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-2sm font-medium">Scraping</label>
              <Select value={form.autoStart} onValueChange={(v) => setForm((f) => ({ ...f, autoStart: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isEdit && <SelectItem value="keep">(değiştirme)</SelectItem>}
                  <SelectItem value="true">Açık</SelectItem>
                  <SelectItem value="false">Kapalı</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <label className="text-2sm font-medium">Seed ağırlığı</label>
              <Input value={form.seedWeight} inputMode="decimal" onChange={(e) => setForm((f) => ({ ...f, seedWeight: e.target.value }))} placeholder="değiştirme için boş bırak" />
            </div>
          )}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-2sm font-medium">Sitemap URL'leri (opsiyonel, satır/boşlukla ayır)</label>
              <Input value={form.sitemap} onChange={(e) => setForm((f) => ({ ...f, sitemap: e.target.value }))} placeholder="https://.../sitemap.xml" />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
            <Button size="sm" disabled={saving} onClick={submit}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} {isEdit ? 'Kaydet' : 'Ekle'}
            </Button>
          </div>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VerifyDomainModal({ domain, onSubmit, onClose }) {
  const [isVerified, setIsVerified] = useState(domain?.verification?.isVerified ?? true);
  const [verifiedBy, setVerifiedBy] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setErr(null); setSaving(true);
    try {
      await onSubmit({ domain: domain.domain, isVerified, verifiedBy: verifiedBy.trim() || undefined, note: note.trim() || undefined });
      onClose();
    } catch (e) { setErr(upstreamErr(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate">Doğrulama · {domain.domain}</CardTitle>
          <CardToolbar><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {err && (err.requirements
            ? <Alert variant="destructive"><AlertTitle>Doğrulamaya uygun değil</AlertTitle>
                <AlertDescription>companyId gerekli (şu an: {err.current?.hasCompanyId ? 'var' : 'yok'}) · Keşfedilen URL {err.current?.discoveredUrls ?? 0} / gerekli {err.requirements?.minDiscoveredUrls}</AlertDescription></Alert>
            : <Alert variant="destructive"><AlertDescription>{err.error || 'Doğrulama başarısız.'}</AlertDescription></Alert>)}
          <div className="space-y-1.5">
            <label className="text-2sm font-medium">Durum</label>
            <Select value={isVerified ? 'true' : 'false'} onValueChange={(v) => setIsVerified(v === 'true')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Doğrulandı</SelectItem>
                <SelectItem value="false">Doğrulanmadı</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-2sm font-medium">Doğrulayan (opsiyonel)</label>
            <Input value={verifiedBy} onChange={(e) => setVerifiedBy(e.target.value)} placeholder="admin@..." />
          </div>
          <div className="space-y-1.5">
            <label className="text-2sm font-medium">Not (opsiyonel)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="—" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
            <Button size="sm" disabled={saving} onClick={submit}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />} Uygula
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DeleteDomainModal({ domain, onConfirm, onClose }) {
  const [typed, setTyped] = useState('');
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const match = typed.trim() === domain.domain;

  const submit = async () => {
    if (!match) return;
    setErr(null); setSaving(true);
    try { await onConfirm(domain.domain); onClose(); }
    catch (e) { setErr(upstreamErr(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate text-destructive">Domaini KALICI sil · {domain.domain}</CardTitle>
          <CardToolbar><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 p-5 text-sm">
          <Alert variant="destructive">
            <AlertTitle>Bu işlem geri alınamaz</AlertTitle>
            <AlertDescription>Domain, crawl'ı ve türetilmiş ürünler (productization) <b>kalıcı</b> silinir. Paylaşımlı bir crawl ise diğer tüketiciler de etkilenir. Yalnızca firma bağını koparmak istiyorsan bunun yerine aboneliği kaldır.</AlertDescription>
          </Alert>
          <p className="text-xs text-muted-foreground">
            Domain hemen taramadan çıkarılır; bağlı crawl verisinin temizliği veri hacmine göre
            arka planda dakikalar sürebilir. İlerlemeyi listedeki <b>Siliniyor…</b> rozetinden
            izleyebilirsiniz — takılırsa aynı silmeyi tekrar çalıştırmak güvenlidir.
          </p>
          {err?.error === 'domain_has_subscribers' ? (
            <Alert variant="destructive">
              <AlertTitle className="flex items-center gap-1.5">
                <Users className="size-4" /> {err.subscriberCount} firma bu domaine abone
              </AlertTitle>
              <AlertDescription>
                <p>
                  Silme engellendi. Abonelikler kaldırılmadan domain silinirse firmaların
                  embedding'leri yetim kalır — kaynak yokken aramada çıkmaya devam ederler.
                  Önce <b>Abonelikler</b> sekmesinden aşağıdakileri kaldırın.
                </p>
                <div className="mt-2 space-y-1">
                  {(err.subscribers || []).slice(0, 8).map((s) => (
                    <div key={s.subscriptionId} className="flex items-center gap-2 text-xs">
                      <Badge variant={subStateVariant(s.state)}>{s.state}</Badge>
                      <CompanyOwnerCell companyId={s.companyId} />
                    </div>
                  ))}
                  {(err.subscribers || []).length > 8
                    ? <p className="text-xs">+{err.subscribers.length - 8} firma daha</p> : null}
                </div>
              </AlertDescription>
            </Alert>
          ) : err ? (
            <Alert variant="destructive"><AlertDescription>{err.error || err.details || 'Silme başarısız.'}</AlertDescription></Alert>
          ) : null}
          <div className="space-y-1.5">
            <label className="text-2sm font-medium">Onaylamak için domaini yaz: <span className="font-mono">{domain.domain}</span></label>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={domain.domain} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
            <Button variant="destructive" size="sm" disabled={!match || saving} onClick={submit}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Kalıcı sil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UrlContentModal({ domain, urlId, url, onClose }) {
  const { data, isFetching, isError } = useGetFetcherUrlContentQuery({ domain, urlId });
  const body = data?.clean_markdown || data?.markdown || '';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="flex max-h-[90vh] w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate">{data?.title || 'İçerik'}</CardTitle>
          <CardToolbar>
            {data ? <Badge variant={data.has_content ? 'success' : 'muted'}>{data.has_content ? 'İçerik var' : 'İçerik yok'}</Badge> : null}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 overflow-y-auto p-5">
          <p className="truncate text-xs text-muted-foreground">{url}</p>
          {isError ? (
            <Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>İçerik alınamadı.</AlertDescription></Alert>
          ) : isFetching ? (
            <Skeleton className="h-48 w-full" />
          ) : !data?.has_content ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center"><FileText className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">Bu URL için taranmış içerik yok.</p></div>
          ) : (
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed">{body}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ScrapingConfigModal({ domain, onReset, onClose }) {
  const dn = domain.domain;
  const { data, isFetching, isError, error } = useGetScrapingConfigQuery(dn);
  const noConfig = isError && error?.status === 404;
  const [text, setText] = useState('{\n  "strategy": "auto",\n  "url_schemas": []\n}');
  const [msg, setMsg] = useState(null);
  const [saveCfg, { isLoading: saving }] = useSaveScrapingConfigMutation();
  const [deleteCfg, { isLoading: deleting }] = useDeleteScrapingConfigMutation();

  useEffect(() => {
    const cfg = data?.scraping_config;
    if (cfg && typeof cfg === 'object') setText(JSON.stringify(cfg, null, 2));
  }, [data]);

  const save = async () => {
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { setMsg({ tone: 'destructive', text: 'Geçersiz JSON.' }); return; }
    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
      setMsg({ tone: 'destructive', text: 'Config bir JSON nesnesi olmalı.' }); return;
    }
    setMsg(null);
    try {
      const res = await saveCfg({ domain: dn, ...parsed }).unwrap();
      setMsg({ tone: 'success', text: `Kaydedildi · strateji: ${res?.strategy ?? '—'} · ${res?.url_schemas_count ?? 0} şema` });
    } catch (e) {
      setMsg({ tone: 'destructive', text: upstreamErr(e).error || 'Kaydedilemedi.' });
    }
  };

  const removeCfg = async () => {
    if (!window.confirm(`${dn} scraping config'i silinsin mi?`)) return;
    setMsg(null);
    try {
      await deleteCfg(dn).unwrap();
      setText('{\n  "strategy": "auto",\n  "url_schemas": []\n}');
      setMsg({ tone: 'success', text: 'Config silindi.' });
    } catch (e) { setMsg({ tone: 'destructive', text: upstreamErr(e).error || 'Silinemedi.' }); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate">Scraping Config · {dn}</CardTitle>
          <CardToolbar><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 overflow-y-auto p-5">
          {isFetching ? <Skeleton className="h-48 w-full" /> : (
            <>
              {noConfig && <Alert><AlertDescription>Bu domain için config yok — aşağıdaki şablonu düzenleyip kaydedebilirsin.</AlertDescription></Alert>}
              {isError && !noConfig && <Alert variant="destructive"><AlertDescription>Config alınamadı.</AlertDescription></Alert>}
              {msg && <Alert variant={msg.tone === 'destructive' ? 'destructive' : undefined}><AlertDescription>{msg.text}</AlertDescription></Alert>}
              <p className="text-xs text-muted-foreground">Tüm config (strateji: css/xpath/json/auto · url_schemas: her biri <b>pattern</b> veya <b>sitemaps</b> zorunlu). Kaydet objenin <b>tamamını</b> değiştirir.</p>
              <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
                className="h-72 w-full resize-y rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" size="sm" className="text-destructive" disabled={deleting || noConfig} onClick={removeCfg}>
                  {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Config'i sil
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="border-destructive/40 text-destructive" onClick={() => onReset(domain)}>
                    <RotateCw className="size-3.5" /> Crawl'ı resetle
                  </Button>
                  <Button size="sm" disabled={saving} onClick={save}>
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : null} Kaydet
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResetModal({ domain, onConfirm, onClose }) {
  const dn = domain.domain;
  const [typed, setTyped] = useState('');
  const [purgeS3, setPurgeS3] = useState(false);
  const [sitemap, setSitemap] = useState('');
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const match = typed.trim() === dn;

  const submit = async () => {
    if (!match) return;
    const payload = { domain: dn, purge_s3: purgeS3 };
    const sm = sitemap.split(/\s+/).map((x) => x.trim()).filter(Boolean);
    if (sm.length) payload.sitemap = sm;
    setErr(null); setSaving(true);
    try { await onConfirm(payload); onClose(); }
    catch (e) {
      const u = upstreamErr(e);
      setErr(e?.status === 504 ? 'İşlem arka planda sürüyor — listeyi yenileyin.' : (u.error || u.details || 'Reset başarısız.'));
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate text-destructive">Crawl'ı KALICI resetle · {dn}</CardTitle>
          <CardToolbar><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 p-5 text-sm">
          <Alert variant="destructive">
            <AlertTitle>Bu işlem geri alınamaz</AlertTitle>
            <AlertDescription>Keşfedilen URL'ler + crawl artifact'leri silinir, türetilmiş ürünler (productization) purge edilir ve crawl <b>baştan</b> başlar. Domain kaydı ve config korunur.</AlertDescription>
          </Alert>
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
          <div className="space-y-1.5">
            <label className="text-2sm font-medium">Sitemap (opsiyonel, boşsa mevcut kullanılır)</label>
            <Input value={sitemap} onChange={(e) => setSitemap(e.target.value)} placeholder="https://.../sitemap.xml" />
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2">
            <input type="checkbox" checked={purgeS3} onChange={(e) => setPurgeS3(e.target.checked)} />
            <span><b>S3 içeriğini de sil</b> (tüm taranmış ham sayfalar) — geri alınamaz</span>
          </label>
          <div className="space-y-1.5">
            <label className="text-2sm font-medium">Onaylamak için domaini yaz: <span className="font-mono">{dn}</span></label>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={dn} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
            <Button variant="destructive" size="sm" disabled={!match || saving} onClick={submit}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />} Resetle
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ════════════ Domainler ════════════ */
function DomainsSection({ authorized }) {
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('createdAt:desc'); // varsayılan: son eklenen en üstte
  const [verified, setVerified] = useState('all');
  const [hasSchema, setHasSchema] = useState('all');
  const [companyId, setCompanyId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);

  // Filtre değişince ilk sayfaya dön — aksi halde 5. sayfada boş liste görünür.
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  const [sortBy, order] = sort.split(':');
  const params = { page, limit: PAGE_SIZE, sort: sortBy, order };
  if (status !== 'all') params.status = status;
  if (verified !== 'all') params.verified = verified;
  if (hasSchema !== 'all') params.hasSchema = hasSchema;
  if (companyId) params.companyId = companyId;
  if (search) params.search = search;
  const { data, isFetching, isError, refetch } = useGetFetcherDomainsQuery(params, { skip: !authorized });
  const activeFilters = [
    status !== 'all', verified !== 'all', hasSchema !== 'all', Boolean(companyId), Boolean(search),
  ].filter(Boolean).length;
  const clearFilters = () => {
    setStatus('all'); setVerified('all'); setHasSchema('all');
    setCompanyId(''); setSearch(''); setSearchInput(''); setPage(1);
  };
  const domains = data?.domains ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [startScraping] = useStartDomainScrapingMutation();
  const [stopScraping] = useStopDomainScrapingMutation();
  const [restartScraping] = useRestartDomainScrapingMutation();
  const [busy, setBusy] = useState(null); // `${domain}:${action}`

  const [addDomain] = useAddFetcherDomainMutation();
  const [updateDomain] = useUpdateFetcherDomainMutation();
  const [deleteDomain] = useDeleteFetcherDomainMutation();
  const [verifyDomain] = useVerifyFetcherDomainMutation();
  const [resetScraping] = useResetDomainScrapingMutation();
  const [modal, setModal] = useState(null); // { type: 'add'|'edit'|'verify'|'delete'|'config'|'reset', domain? }

  const act = async (fn, domain, action) => {
    setBusy(`${domain}:${action}`);
    await fn(domain).unwrap().catch(() => {});
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[240px] flex-1 items-center gap-2">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput.trim()); setPage(1); } }}
                placeholder="Domain adında ara…"
              />
              <Button variant="outline" size="icon" onClick={() => { setSearch(searchInput.trim()); setPage(1); }}>
                <Search className="size-4" />
              </Button>
            </div>
            <div className="ms-auto flex gap-2">
              <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
                <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setModal({ type: 'add' })}><Plus className="size-4" /> Domain Ekle</Button>
              <Button size="sm" onClick={() => setModal({ type: 'wizard' })}><Wand2 className="size-4" /> Sihirbaz</Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40">
              <Select value={status} onValueChange={reset(setStatus)}>
                <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm durumlar</SelectItem>
                  {DOMAIN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select value={verified} onValueChange={reset(setVerified)}>
                <SelectTrigger><SelectValue placeholder="Doğrulama" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Doğrulama: hepsi</SelectItem>
                  <SelectItem value="true">Doğrulanmış</SelectItem>
                  <SelectItem value="false">Doğrulanmamış</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select value={hasSchema} onValueChange={reset(setHasSchema)}>
                <SelectTrigger><SelectValue placeholder="Şema" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Şema: hepsi</SelectItem>
                  <SelectItem value="true">Şeması var</SelectItem>
                  <SelectItem value="false">Şeması yok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-56">
              <CompanySelect value={companyId} onChange={reset(setCompanyId)} placeholder="Firmaya göre filtrele" />
            </div>
            <div className="w-56">
              <Select value={sort} onValueChange={reset(setSort)}>
                <SelectTrigger><SelectValue placeholder="Sıralama" /></SelectTrigger>
                <SelectContent>
                  {DOMAIN_SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs text-muted-foreground">{nfmt(total)} domain</span>
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
                <Undo2 className="size-3.5" /> Filtreleri temizle ({activeFilters})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0 py-0">
          {isError ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Domain listesi alınamadı.</AlertDescription></Alert></div>
          ) : isFetching && domains.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : domains.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Domain yok</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Firma / Kullanıcı</TableHead>
                    <TableHead className="text-right">Abone</TableHead>
                    <TableHead className="text-right">Şema</TableHead>
                    <TableHead className="text-right">Sayfa</TableHead>
                    <TableHead>Son Tarama</TableHead>
                    <TableHead>Doğrulama</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((d) => {
                    const del = deletionState(d);
                    const schemaCount = domainSchemas(d).length;
                    return (
                    <TableRow key={d.domain} className={cn('cursor-pointer', del && 'opacity-70')} onClick={() => setDetail(d.domain)}>
                      <TableCell>
                        <div className="font-medium text-foreground">{d.domain}</div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{d.locate || '—'}</span>
                          {d.site_profile?.site_type ? <><span>·</span><span>{d.site_profile.site_type}</span></> : null}
                          {d.robots?.status && d.robots.status !== 'OK'
                            ? <><span>·</span><span className="text-amber-600">robots: {d.robots.status}</span></> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {del
                          ? <Badge variant={del.variant} title={del.error || undefined}>{del.label}</Badge>
                          : <Badge variant={domainStatusVariant(d.status)}>{d.status || '—'}</Badge>}
                        {d.sitemap_stats?.processing_status === 'RUNNING'
                          ? <div className="mt-0.5 text-xs text-muted-foreground">sitemap işleniyor</div> : null}
                      </TableCell>
                      <TableCell className="max-w-[200px]"><CompanyOwnerCell companyId={d.companyId} context={d.companyContext} /></TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground"
                        title={`Abonelik: ${d.subscriptionCount ?? 0} · Legacy bilgi sahibi: ${d.legacyOwnerCount ?? 0}`}>
                        {d.subscriberCount ? d.subscriberCount : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {schemaCount ? schemaCount : <span className="text-amber-600">yok</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {nfmt(d.stats?.total_pages_crawled)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground" title={formatTr(d.stats?.last_crawl_at)}>
                        {relativeTr(d.stats?.last_crawl_at)}
                      </TableCell>
                      <TableCell>
                        {d.verification?.isVerified
                          ? <Badge variant="success">Doğrulandı</Badge>
                          : <Badge variant="muted">{d.verification?.status || 'Beklemede'}</Badge>}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-7" title="Başlat"
                            disabled={busy === `${d.domain}:start`} onClick={() => act(startScraping, d.domain, 'start')}>
                            {busy === `${d.domain}:start` ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 text-green-600" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Durdur"
                            disabled={busy === `${d.domain}:stop`} onClick={() => act(stopScraping, d.domain, 'stop')}>
                            {busy === `${d.domain}:stop` ? <Loader2 className="size-3.5 animate-spin" /> : <Square className="size-3.5 text-amber-600" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Yeniden başlat"
                            disabled={busy === `${d.domain}:restart`} onClick={() => act(restartScraping, d.domain, 'restart')}>
                            {busy === `${d.domain}:restart` ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Düzenle & şemalar" onClick={() => setModal({ type: 'edit', domain: d })}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Doğrula" onClick={() => setModal({ type: 'verify', domain: d })}>
                            <ShieldCheck className="size-3.5 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Ham scraping config (JSON)" onClick={() => setModal({ type: 'config', domain: d })}>
                            <SlidersHorizontal className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Kalıcı sil" onClick={() => setModal({ type: 'delete', domain: d })}>
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border p-3">
              <span className="text-xs text-muted-foreground">Sayfa {page} / {pageCount}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>Önceki</Button>
                <Button variant="outline" size="sm" disabled={page >= pageCount || isFetching} onClick={() => setPage((p) => p + 1)}>Sonraki</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {detail && <DomainDetail domain={detail} onClose={() => setDetail(null)} />}
      {modal?.type === 'wizard' && <DomainWizard onDone={() => refetch()} onClose={() => setModal(null)} />}
      {modal?.type === 'add' && <DomainFormModal mode="add" onSubmit={(body) => addDomain(body).unwrap()} onClose={() => setModal(null)} />}
      {modal?.type === 'edit' && <DomainFormModal mode="edit" domain={modal.domain} onSubmit={(body) => updateDomain(body).unwrap()} onClose={() => setModal(null)} />}
      {modal?.type === 'verify' && <VerifyDomainModal domain={modal.domain} onSubmit={(body) => verifyDomain(body).unwrap()} onClose={() => setModal(null)} />}
      {modal?.type === 'delete' && <DeleteDomainModal domain={modal.domain} onConfirm={(d) => deleteDomain(d).unwrap()} onClose={() => setModal(null)} />}
      {modal?.type === 'config' && <ScrapingConfigModal domain={modal.domain} onReset={(d) => setModal({ type: 'reset', domain: d })} onClose={() => setModal(null)} />}
      {modal?.type === 'reset' && <ResetModal domain={modal.domain} onConfirm={(payload) => resetScraping(payload).unwrap()} onClose={() => setModal(null)} />}
    </div>
  );
}

function DomainDetail({ domain, onClose }) {
  const { data: doc, isFetching } = useGetFetcherDomainQuery(domain);
  const { data: statsData } = useGetFetcherDomainStatsQuery(domain);
  const { data: urlsData, isFetching: urlsLoading } = useGetFetcherDomainUrlsQuery({ domain, page: 1, limit: 10 });
  const stats = statsData?.stats || {};
  const urls = urlsData?.urls || [];

  const [createUrl, { isLoading: creatingUrl }] = useCreateFetcherDomainUrlMutation();
  const [deleteUrl] = useDeleteFetcherDomainUrlMutation();
  const [newUrl, setNewUrl] = useState('');
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [busyUrl, setBusyUrl] = useState(null);
  const [urlErr, setUrlErr] = useState(null);
  const [content, setContent] = useState(null); // { urlId, url }

  const addUrl = async () => {
    if (!newUrl.trim()) return;
    setUrlErr(null);
    try {
      await createUrl({ domain, url: newUrl.trim() }).unwrap();
      setNewUrl(''); setShowUrlForm(false);
    } catch (e) {
      setUrlErr(e?.status === 409 ? 'Bu URL zaten var.' : (upstreamErr(e).error || 'URL eklenemedi.'));
    }
  };

  const removeUrl = async (u) => {
    if (!window.confirm(`URL silinsin mi?\n${u.url}`)) return;
    setBusyUrl(u.id);
    await deleteUrl({ domain, urlId: u.id }).unwrap().catch(() => {});
    setBusyUrl(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
        <Card className="flex max-h-[90vh] w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
          <CardHeader>
            <CardTitle className="truncate">{domain}</CardTitle>
            <CardToolbar>
              {doc && <Badge variant={domainStatusVariant(doc.status)}>{doc.status}</Badge>}
              <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
            </CardToolbar>
          </CardHeader>
          <CardContent className="space-y-4 overflow-y-auto p-5">
            {isFetching ? <Skeleton className="h-40 w-full" /> : !doc ? (
              <p className="text-sm text-muted-foreground">Domain bulunamadı.</p>
            ) : (
              <>
                {deletionState(doc) && (
                  <Alert variant={doc.deletion?.state === 'failed' ? 'destructive' : undefined}>
                    <AlertTitle className="flex items-center gap-1.5">
                      {doc.deletion?.state === 'failed' ? <AlertTriangle className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
                      {deletionState(doc).label}
                    </AlertTitle>
                    <AlertDescription>
                      {doc.deletion?.state === 'failed'
                        ? <>Arka plan temizliği hata verdi: {doc.deletion.error || 'bilinmeyen hata'}. Silmeyi tekrar deneyebilirsiniz — işlem idempotent.</>
                        : <>Domain taramadan çıkarıldı; bağlı crawl verisi arka planda siliniyor. Başladı: {formatTr(doc.deletion?.startedAt)}</>}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                  <div><span className="text-muted-foreground">Ülke: </span>{doc.locate || '—'}</div>
                  <div><span className="text-muted-foreground">Site tipi: </span>{doc.site_profile?.site_type || '—'}</div>
                  <div><span className="text-muted-foreground">Öncelik: </span>{doc.priority ?? '—'}</div>
                  <div className="col-span-2 min-w-0">
                    <span className="text-muted-foreground">Firma / Kullanıcı: </span>
                    <CompanyOwnerCell companyId={doc.companyId} context={doc.companyContext} />
                  </div>
                  <div><span className="text-muted-foreground">Abone: </span>{doc.subscriberCount ?? (doc.informationOwners?.length || 0)}</div>
                  <div><span className="text-muted-foreground">Doğrulama: </span>{doc.verification?.isVerified ? 'Doğrulandı' : (doc.verification?.status || 'Beklemede')}</div>
                  <div><span className="text-muted-foreground">Strateji: </span>{doc.scraping_config?.strategy || '—'}</div>
                  <div><span className="text-muted-foreground">Şema: </span>{domainSchemas(doc).length || 'yok'}</div>
                  <div><span className="text-muted-foreground">Kapsam: </span>{doc.config?.crawl_scope || '—'}</div>
                  <div><span className="text-muted-foreground">Maks. sayfa: </span>{nfmt(doc.config?.max_pages)}</div>
                  <div><span className="text-muted-foreground">Recrawl: </span>{doc.config?.recrawl_interval_days != null ? `${doc.config.recrawl_interval_days} gün` : '—'}</div>
                  <div><span className="text-muted-foreground">Oto-başlat: </span>{doc.autoStartScraping === false ? 'Kapalı' : doc.autoStartScraping ? 'Açık' : '—'}</div>
                  <div><span className="text-muted-foreground">robots: </span>{doc.robots?.status || '—'}</div>
                  <div><span className="text-muted-foreground">Keşif modu: </span>{doc.discovery_mode || 'sitemap'}</div>
                  <div><span className="text-muted-foreground">Analiz: </span>{doc.extraction_analysis?.state || '—'}</div>
                  <div><span className="text-muted-foreground">Oluşturma: </span>{formatTr(doc.createdAt)}</div>
                  <div><span className="text-muted-foreground">Güncelleme: </span>{formatTr(doc.updatedAt)}</div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarama Metrikleri</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                    <div><span className="text-muted-foreground">Taranan sayfa: </span>{nfmt(doc.stats?.total_pages_crawled)}</div>
                    <div><span className="text-muted-foreground">Tur sayısı: </span>{nfmt(doc.stats?.cycle_count)}</div>
                    <div><span className="text-muted-foreground">İlk tarama: </span>{formatTr(doc.stats?.first_crawl_at)}</div>
                    <div><span className="text-muted-foreground">Son tarama: </span>{formatTr(doc.stats?.last_crawl_at)}</div>
                    <div><span className="text-muted-foreground">Son tur: </span>{formatTr(doc.stats?.last_cycle_at)}</div>
                    <div><span className="text-muted-foreground">Sıradaki: </span>{formatTr(stats?.next_scheduled?.at)}</div>
                  </div>
                </div>

                {doc.sitemap_stats && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sitemap</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant={doc.sitemap_stats.processing_status === 'DONE' ? 'success' : doc.sitemap_stats.processing_status === 'ERROR' ? 'destructive' : 'warning'}>
                        {doc.sitemap_stats.processing_status || '—'}
                      </Badge>
                      <span className="text-muted-foreground">{nfmt(doc.sitemap_stats.total_urls)} URL</span>
                      <span className="text-muted-foreground">Son ayrıştırma: {formatTr(doc.sitemap_stats.last_parsed_at)}</span>
                    </div>
                    {doc.sitemap_stats.last_error
                      ? <p className="mt-1 text-xs text-destructive">{doc.sitemap_stats.last_error}</p> : null}
                  </div>
                )}

                {Array.isArray(doc.sitemap_urls) && doc.sitemap_urls.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {doc.sitemap_urls.slice(0, 6).map((s, i) => <Badge key={i} variant="muted">{s}</Badge>)}
                    {doc.sitemap_urls.length > 6 ? <Badge variant="muted">+{doc.sitemap_urls.length - 6}</Badge> : null}
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">URL Durum Dağılımı</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(stats).length === 0 ? <span className="text-sm text-muted-foreground">Veri yok.</span>
                      : Object.entries(stats).map(([k, v]) => (
                          <Badge key={k} variant={urlStatusVariant(k)}>{k}: {v}</Badge>
                        ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Son URL'ler</p>
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setShowUrlForm((v) => !v)}><Plus className="size-3.5" /> URL Ekle</Button>
                  </div>
                  {showUrlForm && (
                    <div className="mb-2 flex gap-2">
                      <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com/sayfa" />
                      <Button size="sm" disabled={!newUrl.trim() || creatingUrl} onClick={addUrl}>{creatingUrl ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}</Button>
                    </div>
                  )}
                  {urlErr && <Alert variant="destructive" className="mb-2"><AlertDescription>{urlErr}</AlertDescription></Alert>}
                  {urlsLoading ? <Skeleton className="h-24 w-full" /> : urls.length === 0 ? (
                    <p className="text-sm text-muted-foreground">URL yok.</p>
                  ) : (
                    <div className="space-y-1">
                      {urls.map((u) => (
                        <div key={u.id || u.url} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                          <span className="min-w-0 truncate">{u.url}</span>
                          <div className="flex shrink-0 items-center gap-1">
                            <Badge variant={urlStatusVariant(u.status)}>{u.status}</Badge>
                            <Button variant="ghost" size="icon" className="size-7" title="İçeriği gör" disabled={!u.id} onClick={() => setContent({ urlId: u.id, url: u.url })}><FileText className="size-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="size-7" title="Sil" disabled={!u.id || busyUrl === u.id} onClick={() => removeUrl(u)}>{busyUrl === u.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5 text-destructive" />}</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      {content && <UrlContentModal domain={domain} urlId={content.urlId} url={content.url} onClose={() => setContent(null)} />}
    </>
  );
}

/* ════════════ Crawl Logları ════════════ */
/**
 * DİKKAT: bu uç artık toplam kayıt SAYMIYOR ve zaman penceresi zorunlu.
 * `crawl_logs` her fetch için bir satır yazıyor ve hiç budanmıyor; eski hâlinde
 * her istek `count_documents` ile koleksiyonu tam tarayıp timeout'a gidiyordu.
 * Bu yüzden burada "N kayıt" rozeti yok — sayfalama `has_more` ile yürüyor.
 */
function LogsSection({ authorized }) {
  const [domainInput, setDomainInput] = useState('');
  const [domain, setDomain] = useState('');
  const [hours, setHours] = useState('24');
  const [page, setPage] = useState(1);

  const params = { page, limit: PAGE_SIZE, hours: Number(hours) };
  if (domain) params.domain = domain;
  const { data, isFetching, isError, refetch } = useGetFetcherLogsQuery(params, { skip: !authorized });
  const logs = data?.logs ?? [];
  const hasMore = Boolean(data?.has_more);

  const applyDomain = () => { setDomain(domainInput.trim()); setPage(1); };
  const windowLabel = LOG_WINDOWS.find((w) => w.value === hours)?.label ?? `Son ${hours} saat`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <Input value={domainInput} onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyDomain()}
              placeholder="Domaine göre filtrele…" />
            <Button variant="outline" size="icon" onClick={applyDomain}><Search className="size-4" /></Button>
          </div>
          <div className="w-40">
            <Select value={hours} onValueChange={(v) => { setHours(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOG_WINDOWS.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crawl Logları</CardTitle>
          <CardToolbar>
            <Badge variant="muted" className="gap-1"><Clock className="size-3" /> {windowLabel}</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <div className="px-5 pb-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Log koleksiyonu her taranan sayfa için satır yazar ve çok büyür; bu yüzden liste
              yalnız seçili zaman penceresini gösterir ve toplam kayıt sayılmaz. Daha dar bir
              pencere ya da domain filtresi sorguyu belirgin şekilde hızlandırır.
            </p>
          </div>
          {isError ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Log listesi alınamadı. Daha dar bir zaman penceresi deneyin.</AlertDescription></Alert></div>
          ) : isFetching && logs.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Bu pencerede log yok</p>
              <p className="text-sm text-muted-foreground">Zaman aralığını genişletin veya domain filtresini kaldırın.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Parquet</TableHead>
                    <TableHead>Tarih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l, i) => (
                    <TableRow key={l._id || `${l.url}-${i}`}>
                      <TableCell className="max-w-[340px] truncate text-sm text-foreground">{l.url}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.domain || '—'}</TableCell>
                      <TableCell><Badge variant={httpVariant(l.status_code)}>{l.status_code ?? '—'}</Badge></TableCell>
                      <TableCell>{l.parquet_written ? <Badge variant="success">Yazıldı</Badge> : <Badge variant="muted">—</Badge>}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTr(l.fetched_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {(page > 1 || hasMore) && (
            <div className="flex items-center justify-between border-t border-border p-3">
              <span className="text-xs text-muted-foreground">Sayfa {page}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>Önceki</Button>
                <Button variant="outline" size="sm" disabled={!hasMore || isFetching} onClick={() => setPage((p) => p + 1)}>Sonraki</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


/* ════════════ Node'lar ════════════ */
function NodesSection({ authorized }) {
  // DİKKAT: fetcher (app.py list_nodes) bu flag'leri `== "1"` ile okur — `true`
  // gönderilirse false'a düşer ve pasif node'lar sessizce listeden kaybolur.
  const [scope, setScope] = useState('all'); // varsayılan: pasif node'lar da görünsün
  const { data, isFetching, isError, refetch } = useGetFetcherNodesQuery(
    scope === 'all' ? { include_disabled: 1, include_offline: 1 } : {},
    { skip: !authorized, pollingInterval: 20000 },
  );
  const nodes = data?.nodes ?? [];
  const passiveCount = nodes.filter((n) => nodeState(n).passive).length;

  const [nodeAction] = useNodeActionMutation();
  const [deleteNode] = useDeleteFetcherNodeMutation();
  const [createNode, { isLoading: creating }] = useCreateFetcherNodeMutation();
  const [busy, setBusy] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ node_url: '', node_id: '' });

  const run = async (nodeId, action) => {
    setBusy(`${nodeId}:${action}`);
    if (action === 'delete') {
      // Backend (fetcher) kaydı gerçekten siler — decommission değil, geri dönüşü yok.
      // Node'u sadece pasifleştirmek için "Durdur" kullanılmalı.
      if (window.confirm(`"${nodeId}" node kaydı KALICI olarak silinsin mi?\n\nBu geri alınamaz — node yeniden heartbeat gönderene kadar listeye dönmez. Sadece devre dışı bırakmak için "Durdur" kullanın.`)) {
        await deleteNode(nodeId).unwrap().catch(() => {});
      }
    } else {
      await nodeAction({ nodeId, action }).unwrap().catch(() => {});
    }
    setBusy(null);
  };

  const submitCreate = async () => {
    if (!form.node_url.trim()) return;
    const body = { node_url: form.node_url.trim() };
    if (form.node_id.trim()) body.node_id = form.node_id.trim();
    await createNode(body).unwrap().catch(() => {});
    setForm({ node_url: '', node_id: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="w-44">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm node'lar</SelectItem>
                <SelectItem value="active">Sadece çalışanlar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground">
            {nodes.length} node{passiveCount > 0 ? ` · ${passiveCount} pasif` : ''}
          </span>
          <div className="ms-auto flex gap-2">
            <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
              <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="size-4" /> Node Ekle</Button>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Node URL *</label>
                <Input value={form.node_url} onChange={(e) => setForm((f) => ({ ...f, node_url: e.target.value }))} placeholder="http://node-host:8000" />
              </div>
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Node ID (opsiyonel)</label>
                <Input value={form.node_id} onChange={(e) => setForm((f) => ({ ...f, node_id: e.target.value }))} placeholder="otomatik" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>İptal</Button>
              <Button size="sm" disabled={!form.node_url.trim() || creating} onClick={submitCreate}>
                {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Ekle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="px-0 py-0">
          {isError ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Node listesi alınamadı.</AlertDescription></Alert></div>
          ) : isFetching && nodes.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Server className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Node yok</p>
              {scope === 'active' && (
                <p className="text-sm text-muted-foreground">Çalışan node yok — pasifleri görmek için "Tüm node'lar"a geçin.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Node</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>İşlemde</TableHead>
                    <TableHead>Son Heartbeat</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodes.map((n) => {
                    const st = nodeState(n);
                    return (
                    <TableRow key={n.node_id} className={cn(st.passive && 'bg-muted/30')}>
                      <TableCell>
                        <div className="font-medium text-foreground">{n.node_id}</div>
                        <div className="max-w-[220px] truncate text-xs text-muted-foreground">{n.node_url}</div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <CircleDot className={cn('size-3', st.dot)} />
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </span>
                        <div className="mt-0.5 text-xs text-muted-foreground">{n.status}{n.enabled === false ? ' · kapalı' : ''}</div>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">{n.metrics?.inflight ?? 0}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTr(n.last_heartbeat)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant={st.passive ? 'outline' : 'ghost'} size="icon" className="size-7" title="Başlat" disabled={busy === `${n.node_id}:start`} onClick={() => run(n.node_id, 'start')}>
                            {busy === `${n.node_id}:start` ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 text-green-600" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Durdur" disabled={busy === `${n.node_id}:stop`} onClick={() => run(n.node_id, 'stop')}>
                            {busy === `${n.node_id}:stop` ? <Loader2 className="size-3.5 animate-spin" /> : <Square className="size-3.5 text-amber-600" />}
                          </Button>
                          <Button variant={st.passive ? 'outline' : 'ghost'} size="icon" className="size-7" title="Yeniden başlat" disabled={busy === `${n.node_id}:restart`} onClick={() => run(n.node_id, 'restart')}>
                            {busy === `${n.node_id}:restart` ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Kaydı kalıcı sil" disabled={busy === `${n.node_id}:delete`} onClick={() => run(n.node_id, 'delete')}>
                            {busy === `${n.node_id}:delete` ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5 text-destructive" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ════════════ Abonelikler ════════════ */
function SubscriptionDetail({ sub, onClose }) {
  const c = sub.contract || {};
  const emb = sub.embedding || {};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate">{sub.domainName}</CardTitle>
          <CardToolbar>
            <Badge variant={subStateVariant(sub.state)}>{sub.state}</Badge>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto p-5 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0"><span className="text-muted-foreground">Firma: </span><CompanyOwnerCell companyId={sub.companyId} /></div>
            <div><span className="text-muted-foreground">Güncelleme: </span>{formatTr(sub.updatedAt)}</div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kontrat</p>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Kapsam: </span>{c.scope || '—'}</div>
              <div><span className="text-muted-foreground">Maks. sayfa: </span>{c.maxPages ?? '—'}</div>
              <div><span className="text-muted-foreground">Recrawl (gün): </span>{c.recrawlIntervalDays ?? '—'}</div>
              <div><span className="text-muted-foreground">Chunk (boyut/örtüşme/min): </span>{c.chunk ? `${c.chunk.size ?? '?'}/${c.chunk.overlap ?? '?'}/${c.chunk.minChars ?? '?'}` : '—'}</div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Embedding</p>
            <div className="flex flex-wrap items-center gap-2">
              {emb.status ? <Badge variant="muted">{emb.status}</Badge> : <span className="text-muted-foreground">Durum yok</span>}
              <span className="tabular-nums text-muted-foreground">{emb.chunkCount != null ? `${emb.chunkCount} chunk` : ''}</span>
              <span className="text-muted-foreground">Son index: {formatTr(emb.lastIndexedAt)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReindexModal({ sub, busy, onSubmit, onClose }) {
  const [clean, setClean] = useState(false);
  const [chunk, setChunk] = useState({ size: '', overlap: '', minChars: '' });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate">Yeniden indexle · {sub.domainName}</CardTitle>
          <CardToolbar><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          <p className="text-xs text-muted-foreground">Chunk alanları boş bırakılırsa mevcut kontrat kullanılır. Yeniden indexleme crawl'a dokunmaz.</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1"><label className="text-2sm">Boyut</label><Input value={chunk.size} inputMode="numeric" onChange={(e) => setChunk((c) => ({ ...c, size: e.target.value }))} placeholder="—" /></div>
            <div className="space-y-1"><label className="text-2sm">Örtüşme</label><Input value={chunk.overlap} inputMode="numeric" onChange={(e) => setChunk((c) => ({ ...c, overlap: e.target.value }))} placeholder="—" /></div>
            <div className="space-y-1"><label className="text-2sm">Min. karakter</label><Input value={chunk.minChars} inputMode="numeric" onChange={(e) => setChunk((c) => ({ ...c, minChars: e.target.value }))} placeholder="—" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} />
            Temiz yeniden index (eski chunk'ları düşür — silme adımı biraz sürebilir)
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
            <Button size="sm" disabled={busy} onClick={() => onSubmit({ clean, ...chunk })}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Başlat
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DeleteSubModal({ sub, busy, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate">Aboneliği kaldır · {sub.domainName}</CardTitle>
          <CardToolbar><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 p-5 text-sm">
          <p className="text-muted-foreground"><b>Pasifleştir</b>: aboneliği durdurur, embedding'leri korur (geri alınabilir). <b>Kalıcı sil</b>: embedding'leri de kaldırır (orphan-önleyici; birkaç saniye sürebilir).</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
            <Button size="sm" disabled={busy} onClick={() => onConfirm('deactivate')}>Pasifleştir</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => { if (window.confirm('Embedding dahil kalıcı silinsin mi? Bu işlem geri alınamaz.')) onConfirm('hard'); }}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Kalıcı sil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Domain başına abone dökümü.
 *
 * Kaynak iki türlü olabilir ve dönen satır bunu `source` ile söyler:
 *  • "subscriptions"      → domain_subscriptions koleksiyonu (yeni akış)
 *  • "informationOwners"  → legacy "firma bu siteyi bilgi tabanına ekledi" kaydı
 * Abonelik akışı feature-flag arkasında olduğu için birçok kurulumda koleksiyon
 * boş kalıyor; o durumda liste sessizce boş görünmesin diye legacy'ye düşülüyor.
 */
function SubscriberStatsCard({ authorized }) {
  const { data, isFetching, isError, refetch } = useGetFetcherSubscriptionStatsQuery(undefined, { skip: !authorized });
  const [expanded, setExpanded] = useState(false);
  const rows = data?.domains ?? [];
  const shown = expanded ? rows : rows.slice(0, 8);
  const legacy = data?.source === 'informationOwners';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="size-4" /> Domain Başına Abone</CardTitle>
        <CardToolbar>
          {legacy ? <Badge variant="warning">legacy kayıt</Badge> : null}
          <span className="text-xs text-muted-foreground">{rows.length} domain</span>
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-2 p-5">
        {legacy && (
          <p className="text-xs text-muted-foreground">
            Abonelik koleksiyonu boş; sayılar domain kaydındaki legacy bilgi-sahibi
            listesinden türetildi. Abonelik akışı açılana kadar normal olan budur.
          </p>
        )}
        {isError ? (
          <Alert variant="destructive"><AlertDescription>Abone dökümü alınamadı.</AlertDescription></Alert>
        ) : isFetching && rows.length === 0 ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hiçbir domaine abone firma yok.</p>
        ) : (
          <>
            <div className="space-y-1">
              {shown.map((r) => (
                <div key={r.domain} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5">
                  <span className="min-w-0 truncate text-sm text-foreground">{r.domain}</span>
                  <Badge variant={r.subscriberCount > 1 ? 'primary' : 'muted'}>
                    {r.subscriberCount} firma
                  </Badge>
                </div>
              ))}
            </div>
            {rows.length > 8 && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Daha az göster' : `Tümünü göster (${rows.length})`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SubscriptionsSection({ authorized }) {
  const [filters, setFilters] = useState({ companyId: '', domain: '', includeRemoved: false });
  const [applied, setApplied] = useState({});
  const { data, isFetching, isError, refetch } = useGetFetcherSubscriptionsQuery(applied, { skip: !authorized });
  const subs = data?.subscriptions ?? [];

  const [updateSub] = useUpdateFetcherSubscriptionMutation();
  const [reindexSub, { isLoading: reindexing }] = useReindexFetcherSubscriptionMutation();
  const [deleteSub, { isLoading: deleting }] = useDeleteFetcherSubscriptionMutation();

  const [busy, setBusy] = useState(null);   // `${id}:pause`
  const [msg, setMsg] = useState(null);     // { tone: 'success'|'destructive', text }
  const [modal, setModal] = useState(null); // { type: 'detail'|'reindex'|'delete', sub }

  const applyFilters = () => setApplied({
    companyId: filters.companyId.trim() || undefined,
    domain: filters.domain.trim() || undefined,
    includeRemoved: filters.includeRemoved || undefined,
  });

  const canToggle = (s) => s === 'live' || s === 'paused';

  const togglePause = async (sub) => {
    const next = sub.state === 'live' ? 'paused' : 'live';
    if (!window.confirm(next === 'paused'
      ? 'Bu aboneliğin indexlemesi duraklatılsın mı?'
      : 'Abonelik yeniden aktifleştirilsin mi? (kaçan değişiklikler backfill ile yakalanır)')) return;
    setBusy(`${sub.id}:pause`); setMsg(null);
    try {
      const res = await updateSub({ id: sub.id, state: next }).unwrap();
      setMsg({ tone: 'success', text: `Abonelik durumu: ${res?.subscription?.state ?? next}` });
    } catch (err) {
      setMsg({ tone: 'destructive', text: upstreamErr(err).error || 'Durum güncellenemedi.' });
    } finally { setBusy(null); }
  };

  const submitReindex = async ({ clean, size, overlap, minChars }) => {
    const sub = modal.sub;
    const body = { clean };
    const chunk = {};
    if (size) chunk.size = Number(size);
    if (overlap) chunk.overlap = Number(overlap);
    if (minChars) chunk.minChars = Number(minChars);
    if (Object.keys(chunk).length) body.chunk = chunk;
    setMsg(null);
    try {
      const res = await reindexSub({ id: sub.id, ...body }).unwrap();
      setMsg({ tone: 'success', text: `Yeniden indexleme başladı · watermark temizlenen: ${res?.watermarksCleared ?? 0}` });
      setModal(null);
    } catch (err) {
      const u = upstreamErr(err);
      const text = u.error === 'index_in_progress'
        ? 'İndexleme sürüyor — bitmesini bekleyip tekrar deneyin.'
        : (err?.status === 504 || u.state === 'removing')
          ? 'İşlem arka planda sürüyor — listeyi yenileyin.'
          : (u.error || 'Yeniden indexleme başarısız.');
      setMsg({ tone: 'destructive', text });
    }
  };

  const submitDelete = async (mode) => {
    const sub = modal.sub;
    setMsg(null);
    try {
      await deleteSub({ id: sub.id, mode }).unwrap();
      setMsg({ tone: 'success', text: `Abonelik ${mode === 'hard' ? 'kalıcı silindi' : 'pasifleştirildi'}.` });
      setModal(null);
    } catch (err) {
      const u = upstreamErr(err);
      const text = (u.state === 'removing' || u.error === 'embedding_remove_failed')
        ? 'Kaldırma sürüyor (embedding temizliği) — birkaç saniye sonra tekrar deneyin.'
        : err?.status === 504
          ? 'İşlem arka planda sürüyor — listeyi yenileyin.'
          : (u.error || 'Kaldırma başarısız.');
      setMsg({ tone: 'destructive', text });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-56 space-y-1.5">
            <label className="text-2sm font-medium">Firma</label>
            <CompanySelect
              value={filters.companyId}
              onChange={(id) => setFilters((f) => ({ ...f, companyId: id }))}
              placeholder="Firma ara ve seç"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-2sm font-medium">Domain</label>
            <Input value={filters.domain} onChange={(e) => setFilters((f) => ({ ...f, domain: e.target.value }))} placeholder="example.com (opsiyonel)" className="w-56" />
          </div>
          <Button variant={filters.includeRemoved ? undefined : 'outline'} size="sm" onClick={() => setFilters((f) => ({ ...f, includeRemoved: !f.includeRemoved }))}>
            {filters.includeRemoved ? 'Kaldırılanlar dahil' : 'Kaldırılanlar hariç'}
          </Button>
          <Button size="sm" onClick={applyFilters}><Search className="size-4" /> Uygula</Button>
          <div className="ms-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{data?.total ?? 0} abonelik</span>
            <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
              <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {msg && (
        <Alert variant={msg.tone === 'destructive' ? 'destructive' : undefined}>
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      <SubscriberStatsCard authorized={authorized} />

      <Card>
        <CardHeader>
          <CardTitle>Abonelik Kayıtları</CardTitle>
          <CardToolbar><span className="text-xs text-muted-foreground">{nfmt(data?.total)} kayıt</span></CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {isError ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Abonelik listesi alınamadı.</AlertDescription></Alert></div>
          ) : isFetching && subs.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : subs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <Rss className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Abonelik kaydı yok</p>
              <p className="max-w-lg text-sm text-muted-foreground">
                Filtreler boşken de liste boşsa abonelik koleksiyonu gerçekten boştur:
                "web sitesi ekle" akışı, <b>INFORMATION_SUBSCRIPTIONS_ENABLED</b> bayrağı
                açılana kadar abonelik yazmaz ve firma bağları domain kaydındaki legacy
                bilgi-sahibi listesinde tutulur. Yukarıdaki "Domain Başına Abone" kartı bu
                durumda legacy kayıtlardan beslenir.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Embedding</TableHead>
                    <TableHead>Recrawl</TableHead>
                    <TableHead>Güncelleme</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-foreground">{s.domainName || '—'}</TableCell>
                      <TableCell className="max-w-[180px]"><CompanyOwnerCell companyId={s.companyId} /></TableCell>
                      <TableCell><Badge variant={subStateVariant(s.state)}>{s.state}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.embedding?.status ? <Badge variant="muted">{s.embedding.status}</Badge> : '—'}
                        {s.embedding?.chunkCount != null ? <span className="ms-1 tabular-nums">{s.embedding.chunkCount} chunk</span> : null}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">{s.contract?.recrawlIntervalDays != null ? `${s.contract.recrawlIntervalDays}g` : '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatTr(s.updatedAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-7" title={s.state === 'live' ? 'Duraklat' : 'Devam'} disabled={!canToggle(s.state) || busy === `${s.id}:pause`} onClick={() => togglePause(s)}>
                            {busy === `${s.id}:pause` ? <Loader2 className="size-3.5 animate-spin" /> : s.state === 'live' ? <Pause className="size-3.5 text-amber-600" /> : <Play className="size-3.5 text-green-600" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Yeniden indexle" onClick={() => { setMsg(null); setModal({ type: 'reindex', sub: s }); }}>
                            <RefreshCw className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Kaldır" onClick={() => { setMsg(null); setModal({ type: 'delete', sub: s }); }}>
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7" onClick={() => setModal({ type: 'detail', sub: s })}>Detay</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {modal?.type === 'detail' && <SubscriptionDetail sub={modal.sub} onClose={() => setModal(null)} />}
      {modal?.type === 'reindex' && <ReindexModal sub={modal.sub} busy={reindexing} onSubmit={submitReindex} onClose={() => setModal(null)} />}
      {modal?.type === 'delete' && <DeleteSubModal sub={modal.sub} busy={deleting} onConfirm={submitDelete} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ════════════ Hız Kontrolü (scheduler tuning) ════════════ */

/**
 * Knob metadata — fetcher'daki adaptive_tuning.TUNABLES ile birebir eşleşir.
 * `step` yalnız input hassasiyeti içindir; doğrulama fetcher tarafında.
 */
const TUNING_GROUPS = [
  {
    title: 'Domain başına hız',
    hint: 'Token bucket her domain için ayrı işler ama değerler GLOBAL — tek bir domaine özel hız verilemez.',
    keys: [
      { key: 'per_domain_rps', label: 'Saniyedeki istek (RPS)', step: 0.01, desc: '0.05 = domain başına 20 saniyede 1 istek.' },
      { key: 'per_domain_burst', label: 'Patlama (burst)', step: 1, desc: 'Bucket kapasitesi; biriken jeton sayısı.' },
      { key: 'fairness_per_domain_per_tick', label: 'Tick başına URL', step: 1, desc: 'Bir domainden tek turda alınacak en fazla URL.' },
      { key: 'scheduler_tick_seconds', label: 'Tick süresi (sn)', step: 0.1, desc: 'Zamanlayıcı döngü aralığı.' },
    ],
  },
  {
    title: 'Global eşzamanlılık',
    hint: 'Sert tavan ile yumuşak diz. Inflight yumuşak eşiği geçince kabul oranı kademeli kısılır.',
    keys: [
      { key: 'global_max_inflight', label: 'Maks. eşzamanlı URL', step: 10, desc: 'Sert tavan — hiçbir koşulda aşılmaz.' },
      { key: 'soft_inflight_threshold', label: 'Yumuşak eşik', step: 5, desc: 'Kısma bu inflight değerinden sonra başlar.' },
      { key: 'soft_inflight_ceiling', label: 'Yumuşak tavan', step: 5, desc: 'Kısmanın en dibe indiği inflight değeri.' },
      { key: 'min_throttle_factor', label: 'En düşük kısma katsayısı', step: 0.05, desc: '0.15 = en yoğun anda bile %15 hızla devam eder.' },
    ],
  },
  {
    title: 'Node başına adaptif kapasite (AIMD)',
    hint: 'Node CPU/RAM bildirmiyor; yük sinyali crawl SÜRESİ. Yavaşlarsa tavan çarpanla düşer, hızlanırsa adım adım artar.',
    keys: [
      { key: 'max_inflight_per_node', label: 'Node maks. eşzamanlı', step: 1 },
      { key: 'min_inflight_per_node', label: 'Node min. eşzamanlı', step: 1 },
      { key: 'node_slow_latency_seconds', label: 'Yavaş eşiği (sn)', step: 1, desc: 'Bu sürenin üstü "yavaş" sayılır, tavan düşürülür.' },
      { key: 'node_fast_latency_seconds', label: 'Hızlı eşiği (sn)', step: 1, desc: 'Bu sürenin altı "hızlı" sayılır, tavan artırılır.' },
      { key: 'node_latency_ewma_alpha', label: 'EWMA katsayısı', step: 0.05, desc: 'Yüksek = son ölçüme daha duyarlı.' },
      { key: 'node_cap_decrease_factor', label: 'Azaltma çarpanı', step: 0.05, desc: '0.7 = yavaşlayınca tavan %30 düşer.' },
      { key: 'node_cap_increase_step', label: 'Artırma adımı', step: 1 },
    ],
  },
];

function TuningSection({ authorized }) {
  const { data, isFetching, isError, refetch } = useGetSchedulerTuningQuery(undefined, {
    skip: !authorized,
    pollingInterval: 20000,
  });
  const [updateTuning, { isLoading: saving }] = useUpdateSchedulerTuningMutation();

  const [edits, setEdits] = useState({}); // { knob: string } — yalnız dokunulanlar
  const [msg, setMsg] = useState(null);

  const tunables = data?.tunables || {};
  const dirty = Object.keys(edits).filter((k) => String(edits[k]) !== String(tunables[k]?.value ?? ''));

  const apply = async () => {
    if (dirty.length === 0) return;
    const body = {};
    for (const k of dirty) {
      const raw = String(edits[k]).trim();
      if (raw === '') { setMsg({ tone: 'destructive', text: `${k} boş bırakılamaz — varsayılana dönmek için "Sıfırla" kullanın.` }); return; }
      const num = Number(raw);
      if (!Number.isFinite(num)) { setMsg({ tone: 'destructive', text: `${k} sayısal olmalı.` }); return; }
      body[k] = num;
    }
    setMsg(null);
    try {
      const res = await updateTuning(body).unwrap();
      setEdits({});
      setMsg({ tone: 'success', text: `Uygulandı · ${Object.keys(res?.applied || body).length} parametre. Restart gerekmez.` });
    } catch (e) {
      const u = upstreamErr(e);
      setMsg({ tone: 'destructive', text: u.error || 'Ayarlar uygulanamadı.' });
    }
  };

  // null göndermek Redis override'ını siler → env varsayılanına döner.
  const resetKnob = async (key) => {
    setMsg(null);
    try {
      await updateTuning({ [key]: null }).unwrap();
      setEdits((e) => { const next = { ...e }; delete next[key]; return next; });
      setMsg({ tone: 'success', text: `${key} varsayılana döndürüldü.` });
    } catch (e) {
      setMsg({ tone: 'destructive', text: upstreamErr(e).error || 'Sıfırlanamadı.' });
    }
  };

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Hız ayarları alınamadı</AlertTitle>
        <AlertDescription>
          Fetcher'ın Redis bağlantısı yoksa uyarlanabilir hız kontrolü devre dışıdır ve bu uç hata döner.
        </AlertDescription>
      </Alert>
    );
  }

  const throttle = data?.throttle_factor;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          {data?.enabled
            ? <Badge variant="success">Uyarlanabilir hız açık</Badge>
            : <Badge variant="warning">Kapalı (ADAPTIVE_PACING_ENABLED)</Badge>}
          <span className="text-sm text-muted-foreground">
            İşlemdeki URL: <b className="tabular-nums text-foreground">{nfmt(data?.inflight_total)}</b>
          </span>
          <span className="text-sm text-muted-foreground">
            Kısma katsayısı: <b className={cn('tabular-nums', throttle != null && throttle < 1 ? 'text-amber-600' : 'text-foreground')}>
              {throttle != null ? throttle : '—'}
            </b>
          </span>
          <div className="ms-auto flex items-center gap-2">
            {dirty.length > 0 && <span className="text-xs text-amber-600">{dirty.length} değişiklik bekliyor</span>}
            <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
              <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
            <Button size="sm" disabled={dirty.length === 0 || saving} onClick={apply}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Uygula
            </Button>
          </div>
        </CardContent>
      </Card>

      {msg && <Alert variant={msg.tone === 'destructive' ? 'destructive' : undefined}><AlertDescription>{msg.text}</AlertDescription></Alert>}

      {data?.enabled === false && (
        <Alert>
          <AlertTitle>Değişiklikler şu an etkisiz</AlertTitle>
          <AlertDescription>
            Uyarlanabilir hız kontrolü kapalı. Buradaki değerler kaydedilir ama
            <b> ADAPTIVE_PACING_ENABLED</b> açılana kadar uygulanmaz — bu bayrak env'de ve restart ister.
          </AlertDescription>
        </Alert>
      )}

      {isFetching && !data ? (
        <Card><CardContent className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</CardContent></Card>
      ) : TUNING_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gauge className="size-4" /> {group.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <p className="text-xs text-muted-foreground">{group.hint}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.keys.map(({ key, label, step, desc }) => {
                const knob = tunables[key];
                if (!knob) return null;
                const overridden = knob.source === 'redis';
                const value = edits[key] ?? String(knob.value ?? '');
                const changed = String(value) !== String(knob.value ?? '');
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-2sm font-medium">{label}</label>
                      {overridden
                        ? <Badge variant="primary" className="h-5">elle ayarlı</Badge>
                        : <Badge variant="muted" className="h-5">varsayılan</Badge>}
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        value={value}
                        inputMode="decimal"
                        step={step}
                        onChange={(e) => setEdits((s) => ({ ...s, [key]: e.target.value }))}
                        className={cn(changed && 'border-amber-500')}
                      />
                      <Button
                        variant="outline" size="icon" className="size-9 shrink-0"
                        title={`Varsayılana dön (${knob.default} · ${knob.env_var})`}
                        disabled={!overridden || saving}
                        onClick={() => resetKnob(key)}
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {desc ? `${desc} ` : ''}Varsayılan: <span className="font-mono">{String(knob.default)}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="size-4" /> Node Kapasiteleri</CardTitle>
          <CardToolbar><span className="text-xs text-muted-foreground">{data?.nodes?.length ?? 0} node</span></CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {(data?.nodes ?? []).length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Node verisi yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Node</TableHead>
                    <TableHead className="text-right">İşlemde</TableHead>
                    <TableHead className="text-right">Tavan (AIMD)</TableHead>
                    <TableHead className="text-right">Ort. süre (sn)</TableHead>
                    <TableHead>Güncelleme</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.nodes.map((n) => {
                    const lat = n.latency_ewma_seconds;
                    const slow = lat != null && tunables.node_slow_latency_seconds?.value != null
                      && lat > tunables.node_slow_latency_seconds.value;
                    return (
                      <TableRow key={n.node_id}>
                        <TableCell className="font-medium text-foreground">{n.node_id}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{n.inflight ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{n.cap ?? '—'}</TableCell>
                        <TableCell className={cn('text-right tabular-nums', slow ? 'text-amber-600' : 'text-muted-foreground')}>
                          {lat != null ? Number(lat).toFixed(1) : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTr(n.updated_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ════════════ Raporlar ════════════ */
function ReportsSection({ authorized }) {
  const { data: restricted, isFetching: rFetching, isError: rError, refetch: rRefetch } = useGetRestrictedDomainsQuery(undefined, { skip: !authorized });
  const { data: mq, isFetching: mqFetching, isError: mqError, refetch: mqRefetch } = useGetRabbitmqHealthQuery(undefined, { skip: !authorized });
  const domains = restricted?.domains ?? [];
  const queues = mq?.queues && typeof mq.queues === 'object' ? Object.entries(mq.queues) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Radio className="size-4" /> RabbitMQ Sağlığı</CardTitle>
          <CardToolbar>
            {mqError ? <Badge variant="destructive">Ulaşılamadı</Badge> : mq ? <Badge variant={mq.connected ? 'success' : 'destructive'}>{mq.connected ? 'Bağlı' : 'Bağlantı yok'}</Badge> : null}
            <Button variant="ghost" size="icon" onClick={mqRefetch} disabled={mqFetching}><RefreshCw className={mqFetching ? 'size-4 animate-spin' : 'size-4'} /></Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-5">
          {mqError ? (
            <Alert variant="destructive"><AlertTitle>Broker ulaşılamıyor</AlertTitle><AlertDescription>RabbitMQ sağlık uç noktası 503 döndü veya köprü yanıt vermedi.</AlertDescription></Alert>
          ) : mqFetching && !mq ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : queues.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kuyruk verisi yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Kuyruk</TableHead><TableHead className="text-right">Bekleyen mesaj</TableHead></TableRow></TableHeader>
                <TableBody>
                  {queues.map(([q, v]) => (
                    <TableRow key={q}>
                      <TableCell className="font-mono text-xs">{q}</TableCell>
                      <TableCell className="text-right">{typeof v === 'string' ? <Badge variant="destructive">{v}</Badge> : <span className="tabular-nums">{v}</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Not: manuel yenilenir (polling yok). Canlı akış için SSE planlanıyor.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Ban className="size-4" /> Kısıtlı Domainler</CardTitle>
          <CardToolbar>
            <span className="text-xs text-muted-foreground">{domains.length}</span>
            <Button variant="ghost" size="icon" onClick={rRefetch} disabled={rFetching}><RefreshCw className={rFetching ? 'size-4 animate-spin' : 'size-4'} /></Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {rError ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Kısıtlı domain listesi alınamadı.</AlertDescription></Alert></div>
          ) : rFetching && domains.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : domains.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center"><Ban className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Kısıtlı domain yok</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Domain</TableHead><TableHead>Robots / Sebep</TableHead><TableHead>Güncelleme</TableHead></TableRow></TableHeader>
                <TableBody>
                  {domains.map((d, i) => (
                    <TableRow key={d.domain || i}>
                      <TableCell className="font-medium text-foreground">{d.domain}</TableCell>
                      <TableCell className="max-w-[360px] truncate text-xs text-muted-foreground">{typeof d.robots === 'object' && d.robots !== null ? JSON.stringify(d.robots) : (d.robots ?? '—')}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatTr(d.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ════════════ Sayfa ════════════ */
export default function FetcherServicePage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const [section, setSection] = useState('status');

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Servisler"
        title="Fetcher Servisi"
        description="tinnten-fetcher: domain & URL keşfi, scraping kontrolü, node yönetimi ve crawl kayıtları"
      />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <nav className="space-y-0.5 p-2">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = section === s.key;
                return (
                  <button key={s.key} onClick={() => setSection(s.key)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    )}>
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">{s.desc}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        <div>
          {section === 'status' && <StatusSection authorized={authorized} />}
          {section === 'domains' && <DomainsSection authorized={authorized} />}
          {section === 'subscriptions' && <SubscriptionsSection authorized={authorized} />}
          {section === 'tuning' && <TuningSection authorized={authorized} />}
          {section === 'logs' && <LogsSection authorized={authorized} />}
          {section === 'nodes' && <NodesSection authorized={authorized} />}
          {section === 'reports' && <ReportsSection authorized={authorized} />}
        </div>
      </div>
    </RoleGuard>
  );
}
