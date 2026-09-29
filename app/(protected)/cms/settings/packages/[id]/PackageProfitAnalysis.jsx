'use client';

/**
 * LLM kredisi müşterinin harcanabilir bakiyesidir. Depolama ise byte tabanlı
 * ayrılmış kapasite maliyetidir. Kredi eşdeğeri yalnız ortak maliyet birimi
 * olarak gösterilir; hiçbir zaman `limit.llm.credit` alanına eklenmez.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { aiCatalogApi } from '@/lib/ai-catalog';
import { cn } from '@/lib/utils';
import { allocatedStorageUsd, periodMonths } from './quota-utils.mjs';

// Fallback: backend'den `creditUsdCost` gelmezse (offline/eski) 1 kredi = $0.01.
// Asıl değer backend Cost.creditPerUsd'den (credit-config endpoint) prop ile gelir.
const DEFAULT_CREDIT_USD_COST = 0.01;

const INTERVAL_LABEL = { month: 'Aylık', year: 'Yıllık', lifetime: 'Ömür Boyu' };

const fmtUsd = (n) => {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: n > 0 && n < 0.01 ? 6 : 2,
  }).format(n);
};
const fmtPct = (n) => (Number.isFinite(n) ? `%${Math.round(n)}` : '—');
const fmtCredits = (n) => (
  Number.isFinite(n)
    ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(n)
    : '—'
);
const fmtTokens = (n) => (
  Number.isFinite(n)
    ? new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 2 }).format(n)
    : '—'
);

export default function PackageProfitAnalysis({ pricing, limitsByInterval, credits, creditUsdCost }) {
  const [consumption, setConsumption] = useState(70);
  const [tokenModels, setTokenModels] = useState([]);
  const [tokenModelId, setTokenModelId] = useState('');
  const creditCost = Number(creditUsdCost) > 0 ? Number(creditUsdCost) : DEFAULT_CREDIT_USD_COST;
  const consPct = Math.min(100, Math.max(0, Number(consumption) || 0));
  const rows = (pricing || []).filter((p) => p.amount !== '' && p.amount != null);

  const limitsFor = (interval) =>
    limitsByInterval?.[interval] || limitsByInterval?.month || limitsByInterval?.year;

  const creditFor = (interval) => {
    const perInterval = limitsFor(interval)?.llm?.credit;
    const raw = perInterval != null && perInterval !== '' ? perInterval : credits;
    return Number(raw) || 0;
  };

  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      const context = await aiCatalogApi.context(abort.signal);
      if (abort.signal.aborted || (!context.availability?.catalog && !context.readAvailability?.catalog)) return;
      const page = await aiCatalogApi.models(abort.signal);
      if (abort.signal.aborted) return;
      const usable = (page.items || []).filter((model) =>
        Number(model.creditTariff?.input) > 0 && Number(model.creditTariff?.output) > 0,
      );
      setTokenModels(usable);
      setTokenModelId((current) => current || usable[0]?.id || '');
    })().catch(() => {
      // Token dönüşümü yardımcı analizdir; katalog kapalıysa paket editörünü etkilemez.
    });
    return () => abort.abort();
  }, []);

  const tokenModel = tokenModels.find((model) => model.id === tokenModelId) || tokenModels[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kâr / Zarar Analizi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>Maliyet tabanı: <b className="text-foreground">1 kredi = ${creditCost}</b></span>
          <span>LLM: <b className="text-foreground">periyot kredisi × kredi maliyeti</b></span>
          <span>Depolama: <b className="text-foreground">byte tarife × kapasite × ay</b></span>
          <span className="flex items-center gap-1">
            Beklenen LLM tüketimi:
            <Input
              type="number" min="0" max="100" value={consumption}
              onChange={(e) => setConsumption(e.target.value)}
              className="h-7 w-16"
            />
            %
          </span>
        </div>

        {rows.length === 0 && <p className="text-sm text-muted-foreground">Analiz için fiyat satırı ekleyin.</p>}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 text-start">Periyot</th>
                  <th className="px-2 py-2 text-end">LLM kredisi</th>
                  <th className="px-2 py-2 text-end">LLM max</th>
                  <th className="px-2 py-2 text-end">Depolama / kredi eşd.</th>
                  <th className="px-2 py-2 text-end">Toplam max</th>
                  <th className="px-2 py-2 text-end">Net USD fiyat</th>
                  <th className="px-2 py-2 text-end">Kâr (beklenen)</th>
                  <th className="px-2 py-2 text-end">Marj</th>
                  <th className="px-2 py-2 text-end">Başabaş LLM tüketimi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => {
                  const isLifetime = p.interval === 'lifetime';
                  const usdRaw =
                    p.currency === 'USD'
                      ? Number(p.amount)
                      : p.localPrices?.USD != null && p.localPrices?.USD !== ''
                        ? Number(p.localPrices.USD)
                        : null;
                  const disc = Math.min(100, Math.max(0, Number(p.discount) || 0));
                  const rowCredit = creditFor(p.interval);
                  const aiMaxCost = rowCredit * creditCost;
                  const aiExpectedCost = aiMaxCost * (consPct / 100);
                  const limits = limitsFor(p.interval);
                  const months = periodMonths(p.interval, p.durationTime);
                  const storageCost = allocatedStorageUsd({
                    maxBytes: limits?.storage?.maxBytes,
                    usdPerByteMonth: p.costRates?.storage?.usdPerByteMonth || '0',
                    // Lifetime için toplam uydurmak yerine aylık run-rate gösterilir.
                    months: isLifetime ? 1 : months,
                  });
                  const storageCredits = storageCost == null ? null : storageCost / creditCost;
                  const totalMaxCost = !isLifetime && storageCost != null ? aiMaxCost + storageCost : null;
                  const expectedCost = !isLifetime && storageCost != null
                    ? aiExpectedCost + storageCost
                    : null;
                  const net = usdRaw != null && Number.isFinite(usdRaw) ? usdRaw * (1 - disc / 100) : null;
                  const profitExp = net != null && expectedCost != null ? net - expectedCost : null;
                  const marginExp = net != null && net > 0 && profitExp != null ? (profitExp / net) * 100 : null;
                  const breakEven = net != null && storageCost != null
                    ? aiMaxCost > 0
                      ? ((net - storageCost) / aiMaxCost) * 100
                      : net >= storageCost ? Infinity : 0
                    : null;
                  const loss = profitExp != null && profitExp < 0;
                  const profitCls = loss ? 'text-red-600' : 'text-emerald-600';
                  return (
                    <tr key={i} className="border-b border-border/60">
                      <td className="px-2 py-2">
                        {INTERVAL_LABEL[p.interval] || p.interval}
                        {disc > 0 && <span className="ml-1 text-[10px] text-muted-foreground">(-%{disc})</span>}
                        {isLifetime && (
                          <span className="ml-1 text-[10px] text-amber-600">aylık run-rate</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-end font-mono">{fmtCredits(rowCredit)}</td>
                      <td className="px-2 py-2 text-end font-mono">{fmtUsd(aiMaxCost)}</td>
                      <td className="px-2 py-2 text-end font-mono">
                        {storageCost == null ? (
                          <span className="text-[10px] text-amber-600">sınırsız kapasite — hesaplanamaz</span>
                        ) : (
                          <>
                            {fmtUsd(storageCost)}
                            <span className="block text-[10px] text-muted-foreground">
                              {fmtCredits(storageCredits)} kredi eşd.{isLifetime ? ' / ay' : ''}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-2 py-2 text-end font-mono">{fmtUsd(totalMaxCost)}</td>
                      <td className="px-2 py-2 text-end font-mono">
                        {net != null ? (
                          fmtUsd(net)
                        ) : (
                          <span className="text-[10px] text-amber-600">USD karşılığı gir</span>
                        )}
                      </td>
                      {isLifetime ? (
                        <td className="px-2 py-2 text-end text-[10px] text-muted-foreground" colSpan={3}>
                          Ömür boyunda yalnız aylık depolama run-rate gösterilir; toplam marj hesaplanmaz
                        </td>
                      ) : (
                        <>
                          <td className={cn('px-2 py-2 text-end font-mono font-semibold', profitCls)}>
                            {profitExp != null ? fmtUsd(profitExp) : '—'}
                          </td>
                          <td className={cn('px-2 py-2 text-end', profitCls)}>{fmtPct(marginExp)}</td>
                          <td className="px-2 py-2 text-end">
                            {breakEven == null ? '—' : breakEven === Infinity || breakEven >= 100 ? (
                              <span className="text-emerald-600">%&gt;100 (güvenli)</span>
                            ) : breakEven < 0 ? (
                              <span className="text-red-600">depolama maliyeti fiyatı aşıyor</span>
                            ) : (
                              <span className="text-red-600">{fmtPct(breakEven)}</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tokenModel && rows.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Model Bazlı Token Tahmini</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Kredi tek başına sabit token sayısı değildir; seçilen modelin input/output tarifesine göre değişir.
                </p>
              </div>
              <label className="grid gap-1 text-[11px] text-muted-foreground">
                Model
                <select
                  value={tokenModel.id}
                  onChange={(event) => setTokenModelId(event.target.value)}
                  className="h-9 min-w-56 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                >
                  {tokenModels.map((model) => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {rows.map((row, index) => {
                const rowCredits = creditFor(row.interval);
                const inputTokens = (rowCredits / Number(tokenModel.creditTariff.input)) * 1_000_000;
                const outputTokens = (rowCredits / Number(tokenModel.creditTariff.output)) * 1_000_000;
                return (
                  <div key={`${row.interval}-${index}`} className="rounded-md border border-border bg-background px-3 py-2 text-xs">
                    <b>{INTERVAL_LABEL[row.interval] || row.interval}: {fmtCredits(rowCredits)} kredi</b>
                    <p className="mt-1 text-muted-foreground">
                      ≈ {fmtTokens(inputTokens)} yalnız input token veya {fmtTokens(outputTokens)} yalnız output token
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Gerçek kullanım input ve output&apos;un karışımıdır; değerler aktif katalog tarifesine göre iki uç senaryoyu gösterir.
            </p>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <b>LLM max maliyeti</b> = spendable kredi × kredi USD maliyeti. <b>Depolama maliyeti</b> = ayrılan byte
          kapasitesi × byte/ay tarifesi × periyot ayı; beklenen tüketim yüzdesinden etkilenmez. Yanındaki kredi değeri
          yalnız maliyet eşdeğeridir, müşterinin LLM kredisine eklenmez. <b>Beklenen kâr</b> = net fiyat − depolama
          maliyeti − beklenen LLM maliyeti. Örneğin mevcut $0.01/kredi oranında 20.000 LLM kredisi $200 max maliyettir.
        </p>
      </CardContent>
    </Card>
  );
}
