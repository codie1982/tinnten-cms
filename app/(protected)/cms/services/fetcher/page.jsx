'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Activity, Globe, Link2, ScrollText, Server, RefreshCw, X, Search,
  Play, Square, RotateCw, Trash2, Plus, CircleDot, OctagonX, Loader2, Inbox,
  Rss, ShieldAlert, Pause, Ban, Radio, Pencil, ShieldCheck, FileText, SlidersHorizontal,
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
  useGetFetcherUrlsQuery,
  useGetFetcherLogsQuery,
  useGetFetcherNodesQuery,
  useCreateFetcherNodeMutation,
  useDeleteFetcherNodeMutation,
  useNodeActionMutation,
  useGetFetcherSubscriptionsQuery,
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
} from '@/redux/services';

const PAGE_SIZE = 25;

function formatTr(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

const domainStatusVariant = (s) =>
  s === 'ACTIVE' ? 'success' : ['RESTRICTED', 'PAUSED'].includes(s) ? 'warning' : 'muted';
const urlStatusVariant = (s) =>
  s === 'DONE' ? 'success' : s === 'ERROR' ? 'destructive' : s === 'READY' ? 'primary' : s === 'PAUSED' ? 'muted' : 'warning';
const nodeStatusVariant = (s) =>
  s === 'ACTIVE' ? 'success' : s === 'DECOMMISSIONED' ? 'destructive' : 'muted';
const httpVariant = (code) =>
  !code ? 'muted' : code < 300 ? 'success' : code < 400 ? 'warning' : 'destructive';
// Abonelik state machine (mongo_store.py): 7 durum.
const subStateVariant = (s) =>
  s === 'live' ? 'success' : s === 'paused' ? 'muted' : s === 'removed' ? 'destructive' : 'warning';
// Yapısal upstream hata detayı ApiResponse.error.data → fetcher body altında kalır.
const upstreamErr = (err) => err?.data?.data || {};
const SITE_TYPES = ['ecommerce', 'service', 'blog'];

const SECTIONS = [
  { key: 'status', label: 'Genel Durum', icon: Activity, desc: 'Sistem & node özeti' },
  { key: 'domains', label: 'Domainler', icon: Globe, desc: 'Domain & scraping kontrolü' },
  { key: 'subscriptions', label: 'Abonelikler', icon: Rss, desc: 'Firma ↔ domain abonelik yönetimi' },
  { key: 'urls', label: "URL'ler", icon: Link2, desc: 'Keşfedilen URL kuyruğu' },
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
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate">{isEdit ? `Domain düzenle · ${domain.domain}` : 'Domain ekle'}</CardTitle>
          <CardToolbar><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {err && <Alert variant="destructive"><AlertDescription>{err.error || 'İşlem başarısız.'}</AlertDescription></Alert>}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-2sm font-medium">Domain *</label>
              <Input value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} placeholder="example.com" />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-2sm font-medium">Firma ID {isEdit ? '' : '(opsiyonel)'}</label>
            <Input value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))} placeholder="ObjectId" />
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
          {err && <Alert variant="destructive"><AlertDescription>{err.error || err.details || 'Silme başarısız.'}</AlertDescription></Alert>}
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
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);

  const params = { page, limit: PAGE_SIZE };
  if (status !== 'all') params.status = status;
  const { data, isFetching, isError, refetch } = useGetFetcherDomainsQuery(params, { skip: !authorized });
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
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="w-44">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                <SelectItem value="RESTRICTED">RESTRICTED</SelectItem>
                <SelectItem value="PAUSED">PAUSED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground">{total} domain</span>
          <div className="ms-auto flex gap-2">
            <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
              <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
            <Button size="sm" onClick={() => setModal({ type: 'add' })}><Plus className="size-4" /> Domain Ekle</Button>
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
                    <TableHead>Ülke</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Doğrulama</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((d) => (
                    <TableRow key={d.domain} className="cursor-pointer" onClick={() => setDetail(d.domain)}>
                      <TableCell className="font-medium text-foreground">{d.domain}</TableCell>
                      <TableCell><Badge variant={domainStatusVariant(d.status)}>{d.status || '—'}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.locate || '—'}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">{d.companyId || '—'}</TableCell>
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
                          <Button variant="ghost" size="icon" className="size-7" title="Düzenle" onClick={() => setModal({ type: 'edit', domain: d })}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Doğrula" onClick={() => setModal({ type: 'verify', domain: d })}>
                            <ShieldCheck className="size-3.5 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Scraping config" onClick={() => setModal({ type: 'config', domain: d })}>
                            <SlidersHorizontal className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Kalıcı sil" onClick={() => setModal({ type: 'delete', domain: d })}>
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Ülke: </span>{doc.locate || '—'}</div>
                  <div className="truncate"><span className="text-muted-foreground">Firma: </span>{doc.companyId || '—'}</div>
                  <div><span className="text-muted-foreground">Doğrulama: </span>{doc.verification?.isVerified ? 'Doğrulandı' : (doc.verification?.status || 'Beklemede')}</div>
                  <div><span className="text-muted-foreground">Strateji: </span>{doc.scraping_config?.strategy || '—'}</div>
                  <div><span className="text-muted-foreground">Oluşturma: </span>{formatTr(doc.createdAt)}</div>
                  <div><span className="text-muted-foreground">Güncelleme: </span>{formatTr(doc.updatedAt)}</div>
                </div>

                {Array.isArray(doc.sitemap_urls) && doc.sitemap_urls.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {doc.sitemap_urls.slice(0, 6).map((s, i) => <Badge key={i} variant="muted">{s}</Badge>)}
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

/* ════════════ URL'ler ════════════ */
function UrlsSection({ authorized }) {
  const [domainInput, setDomainInput] = useState('');
  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const params = { page, limit: PAGE_SIZE };
  if (domain) params.domain = domain;
  if (status !== 'all') params.status = status;
  const { data, isFetching, isError, refetch } = useGetFetcherUrlsQuery(params, { skip: !authorized });
  const urls = data?.urls ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applyDomain = () => { setDomain(domainInput.trim()); setPage(1); };

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
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="READY">READY</SelectItem>
                <SelectItem value="WAIT">WAIT</SelectItem>
                <SelectItem value="DONE">DONE</SelectItem>
                <SelectItem value="ERROR">ERROR</SelectItem>
                <SelectItem value="PAUSED">PAUSED</SelectItem>
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
          <CardTitle>URL'ler</CardTitle>
          <CardToolbar><Badge variant="muted">{total.toLocaleString('tr-TR')} kayıt</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {isError ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>URL listesi alınamadı.</AlertDescription></Alert></div>
          ) : isFetching && urls.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : urls.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center"><Inbox className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">URL yok</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Öncelik</TableHead>
                    <TableHead>Derinlik</TableHead>
                    <TableHead>Son Tarama</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {urls.map((u) => (
                    <TableRow key={u._id || u.url}>
                      <TableCell className="max-w-[360px] truncate text-sm text-foreground">{u.url}</TableCell>
                      <TableCell><Badge variant={urlStatusVariant(u.status)}>{u.status}</Badge></TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">{u.priority ?? '—'}</TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">{u.depth ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTr(u.lastCrawledAt)}</TableCell>
                    </TableRow>
                  ))}
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
    </div>
  );
}

/* ════════════ Crawl Logları ════════════ */
function LogsSection({ authorized }) {
  const [domainInput, setDomainInput] = useState('');
  const [domain, setDomain] = useState('');
  const [page, setPage] = useState(1);

  const params = { page, limit: PAGE_SIZE };
  if (domain) params.domain = domain;
  const { data, isFetching, isError, refetch } = useGetFetcherLogsQuery(params, { skip: !authorized });
  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applyDomain = () => { setDomain(domainInput.trim()); setPage(1); };

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
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crawl Logları</CardTitle>
          <CardToolbar><Badge variant="muted">{total.toLocaleString('tr-TR')} kayıt</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {isError ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Log listesi alınamadı.</AlertDescription></Alert></div>
          ) : isFetching && logs.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center"><Inbox className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Log yok</p></div>
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
    </div>
  );
}

/* ════════════ Node'lar ════════════ */
function NodesSection({ authorized }) {
  const [includeDisabled, setIncludeDisabled] = useState(true);
  const { data, isFetching, isError, refetch } = useGetFetcherNodesQuery(
    { include_disabled: includeDisabled, include_offline: true },
    { skip: !authorized, pollingInterval: 20000 },
  );
  const nodes = data?.nodes ?? [];

  const [nodeAction] = useNodeActionMutation();
  const [deleteNode] = useDeleteFetcherNodeMutation();
  const [createNode, { isLoading: creating }] = useCreateFetcherNodeMutation();
  const [busy, setBusy] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ node_url: '', node_id: '' });

  const run = async (nodeId, action) => {
    setBusy(`${nodeId}:${action}`);
    if (action === 'delete') {
      if (window.confirm(`"${nodeId}" node'u devre dışı bırakılsın mı (decommission)?`)) {
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
          <Button variant="outline" size="sm" onClick={() => setIncludeDisabled((v) => !v)}>
            {includeDisabled ? 'Tümü' : 'Sadece aktif'}
          </Button>
          <span className="text-xs text-muted-foreground">{nodes.length} node</span>
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
            <div className="flex flex-col items-center gap-2 py-14 text-center"><Server className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Node yok</p></div>
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
                  {nodes.map((n) => (
                    <TableRow key={n.node_id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{n.node_id}</div>
                        <div className="max-w-[220px] truncate text-xs text-muted-foreground">{n.node_url}</div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <CircleDot className={cn('size-3', n.status === 'ACTIVE' && n.enabled ? 'text-green-500' : 'text-muted-foreground')} />
                          <Badge variant={nodeStatusVariant(n.status)}>{n.status}{n.enabled === false ? ' · kapalı' : ''}</Badge>
                        </span>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">{n.metrics?.inflight ?? 0}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTr(n.last_heartbeat)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-7" title="Başlat" disabled={busy === `${n.node_id}:start`} onClick={() => run(n.node_id, 'start')}>
                            {busy === `${n.node_id}:start` ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 text-green-600" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Durdur" disabled={busy === `${n.node_id}:stop`} onClick={() => run(n.node_id, 'stop')}>
                            {busy === `${n.node_id}:stop` ? <Loader2 className="size-3.5 animate-spin" /> : <Square className="size-3.5 text-amber-600" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Yeniden başlat" disabled={busy === `${n.node_id}:restart`} onClick={() => run(n.node_id, 'restart')}>
                            {busy === `${n.node_id}:restart` ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" title="Devre dışı bırak" disabled={busy === `${n.node_id}:delete`} onClick={() => run(n.node_id, 'delete')}>
                            {busy === `${n.node_id}:delete` ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5 text-destructive" />}
                          </Button>
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
            <div className="truncate"><span className="text-muted-foreground">Firma: </span>{sub.companyId || '—'}</div>
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
          <div className="space-y-1.5">
            <label className="text-2sm font-medium">Firma ID</label>
            <Input value={filters.companyId} onChange={(e) => setFilters((f) => ({ ...f, companyId: e.target.value }))} placeholder="ObjectId (opsiyonel)" className="w-56" />
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

      <Card>
        <CardContent className="px-0 py-0">
          {isError ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Abonelik listesi alınamadı.</AlertDescription></Alert></div>
          ) : isFetching && subs.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : subs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center"><Rss className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Abonelik yok</p><p className="text-sm text-muted-foreground">Filtreleri değiştirip tekrar deneyin.</p></div>
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
                      <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">{s.companyId || '—'}</TableCell>
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
          {section === 'urls' && <UrlsSection authorized={authorized} />}
          {section === 'logs' && <LogsSection authorized={authorized} />}
          {section === 'nodes' && <NodesSection authorized={authorized} />}
          {section === 'reports' && <ReportsSection authorized={authorized} />}
        </div>
      </div>
    </RoleGuard>
  );
}
