'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Activity, FileStack, Search, RefreshCw, X, Inbox, Loader2, RotateCw, ServerCog,
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
  useGetEmbeddingHealthQuery,
  useGetEmbeddingStatsQuery,
  useGetEmbeddingDocumentsQuery,
  useGetEmbeddingDocumentQuery,
  useReindexEmbeddingDocumentMutation,
  useEmbeddingSearchMutation,
} from '@/redux/services';

const PAGE_SIZE = 25;

const STATE_META = {
  indexed: { label: 'İndekslendi', variant: 'success' },
  indexing: { label: 'İndeksleniyor', variant: 'warning' },
  queued: { label: 'Kuyrukta', variant: 'warning' },
  not_indexed: { label: 'İndekssiz', variant: 'muted' },
  error: { label: 'Hata', variant: 'destructive' },
};
const SOURCE_LABEL = { upload: 'Yükleme', import_url: 'URL', integration: 'Entegrasyon' };

function formatTr(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

const SECTIONS = [
  { key: 'status', label: 'Genel Durum', icon: Activity, desc: 'Servis sağlığı & istatistik' },
  { key: 'documents', label: 'Dokümanlar', icon: FileStack, desc: 'İndekslenen içerikler' },
  { key: 'search', label: 'Arama Testi', icon: Search, desc: 'Semantik vektör arama' },
];

function DistRow({ label, count, total, variant }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2"><Badge variant={variant || 'muted'}>{label}</Badge></span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{count.toLocaleString('tr-TR')} · {pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/* ════════════ Genel Durum ════════════ */
function StatusSection({ authorized }) {
  const health = useGetEmbeddingHealthQuery(undefined, { skip: !authorized, pollingInterval: 30000 });
  const stats = useGetEmbeddingStatsQuery(undefined, { skip: !authorized });
  const h = health.data;
  const s = stats.data;
  const reachable = h?.ok;

  const stat = (label, value, tone) => (
    <Card><CardContent className="p-4">
      <p className="text-2sm text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{stats.isFetching && !s ? '…' : value}</p>
    </CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {health.isFetching && !h ? <Badge variant="muted">Kontrol ediliyor…</Badge>
            : reachable ? <Badge variant="success">Servis erişilebilir</Badge>
            : <Badge variant="destructive">Erişilemiyor</Badge>}
          {!reachable && h?.reason ? <span className="ms-2 text-muted-foreground">{h.reason}</span> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => { health.refetch(); stats.refetch(); }} disabled={health.isFetching}>
          <RefreshCw className={health.isFetching ? 'size-4 animate-spin' : 'size-4'} /> Yenile
        </Button>
      </div>

      {/* Servis sağlık detayı (healthz) */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ServerCog className="size-4 text-primary" /> FAISS / Model</CardTitle></CardHeader>
        <CardContent>
          {health.isFetching && !h ? <Skeleton className="h-16 w-full" />
            : !reachable ? <p className="text-sm text-muted-foreground">Servis kapalı görünüyor; model/index bilgisi alınamadı.</p>
            : (
              <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-3">
                <div><span className="text-muted-foreground">Genel index: </span>{h.index_size ?? '—'}</div>
                <div><span className="text-muted-foreground">Chunk index: </span>{h.chunk_index_size ?? '—'}</div>
                <div><span className="text-muted-foreground">Chunk motoru: </span>{h.chunk_engine_loaded ? 'Yüklü' : 'Kapalı'}</div>
                <div className="col-span-2 truncate lg:col-span-3"><span className="text-muted-foreground">Model: </span>{h.chunk_model_name || '—'}</div>
                <div><span className="text-muted-foreground">Model boyut: </span>{h.chunk_model_dim ?? '—'}</div>
                <div><span className="text-muted-foreground">Index boyut: </span>{h.chunk_index_dim ?? '—'}</div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* İçerik dokümanı istatistikleri */}
      <div className="grid grid-cols-3 gap-4">
        {stat('Toplam Doküman', (s?.total ?? 0).toLocaleString('tr-TR'))}
        {stat('Toplam Chunk', (s?.chunks ?? 0).toLocaleString('tr-TR'), 'text-primary')}
        {stat('Toplam Token', (s?.tokens ?? 0).toLocaleString('tr-TR'))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>İndeks Durumu Dağılımı</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.isFetching && !s ? <Skeleton className="h-24 w-full" /> : (
              Object.keys(s?.byState || {}).length === 0 ? <p className="text-sm text-muted-foreground">Veri yok.</p>
                : Object.entries(s.byState).map(([k, v]) => {
                    const m = STATE_META[k] || { label: k, variant: 'muted' };
                    return <DistRow key={k} label={m.label} variant={m.variant} count={v} total={s.total || 0} />;
                  })
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Kaynak Dağılımı</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.isFetching && !s ? <Skeleton className="h-24 w-full" /> : (
              Object.keys(s?.bySource || {}).length === 0 ? <p className="text-sm text-muted-foreground">Veri yok.</p>
                : Object.entries(s.bySource).map(([k, v]) => (
                    <DistRow key={k} label={SOURCE_LABEL[k] || k} count={v} total={s.total || 0} />
                  ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ════════════ Dokümanlar ════════════ */
function DocumentsSection({ authorized }) {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [state, setState] = useState('all');
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState(null);

  const params = { limit: PAGE_SIZE, skip: page * PAGE_SIZE };
  if (search) params.q = search;
  if (state !== 'all') params.state = state;
  if (source !== 'all') params.source = source;
  const { data, isFetching, isError, refetch } = useGetEmbeddingDocumentsQuery(params, { skip: !authorized });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submit = () => { setPage(0); setSearch(q.trim()); };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Doküman adı ara…" />
            <Button variant="outline" size="icon" onClick={submit}><Search className="size-4" /></Button>
          </div>
          <div className="w-44">
            <Select value={state} onValueChange={(v) => { setState(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="İndeks durumu" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="indexed">İndekslendi</SelectItem>
                <SelectItem value="queued">Kuyrukta</SelectItem>
                <SelectItem value="indexing">İndeksleniyor</SelectItem>
                <SelectItem value="not_indexed">İndekssiz</SelectItem>
                <SelectItem value="error">Hata</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={source} onValueChange={(v) => { setSource(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Kaynak" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kaynaklar</SelectItem>
                <SelectItem value="upload">Yükleme</SelectItem>
                <SelectItem value="import_url">URL</SelectItem>
                <SelectItem value="integration">Entegrasyon</SelectItem>
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
          <CardTitle>İçerik Dokümanları</CardTitle>
          <CardToolbar><Badge variant="muted">{total.toLocaleString('tr-TR')} doküman</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {isError ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Doküman listesi alınamadı.</AlertDescription></Alert></div>
          ) : isFetching && items.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center"><Inbox className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Doküman yok</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doküman</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Chunk</TableHead>
                    <TableHead>Sahip</TableHead>
                    <TableHead>Güncelleme</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((d) => {
                    const m = STATE_META[d.indexState] || { label: d.indexState, variant: 'muted' };
                    return (
                      <TableRow key={d.id} className="cursor-pointer" onClick={() => setDetailId(d.id)}>
                        <TableCell className="max-w-[260px] truncate text-sm font-medium text-foreground">{d.name}<span className="ms-1 text-xs text-muted-foreground">.{d.type}</span></TableCell>
                        <TableCell><Badge variant={m.variant}>{m.label}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{SOURCE_LABEL[d.source] || d.source}</TableCell>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">{d.chunks}</TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">{d.owner || '—'}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTr(d.updatedAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border p-3">
              <span className="text-xs text-muted-foreground">Sayfa {page + 1} / {pageCount}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0 || isFetching} onClick={() => setPage((p) => p - 1)}>Önceki</Button>
                <Button variant="outline" size="sm" disabled={page + 1 >= pageCount || isFetching} onClick={() => setPage((p) => p + 1)}>Sonraki</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {detailId && <DocumentDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function DocumentDetail({ id, onClose }) {
  const { data, isFetching } = useGetEmbeddingDocumentQuery(id);
  const [reindex, { isLoading: reindexing }] = useReindexEmbeddingDocumentMutation();
  const doc = data?.item;
  const logs = data?.logs || [];
  const m = STATE_META[doc?.indexState] || { label: doc?.indexState, variant: 'muted' };

  const onReindex = async () => { await reindex(id).unwrap().catch(() => {}); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate">{doc?.name || 'Doküman'}</CardTitle>
          <CardToolbar>
            {doc && <Badge variant={m.variant}>{m.label}</Badge>}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto p-5">
          {isFetching ? <Skeleton className="h-48 w-full" /> : !doc ? (
            <p className="text-sm text-muted-foreground">Doküman bulunamadı.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Tip: </span>{doc.type}</div>
                <div><span className="text-muted-foreground">Kaynak: </span>{SOURCE_LABEL[doc.source] || doc.source}</div>
                <div><span className="text-muted-foreground">Chunk: </span>{doc.chunks}</div>
                <div><span className="text-muted-foreground">Token: </span>{doc.tokens}</div>
                <div><span className="text-muted-foreground">Görünürlük: </span>{doc.visibility}</div>
                <div><span className="text-muted-foreground">Son indeks: </span>{formatTr(doc.lastRunAt)}</div>
                <div className="truncate"><span className="text-muted-foreground">Sahip: </span>{doc.owner || '—'}</div>
                <div className="truncate"><span className="text-muted-foreground">Firma: </span>{doc.companyId || '—'}</div>
              </div>

              {doc.url && <div className="truncate text-sm"><span className="text-muted-foreground">URL: </span><a href={doc.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{doc.url}</a></div>}
              {doc.errorMsg && <Alert variant="destructive"><AlertTitle>İndeks hatası</AlertTitle><AlertDescription className="break-words">{doc.errorMsg}</AlertDescription></Alert>}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">İşlem Geçmişi</p>
                {logs.length === 0 ? <p className="text-sm text-muted-foreground">Log yok.</p> : (
                  <div className="space-y-1">
                    {logs.map((l) => (
                      <div key={l.id} className="rounded-lg border border-border px-3 py-1.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{l.event}</span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatTr(l.createdAt)}</span>
                        </div>
                        {l.message && <p className="text-xs text-muted-foreground">{l.message}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end border-t border-border pt-3">
                <Button variant="outline" size="sm" onClick={onReindex} disabled={reindexing}>
                  {reindexing ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />} Yeniden İndeksle
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ════════════ Arama Testi ════════════ */
function SearchSection() {
  const [query, setQuery] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [runSearch, { data, isLoading }] = useEmbeddingSearchMutation();

  const submit = async () => {
    if (!query.trim()) return;
    await runSearch({ query: query.trim(), companyId: companyId.trim() || undefined, k: 10 }).unwrap().catch(() => {});
  };

  const results = data?.results || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1 space-y-1.5">
              <label className="text-2sm font-medium">Arama metni</label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Semantik olarak aranacak ifade…" />
            </div>
            <div className="w-56 space-y-1.5">
              <label className="text-2sm font-medium">Firma ID (opsiyonel)</label>
              <Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="kapsam için" />
            </div>
            <Button onClick={submit} disabled={!query.trim() || isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Ara
            </Button>
          </div>
          {data && data.ok === false && (
            <Alert variant="warning"><AlertTitle>Arama yapılamadı</AlertTitle><AlertDescription>{data.reason || 'Bilinmeyen hata.'}</AlertDescription></Alert>
          )}
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Sonuçlar</CardTitle>
            <CardToolbar><Badge variant="muted">{results.length} chunk</Badge></CardToolbar>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.length === 0 ? <p className="text-sm text-muted-foreground">Eşleşme bulunamadı.</p> : (
              results.map((r, i) => (
                <div key={r.chunk_id || r.id || i} className="rounded-lg border border-border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">{r.doc_id || r.metadata?.url || r.id || '—'}</span>
                    {typeof r.score === 'number' && <Badge variant="primary">skor {r.score.toFixed(3)}</Badge>}
                  </div>
                  <p className="line-clamp-3 text-sm text-foreground">{r.text || '(metin yok)'}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ════════════ Sayfa ════════════ */
export default function EmbeddingServicePage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const [section, setSection] = useState('status');

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Servisler"
        title="Embedding Servisi"
        description="tinnten-embedding: servis sağlığı, indekslenen dokümanlar ve semantik arama"
      />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <nav className="space-y-0.5 p-2">
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const active = section === sec.key;
                return (
                  <button key={sec.key} onClick={() => setSection(sec.key)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    )}>
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{sec.label}</span>
                      <span className="block text-xs text-muted-foreground">{sec.desc}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        <div>
          {section === 'status' && <StatusSection authorized={authorized} />}
          {section === 'documents' && <DocumentsSection authorized={authorized} />}
          {section === 'search' && <SearchSection />}
        </div>
      </div>
    </RoleGuard>
  );
}
