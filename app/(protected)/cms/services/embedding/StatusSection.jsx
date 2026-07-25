'use client';

import { RefreshCw, ServerCog } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useGetEmbeddingConfigQuery,
  useGetEmbeddingHealthQuery,
  useGetEmbeddingStatsQuery,
} from '@/redux/services';
import { DistRow, SOURCE_LABEL, StatCard, nfmt, stateMeta } from './_shared';

/**
 * Chunk motoru tembel yüklendiği için healthz'den `null` dönebilir. Bunu `—`
 * göstermek yanıltıcı olur — "veri yok" ile "motor henüz yüklenmedi" farklı şeyler.
 */
function LazyValue({ value }) {
  if (value === null || value === undefined) {
    return <span className="italic text-muted-foreground">motor yüklenmedi</span>;
  }
  return <>{nfmt(value)}</>;
}

/** Servis sağlığı (healthz) + global doküman istatistikleri. */
export default function StatusSection({ authorized }) {
  const health = useGetEmbeddingHealthQuery(undefined, { skip: !authorized, pollingInterval: 30000 });
  const stats = useGetEmbeddingStatsQuery(undefined, { skip: !authorized });
  const config = useGetEmbeddingConfigQuery(undefined, { skip: !authorized });
  const h = health.data;
  const s = stats.data;
  const reachable = h?.ok;
  const statsLoading = stats.isFetching && !s;
  const mode = config.data?.per_company_faiss_enabled;
  const dimMismatch = Boolean(h?.chunk_model_dim && h?.chunk_index_dim && h.chunk_model_dim !== h.chunk_index_dim);

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

      {/* Servis sağlık detayı (healthz) — YALNIZCA global indeksi raporlar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ServerCog className="size-4 text-primary" /> Genel FAISS İndeksi (global)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {health.isFetching && !h ? <Skeleton className="h-16 w-full" />
            : !reachable ? <p className="text-sm text-muted-foreground">Servis kapalı görünüyor; model/index bilgisi alınamadı.</p>
            : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-3">
                  <div><span className="text-muted-foreground">Genel index: </span><LazyValue value={h.index_size} /></div>
                  <div><span className="text-muted-foreground">Chunk index: </span><LazyValue value={h.chunk_index_size} /></div>
                  <div><span className="text-muted-foreground">Chunk motoru: </span>{h.chunk_engine_loaded ? 'Yüklü' : 'Kapalı'}</div>
                  <div className="col-span-2 truncate lg:col-span-3"><span className="text-muted-foreground">Model: </span>{h.chunk_model_name || '—'}</div>
                  <div><span className="text-muted-foreground">Model boyut: </span>{h.chunk_model_dim ?? '—'}</div>
                  <div><span className="text-muted-foreground">Index boyut: </span><LazyValue value={h.chunk_index_dim} /></div>
                </div>
                {mode !== undefined && (
                  <div className="flex items-center gap-2 border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">Çalışma modu:</span>
                    {mode
                      ? <Badge variant="success">Firma bazlı FAISS · Açık</Badge>
                      : <Badge variant="muted">Tek global indeks</Badge>}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Bu değerler global indeksi gösterir; firma indekslerinin toplamı değildir.
                  Chunk motoru tembel yüklenir — hiç arama yapılmadıysa sayılar boş görünebilir.
                </p>
              </>
            )}
        </CardContent>
      </Card>

      {dimMismatch && (
        <Alert variant="destructive">
          <AlertTitle>Model/İndeks boyut uyuşmazlığı</AlertTitle>
          <AlertDescription>
            Model {h.chunk_model_dim} boyutlu vektör üretiyor, indeks {h.chunk_index_dim} boyutlu.
            Arama sonuçları geçersiz olabilir.
          </AlertDescription>
        </Alert>
      )}

      {/* İçerik dokümanı istatistikleri */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Toplam Doküman" value={nfmt(s?.total ?? 0)} loading={statsLoading} />
        <StatCard label="Toplam Chunk" value={nfmt(s?.chunks ?? 0)} tone="text-primary" hint="yalnızca doküman kayıtları" loading={statsLoading} />
        <StatCard label="Toplam Token" value={nfmt(s?.tokens ?? 0)} loading={statsLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>İndeks Durumu Dağılımı</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {statsLoading ? <Skeleton className="h-24 w-full" /> : (
              Object.keys(s?.byState || {}).length === 0 ? <p className="text-sm text-muted-foreground">Veri yok.</p>
                : Object.entries(s.byState).map(([k, v]) => {
                    const m = stateMeta(k);
                    return <DistRow key={k} label={m.label} variant={m.variant} count={v} total={s.total || 0} />;
                  })
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Kaynak Dağılımı</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {statsLoading ? <Skeleton className="h-24 w-full" /> : (
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
