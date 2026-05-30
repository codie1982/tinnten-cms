'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Activity, Globe, Link2, ScrollText, Server, RefreshCw, X, Search,
  Play, Square, RotateCw, Trash2, Plus, CircleDot, OctagonX, Loader2, Inbox,
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

const SECTIONS = [
  { key: 'status', label: 'Genel Durum', icon: Activity, desc: 'Sistem & node özeti' },
  { key: 'domains', label: 'Domainler', icon: Globe, desc: 'Domain & scraping kontrolü' },
  { key: 'urls', label: "URL'ler", icon: Link2, desc: 'Keşfedilen URL kuyruğu' },
  { key: 'logs', label: 'Crawl Logları', icon: ScrollText, desc: 'Tarama denemesi kayıtları' },
  { key: 'nodes', label: "Node'lar", icon: Server, desc: 'Scraper worker yönetimi' },
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
          <Button variant="ghost" size="icon" className="ms-auto" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
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
                    <TableHead className="text-right">Scraping</TableHead>
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
    </div>
  );
}

function DomainDetail({ domain, onClose }) {
  const { data: doc, isFetching } = useGetFetcherDomainQuery(domain);
  const { data: statsData } = useGetFetcherDomainStatsQuery(domain);
  const { data: urlsData, isFetching: urlsLoading } = useGetFetcherDomainUrlsQuery({ domain, page: 1, limit: 10 });
  const stats = statsData?.stats || {};
  const urls = urlsData?.urls || [];

  return (
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
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Son URL'ler</p>
                {urlsLoading ? <Skeleton className="h-24 w-full" /> : urls.length === 0 ? (
                  <p className="text-sm text-muted-foreground">URL yok.</p>
                ) : (
                  <div className="space-y-1">
                    {urls.map((u) => (
                      <div key={u._id || u.url} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate">{u.url}</span>
                        <Badge variant={urlStatusVariant(u.status)}>{u.status}</Badge>
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
          {section === 'urls' && <UrlsSection authorized={authorized} />}
          {section === 'logs' && <LogsSection authorized={authorized} />}
          {section === 'nodes' && <NodesSection authorized={authorized} />}
        </div>
      </div>
    </RoleGuard>
  );
}
