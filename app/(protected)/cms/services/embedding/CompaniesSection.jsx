'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowUpDown, ChevronDown, ChevronUp, ExternalLink,
  Inbox, Info, RefreshCw, Search,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useGetEmbeddingCompaniesQuery,
  useGetEmbeddingCompanyIndexStatsQuery,
  useGetEmbeddingConfigQuery,
} from '@/redux/services';
import { DocumentsTable } from './DocumentsSection';
import {
  DistRow, PAGE_SIZE, ShortId, StatCard, bytesTr, formatTr, nfmt, stateMeta,
} from './_shared';

const SORTABLE = [
  { key: 'documents', label: 'Doküman' },
  { key: 'chunks', label: 'Chunk' },
  { key: 'tokens', label: 'Token' },
  { key: 'sizeBytes', label: 'Boyut' },
  { key: 'lastRunAt', label: 'Son işlem' },
];

/** Firma adı; yoksa kısaltılmış id'ye düşer. */
function companyLabel(row) {
  return row.companyName || null;
}

function SortHeader({ column, sort, order, onSort, className }) {
  const active = sort === column.key;
  const Icon = !active ? ArrowUpDown : order === 'asc' ? ChevronUp : ChevronDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className="flex items-center gap-1 hover:text-foreground"
      >
        {column.label}
        <Icon className={active ? 'size-3.5 text-primary' : 'size-3.5 text-muted-foreground'} />
      </button>
    </TableHead>
  );
}

/**
 * Chunk toplamı iki ayrı kaynaktan gelir: doküman kayıtları
 * (`contentdocuments.index.stats.chunks`) ve taranan site sayfaları
 * (`company.information.websites[].content.embedding.chunkCount`).
 * Site tarafı gelmiyorsa toplam EKSİKTİR ve bunu sessizce gizlemeyiz.
 */
function ChunkCell({ row }) {
  const hasSite = row.siteChunks !== null && row.siteChunks !== undefined;
  const total = (row.chunks ?? 0) + (hasSite ? row.siteChunks : 0);
  return (
    <span
      className="tabular-nums"
      title={hasSite
        ? `Doküman: ${nfmt(row.chunks ?? 0)} · Site: ${nfmt(row.siteChunks)}`
        : 'Taranan site sayfaları hariç — gerçek toplam daha yüksek.'}
    >
      {nfmt(total)}
      {!hasSite && <span className="ms-0.5 font-bold text-warning">*</span>}
    </span>
  );
}

/**
 * Drift = FAISS'teki vektör sayısı ile MongoDB'deki chunk sayısı arasındaki fark.
 * Bir SAYIDIR, liste değildir — soft delete sonrası yetim vektörlerin kimliği
 * geri kazanılamaz, dolayısıyla "artıkları göster" diye bir şey sunulamaz.
 */
function DriftCell({ row, enabled }) {
  const { data, isFetching, isError } = useGetEmbeddingCompanyIndexStatsQuery(row.companyId, {
    skip: !enabled || !row.companyId,
  });

  if (!enabled) return <span className="text-muted-foreground" title="Ölçmek için «Drift ölç» anahtarını açın">—</span>;
  if (isFetching && !data) return <Skeleton className="h-5 w-20" />;
  if (isError || !data) return <span className="text-xs text-muted-foreground">ölçülemedi</span>;

  // 1) Boyut uyuşmazlığı drift'ten önce gelir: arama sessizce çalışmaz hale gelir.
  if (data.indexDim && data.modelDim && data.indexDim !== data.modelDim) {
    return <Badge variant="destructive" title={`index ${data.indexDim} ≠ model ${data.modelDim}`}>Boyut uyuşmazlığı</Badge>;
  }

  // 2) Reindex sırasında FAISS önce ekleyip sonra siliyor → ntotal geçici olarak şişer.
  if ((row.queued ?? 0) > 0 || row.indexing > 0) {
    return <Badge variant="muted" title="Reindex sırasında ntotal geçici olarak şişer; ölçüm güvenilir değil.">İndeksleme sürüyor</Badge>;
  }

  const drift = Number(data.drift ?? 0);
  const pct = Number(data.driftPct ?? 0);
  const abs = Math.abs(pct);
  const variant = abs < 1 ? 'success' : abs < 10 ? 'warning' : 'destructive';
  const label = abs < 1 ? 'Tutarlı' : abs < 10 ? 'Sapma var' : 'Ciddi sapma';
  const sign = drift > 0 ? '+' : '';
  const hint = drift > 0
    ? 'MongoDB’de olup FAISS’te olmayan chunk’lar — arama içerik kaçırıyor.'
    : drift < 0
      ? 'FAISS’te olup MongoDB’de karşılığı olmayan yetim vektörler — alan israfı.'
      : 'FAISS ve MongoDB tutarlı.';

  return (
    <span className="flex items-center gap-1.5" title={hint}>
      <Badge variant={variant}>{label}</Badge>
      {drift !== 0 && (
        <span className="tabular-nums text-xs text-muted-foreground">
          {sign}{nfmt(drift)} ({sign}{abs.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}%)
        </span>
      )}
    </span>
  );
}

function StatusBadges({ row }) {
  const cells = [
    { n: row.indexed, variant: 'success', title: 'İndekslendi' },
    { n: row.queued, variant: 'warning', title: 'Kuyrukta / işleniyor' },
    { n: row.errored, variant: 'destructive', title: 'Hata' },
    { n: row.disabled, variant: 'muted', title: 'Durduruldu' },
  ].filter((c) => (c.n ?? 0) > 0);
  if (cells.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {cells.map((c) => <Badge key={c.title} variant={c.variant} title={c.title}>{nfmt(c.n)}</Badge>)}
    </span>
  );
}

export default function CompaniesSection({ authorized }) {
  const [companyId, setCompanyId] = useState(null);
  const [companyName, setCompanyName] = useState('');

  if (companyId) {
    return (
      <CompanyIndexDetail
        companyId={companyId}
        companyName={companyName}
        onBack={() => { setCompanyId(null); setCompanyName(''); }}
      />
    );
  }
  return (
    <CompaniesTable
      authorized={authorized}
      onOpen={(row) => { setCompanyId(row.companyId); setCompanyName(companyLabel(row) || ''); }}
    />
  );
}

function CompaniesTable({ authorized, onOpen }) {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('chunks');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(0);
  const [measureDrift, setMeasureDrift] = useState(false);

  const config = useGetEmbeddingConfigQuery(undefined, { skip: !authorized });
  const perCompany = config.data?.per_company_faiss_enabled;
  // Bayrak kapalıyken tek global indeks kullanılır; firma bazlı drift anlamsızdır.
  const driftVisible = perCompany !== false;

  const params = { limit: PAGE_SIZE, skip: page * PAGE_SIZE, sort, order };
  if (search) params.q = search;

  const { data, isFetching, isError, refetch } = useGetEmbeddingCompaniesQuery(params, {
    skip: !authorized,
    pollingInterval: 60000,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onSort = (key) => {
    if (sort === key) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSort(key); setOrder('desc'); }
    setPage(0);
  };
  const submit = () => { setPage(0); setSearch(q.trim()); };

  return (
    <div className="space-y-4">
      {perCompany === false && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Firma bazlı FAISS kapalı</AlertTitle>
          <AlertDescription>
            Tek global indeks kullanılıyor; firma bazlı drift ölçümü anlamsız olduğu için gizlendi.
            Aşağıdaki sayımlar doküman kayıtlarından hesaplanır.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Firma adı ara…" />
            <Button variant="outline" size="icon" onClick={submit}><Search className="size-4" /></Button>
          </div>
          {driftVisible && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={measureDrift} onCheckedChange={setMeasureDrift} />
              <span className="text-muted-foreground">Drift ölç</span>
            </label>
          )}
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firma İndeksleri</CardTitle>
          <CardToolbar><Badge variant="muted">{nfmt(total)} firma</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {isError ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Yüklenemedi</AlertTitle>
                <AlertDescription>Firma indeksleri alınamadı.</AlertDescription>
              </Alert>
            </div>
          ) : isFetching && items.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Firma bulunamadı.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firma</TableHead>
                    <SortHeader column={SORTABLE[0]} sort={sort} order={order} onSort={onSort} />
                    <SortHeader column={SORTABLE[1]} sort={sort} order={order} onSort={onSort} />
                    <SortHeader column={SORTABLE[2]} sort={sort} order={order} onSort={onSort} />
                    <SortHeader column={SORTABLE[3]} sort={sort} order={order} onSort={onSort} />
                    <TableHead>Durum</TableHead>
                    {driftVisible && <TableHead>Drift</TableHead>}
                    <SortHeader column={SORTABLE[4]} sort={sort} order={order} onSort={onSort} />
                    {/* ileride: satır aksiyonları (yeniden inşa / indeksi kaldır) */}
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.companyId ?? 'none'} className="cursor-pointer" onClick={() => onOpen(row)}>
                      <TableCell className="max-w-[240px]">
                        {companyLabel(row)
                          ? <span className="truncate text-sm font-medium text-foreground">{row.companyName}</span>
                          : row.companyId
                            ? <ShortId value={row.companyId} />
                            : <span className="text-sm italic text-muted-foreground">Firmasız / Kişisel</span>}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">{nfmt(row.documents)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground"><ChunkCell row={row} /></TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">{nfmt(row.tokens)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{bytesTr(row.sizeBytes)}</TableCell>
                      <TableCell><StatusBadges row={row} /></TableCell>
                      {driftVisible && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DriftCell row={row} enabled={measureDrift} />
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTr(row.lastRunAt)}</TableCell>
                      <TableCell />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                Yalnızca doküman kaydı olan firmalar listelenir. Chunk sütununda <span className="font-bold">*</span> işareti,
                taranan site sayfalarının toplama dahil edilemediğini gösterir.
              </p>
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
    </div>
  );
}

function CompanyIndexDetail({ companyId, companyName, onBack }) {
  const config = useGetEmbeddingConfigQuery();
  const perCompany = config.data?.per_company_faiss_enabled;
  const { data: stats, isFetching, refetch } = useGetEmbeddingCompanyIndexStatsQuery(companyId, {
    skip: !companyId,
  });
  const { data: list } = useGetEmbeddingCompaniesQuery({ limit: PAGE_SIZE, skip: 0, sort: 'chunks', order: 'desc' });
  const row = (list?.items ?? []).find((c) => c.companyId === companyId) || {};
  const hasSite = row.siteChunks !== null && row.siteChunks !== undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Firma listesi</Button>
            <span className="truncate">{companyName || <ShortId value={companyId} />}</span>
          </CardTitle>
          <CardToolbar>
            {companyId && (
              <Link
                href={`/cms/companies/${companyId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
              >
                CMS kaydı <ExternalLink className="size-3.5" />
              </Link>
            )}
            <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
              <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
            {/* ileride: yeniden inşa et / indeksi kaldır */}
          </CardToolbar>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Doküman" value={nfmt(row.documents ?? 0)} />
        <StatCard label="Chunk (doküman)" value={nfmt(row.chunks ?? 0)} tone="text-primary" />
        <StatCard label="Chunk (site)" value={hasSite ? nfmt(row.siteChunks) : 'ölçülmedi'} />
        <StatCard label="Token" value={nfmt(row.tokens ?? 0)} />
        <StatCard label="Boyut" value={bytesTr(row.sizeBytes)} />
        <StatCard label="FAISS vektör" value={stats ? nfmt(stats.ntotal) : '—'} loading={isFetching && !stats} />
      </div>

      <Card>
        <CardHeader><CardTitle>İndeks Sağlığı</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {perCompany === false ? (
            <p className="text-sm text-muted-foreground">
              Firma bazlı FAISS kapalı — tek global indeks kullanılıyor, firma bazlı drift ölçümü yapılamaz.
            </p>
          ) : isFetching && !stats ? (
            <Skeleton className="h-20 w-full" />
          ) : !stats ? (
            <p className="text-sm text-muted-foreground">İndeks istatistiği alınamadı.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-3">
                <div><span className="text-muted-foreground">FAISS vektör: </span>{nfmt(stats.ntotal)}</div>
                <div><span className="text-muted-foreground">Mongo chunk: </span>{nfmt(stats.mongoChunks)}</div>
                <div><span className="text-muted-foreground">Aktif chunk: </span>{nfmt(stats.mongoActiveChunks)}</div>
                <div><span className="text-muted-foreground">Drift: </span>{nfmt(stats.drift)}</div>
                <div><span className="text-muted-foreground">Yetim tahmini: </span>{nfmt(stats.orphanEstimate)}</div>
                <div><span className="text-muted-foreground">İndeks dosyası: </span>{bytesTr(stats.indexBytes)}</div>
                <div><span className="text-muted-foreground">İndeks boyutu: </span>{stats.indexDim ?? '—'}</div>
                <div><span className="text-muted-foreground">Model boyutu: </span>{stats.modelDim ?? '—'}</div>
                <div><span className="text-muted-foreground">Son yeniden inşa: </span>{formatTr(stats.lastRebuiltAt)}</div>
              </div>
              {stats.indexDim && stats.modelDim && stats.indexDim !== stats.modelDim && (
                <Alert variant="destructive">
                  <AlertTitle>Model/İndeks boyut uyuşmazlığı</AlertTitle>
                  <AlertDescription>Bu firmanın arama sonuçları geçersiz olabilir.</AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Drift, FAISS’teki vektör sayısı ile MongoDB’deki chunk sayısı arasındaki farktır.
                Yetim vektörlerin kimliği geri kazanılamaz; düzeltmenin tek yolu tam yeniden indekslemedir.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {(row.indexed || row.queued || row.errored || row.disabled) ? (
        <Card>
          <CardHeader><CardTitle>Durum Dağılımı</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              ['indexed', row.indexed],
              ['queued', row.queued],
              ['error', row.errored],
              ['not_indexed', row.disabled],
            ].filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => {
              const m = stateMeta(k);
              return <DistRow key={k} label={m.label} variant={m.variant} count={v} total={row.documents || 0} />;
            })}
          </CardContent>
        </Card>
      ) : null}

      <DocumentsTable companyId={companyId} />

      {/* ileride: bu firmanın arama analitiği (faz 2) */}
    </div>
  );
}
