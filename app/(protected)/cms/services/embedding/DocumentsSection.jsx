'use client';

import { useState } from 'react';
import { Inbox, Loader2, RefreshCw, RotateCw, Search, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useGetEmbeddingDocumentQuery,
  useGetEmbeddingDocumentsQuery,
  useReindexEmbeddingDocumentMutation,
} from '@/redux/services';
import { cn } from '@/lib/utils';
import { PAGE_SIZE, SOURCE_LABEL, ShortId, bytesTr, formatTr, nfmt, stateMeta } from './_shared';

/**
 * Doküman listesi. `companyId` verilirse liste o firmaya sabitlenir ve
 * firma kolonu gizlenir — firma detayından yeniden kullanım için.
 */
export function DocumentsTable({ authorized = true, companyId }) {
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
  if (companyId) params.companyid = companyId;

  const { data, isFetching, isError, refetch } = useGetEmbeddingDocumentsQuery(params, { skip: !authorized });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(search) || state !== 'all' || source !== 'all';

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
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">{filtered ? 'Eşleşen doküman yok' : 'Doküman yok'}</p>
              {filtered ? <p className="text-sm text-muted-foreground">Filtreleri değiştirmeyi deneyin.</p> : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doküman</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Chunk</TableHead>
                    <TableHead>Boyut</TableHead>
                    <TableHead>Kullanım</TableHead>
                    <TableHead>Güncelleme</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((d) => {
                    const m = stateMeta(d.indexState);
                    // Python tarafının açtığı kayıtlarda ad/tip/kullanıcı boş olabilir.
                    const incomplete = !d.name || !d.type;
                    return (
                      <TableRow
                        key={d.id}
                        className={cn('cursor-pointer', d.enabled === false && 'opacity-60')}
                        onClick={() => setDetailId(d.id)}
                      >
                        <TableCell className="max-w-[280px]">
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                            {incomplete ? (
                              <span className="truncate text-sm italic text-muted-foreground">İsimsiz doküman</span>
                            ) : (
                              <span className="truncate text-sm font-medium text-foreground">
                                {d.name}<span className="ms-1 text-xs text-muted-foreground">.{d.type}</span>
                              </span>
                            )}
                            {incomplete && (
                              <Badge variant="warning" title="Servis tarafından oluşturulmuş kayıt; ad/tip/kullanıcı alanları boş.">
                                eksik metadata
                              </Badge>
                            )}
                            {d.enabled === false && <Badge variant="muted">Pasif</Badge>}
                            {(d.tags ?? []).slice(0, 2).map((t) => <Badge key={t} variant="muted">{t}</Badge>)}
                            {(d.tags?.length ?? 0) > 2 && <Badge variant="muted">+{d.tags.length - 2}</Badge>}
                          </span>
                        </TableCell>
                        <TableCell><Badge variant={m.variant}>{m.label}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{SOURCE_LABEL[d.source] || d.source}</TableCell>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">{nfmt(d.chunks)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{bytesTr(d.sizeBytes)}</TableCell>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">
                          {d.usageCount === null || d.usageCount === undefined
                            ? <span className="text-xs">—</span>
                            : nfmt(d.usageCount)}
                        </TableCell>
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

export function DocumentDetail({ id, onClose }) {
  const { data, isFetching } = useGetEmbeddingDocumentQuery(id);
  const [reindex, { isLoading: reindexing }] = useReindexEmbeddingDocumentMutation();
  const doc = data?.item;
  const logs = data?.logs || [];
  const m = stateMeta(doc?.indexState);

  const onReindex = async () => {
    await reindex({ id, companyId: doc?.companyId }).unwrap().catch(() => {});
  };

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
                <div><span className="text-muted-foreground">Tip: </span>{doc.type || '—'}{doc.mediaType ? ` · ${doc.mediaType}` : ''}</div>
                <div><span className="text-muted-foreground">Kaynak: </span>{SOURCE_LABEL[doc.source] || doc.source}</div>
                <div><span className="text-muted-foreground">Chunk: </span>{nfmt(doc.chunks)}</div>
                <div><span className="text-muted-foreground">Token: </span>{nfmt(doc.tokens)}</div>
                <div><span className="text-muted-foreground">Boyut: </span>{bytesTr(doc.sizeBytes)}</div>
                <div><span className="text-muted-foreground">Görünürlük: </span>{doc.visibility || '—'}</div>
                <div><span className="text-muted-foreground">İndeksleme: </span>{doc.enabled === false ? 'Durduruldu' : 'Açık'}</div>
                <div><span className="text-muted-foreground">Son indeks: </span>{formatTr(doc.lastRunAt)}</div>
                <div><span className="text-muted-foreground">Yüklenme: </span>{formatTr(doc.createdAt)}</div>
                <div className="truncate"><span className="text-muted-foreground">Firma: </span>{doc.companyName || <ShortId value={doc.companyId} />}</div>
                {doc.pages ? <div><span className="text-muted-foreground">Sayfa: </span>{nfmt(doc.pages)}</div> : null}
                {doc.rows ? <div><span className="text-muted-foreground">Satır: </span>{nfmt(doc.rows)}</div> : null}
              </div>

              {doc.description && <p className="text-sm text-muted-foreground">{doc.description}</p>}
              {doc.url && <div className="truncate text-sm"><span className="text-muted-foreground">URL: </span><a href={doc.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{doc.url}</a></div>}
              {doc.errorMsg && <Alert variant="destructive"><AlertTitle>İndeks hatası</AlertTitle><AlertDescription className="break-words">{doc.errorMsg}</AlertDescription></Alert>}

              <OwnershipCard doc={doc} />
              <IndexOptionsView value={data?.indexOptions} />

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">İşlem Geçmişi</p>
                {logs.length === 0 ? <p className="text-sm text-muted-foreground">Bu doküman için işlem kaydı bulunamadı.</p> : (
                  <div className="space-y-1">
                    {logs.map((l, i) => <LogRow key={l.id ?? l._id ?? `${l.createdAt}-${i}`} log={l} />)}
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

/**
 * "Kim yükledi / kim kullanıyor". `owner` denormalize bir alandır ve ingest
 * sırasında doldurulmadıysa boş gelir; o durumda ham `userid`'ye düşeriz.
 */
function OwnershipCard({ doc }) {
  const uploader = doc.owner || (doc.userid ? <ShortId value={doc.userid} /> : null);
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sahiplik & Kullanım</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="truncate">
          <span className="text-muted-foreground">Yükleyen: </span>
          {uploader || <span className="italic text-muted-foreground">Bilinmiyor — kayıt servis tarafından oluşturulmuş</span>}
        </div>
        <div>
          <span className="text-muted-foreground">Kullanım: </span>
          {doc.usageCount === null || doc.usageCount === undefined
            ? <span className="italic text-muted-foreground">ölçüm yok</span>
            : nfmt(doc.usageCount)}
        </div>
        <div>
          <span className="text-muted-foreground">Son erişim: </span>
          {doc.lastAccessedAt ? formatTr(doc.lastAccessedAt) : <span className="italic text-muted-foreground">ölçüm yok</span>}
        </div>
        {doc.collectionId ? (
          <div className="truncate"><span className="text-muted-foreground">Koleksiyon: </span><ShortId value={doc.collectionId} /></div>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Kullanım sayısı yalnızca doküman içerik çağrılarını sayar; semantik arama isabetleri bu sayaca yansımaz.
      </p>
    </div>
  );
}

const OPTION_LABEL = {
  scope: 'Kapsam',
  ocr: 'OCR',
  cleanup: 'Temizleme',
  langDetect: 'Dil algılama',
  chunkSize: 'Chunk boyutu',
  chunkOverlap: 'Chunk örtüşmesi',
};

/**
 * İndeks ayarları. Şimdilik salt-okunur; faz 2'de `readOnly={false}` ile
 * düzenlenebilir hale gelecek — o zaman yeniden layout gerekmesin diye ayrı bileşen.
 */
function IndexOptionsView({ value, readOnly = true }) {
  const entries = Object.entries(value || {});
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">İndeks Ayarları</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {entries.map(([k, v]) => (
          <div key={k} className="truncate">
            <span className="text-muted-foreground">{OPTION_LABEL[k] || k}: </span>
            {typeof v === 'boolean'
              ? <Badge variant={v ? 'success' : 'muted'}>{v ? '✓' : '✗'}</Badge>
              : String(v ?? '—')}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * `contentdocumentlogs` iki farklı şemayla yazılıyor: tinnten-server
 * (`event` / `meta`) ve tinnten-embedding (`level` + `state` / `details`).
 * Her iki biçimi de aynı satırda gösterebilmek için normalize edilir.
 */
function LogRow({ log }) {
  const kind = log.event ?? log.level ?? '—';
  const detail = log.message ?? log.meta ?? log.details;
  const tone = log.level === 'error' ? 'destructive' : log.level === 'warn' || log.level === 'warning' ? 'warning' : null;

  return (
    <div className="rounded-lg border border-border px-3 py-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium">{kind}</span>
          {tone && <Badge variant={tone}>{log.level}</Badge>}
          {log.state && <Badge variant="muted">{log.state}</Badge>}
        </span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatTr(log.createdAt)}</span>
      </div>
      {detail ? <LogDetail value={detail} /> : null}
      {log.jobId ? <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">job: {log.jobId}</p> : null}
    </div>
  );
}

function LogDetail({ value }) {
  if (typeof value === 'string') return <p className="text-xs text-muted-foreground">{value}</p>;
  const entries = Object.entries(value || {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;
  const body = (
    <div className="mt-0.5 space-y-0.5">
      {entries.map(([k, v]) => (
        <p key={k} className="text-xs text-muted-foreground">
          <span className="font-medium">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
        </p>
      ))}
    </div>
  );
  if (entries.length <= 3) return body;
  return (
    <details className="mt-0.5">
      <summary className="cursor-pointer text-xs text-muted-foreground">{entries.length} alan</summary>
      {body}
    </details>
  );
}

export default function DocumentsSection({ authorized }) {
  return <DocumentsTable authorized={authorized} />;
}
