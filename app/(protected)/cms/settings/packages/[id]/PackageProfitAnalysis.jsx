'use client';

/**
 * PackageProfitAnalysis — Paket kâr/zarar analizi (canlı, salt-gösterim).
 *
 * Kredi sistemi maliyet tabanı: 1 kredi = $0.01 GERÇEK maliyet (backend
 * CREDIT_PER_USD=100 ile SENKRON — orada değişirse burayı da güncelle).
 *
 * Limitler artık PERİYOT BAZLI: her fiyat satırının (month/year/lifetime) kendi
 * limit objesi vardır ve kendi `llm.credit`'ini taşır. Reset fatura döngüsüne
 * bağlı; her periyot için döngü başına bir kez sıfırlanır. Bu yüzden maliyet =
 * o satırın kredisi × $0.01 (periyot başına TEK döngü — eski Daily/monthly
 * çarpanı kaldırıldı).
 *
 * Karşılaştırma USD üzerinden: currency=USD ise amount, değilse localPrices.USD
 * (yoksa satır içi USD girişi ile localPrices.USD'ye yazılır).
 *
 * Ömür boyu (lifetime): fatura döngüsü olmadığından tek-döngü maliyet yanıltıcı
 * olabilir; bu satırlar için marj gösterilmez, yalnız bilgi amaçlı etiketlenir.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Fallback: backend'den `creditUsdCost` gelmezse (offline/eski) 1 kredi = $0.01.
// Asıl değer backend Cost.creditPerUsd'den (credit-config endpoint) prop ile gelir.
const DEFAULT_CREDIT_USD_COST = 0.01;

const INTERVAL_LABEL = { month: 'Aylık', year: 'Yıllık', lifetime: 'Ömür Boyu' };

const fmtUsd = (n) => (Number.isFinite(n) ? `$${n.toFixed(2)}` : '—');
const fmtPct = (n) => (Number.isFinite(n) ? `%${Math.round(n)}` : '—');

export default function PackageProfitAnalysis({ pricing, limitsByInterval, credits, creditUsdCost }) {
  const [consumption, setConsumption] = useState(70); // beklenen tüketim %

  // Maliyet tabanı backend'den (Cost.creditPerUsd → creditUsdCost); yoksa fallback.
  const creditCost = Number(creditUsdCost) > 0 ? Number(creditUsdCost) : DEFAULT_CREDIT_USD_COST;
  const consPct = Math.min(100, Math.max(0, Number(consumption) || 0));
  const rows = (pricing || []).filter((p) => p.amount !== '' && p.amount != null);

  // Bir fiyat satırının kredi limitini oku: her periyodun kendi limit objesi var
  // (limitsByInterval[interval].llm.credit). Bulunamazsa tekil `credits` fallback.
  const creditFor = (interval) => {
    const perInterval = limitsByInterval?.[interval]?.llm?.credit;
    const raw = perInterval != null && perInterval !== '' ? perInterval : credits;
    return Number(raw) || 0;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kâr / Zarar Analizi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>Maliyet tabanı: <b className="text-foreground">1 kredi = ${creditCost}</b></span>
          <span>Kredi: <b className="text-foreground">periyoda göre (satırda)</b></span>
          <span>Reset: <b className="text-foreground">fatura döngüsü</b></span>
          <span className="flex items-center gap-1">
            Beklenen tüketim:
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
                  <th className="px-2 py-2 text-end">Kredi</th>
                  <th className="px-2 py-2 text-end">Net USD Fiyat</th>
                  <th className="px-2 py-2 text-end">Maliyet (max)</th>
                  <th className="px-2 py-2 text-end">Kâr (beklenen)</th>
                  <th className="px-2 py-2 text-end">Marj (beklenen)</th>
                  <th className="px-2 py-2 text-end">Başabaş tüketim</th>
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
                  // Periyot başına TEK döngü — reset fatura döngüsüne bağlı.
                  const maxCost = rowCredit * creditCost;
                  const expCost = maxCost * (consPct / 100);
                  const net = usdRaw != null && Number.isFinite(usdRaw) ? usdRaw * (1 - disc / 100) : null;
                  const profitExp = net != null ? net - expCost : null;
                  const marginExp = net != null && net > 0 ? (profitExp / net) * 100 : null;
                  const breakEven = maxCost > 0 && net != null ? (net / maxCost) * 100 : null;
                  const loss = profitExp != null && profitExp < 0;
                  const profitCls = loss ? 'text-red-600' : 'text-emerald-600';
                  return (
                    <tr key={i} className="border-b border-border/60">
                      <td className="px-2 py-2">
                        {INTERVAL_LABEL[p.interval] || p.interval}
                        {disc > 0 && <span className="ml-1 text-[10px] text-muted-foreground">(-%{disc})</span>}
                        {isLifetime && (
                          <span className="ml-1 text-[10px] text-amber-600">ömür boyu — tek seferlik grant</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-end font-mono">{rowCredit || '—'}</td>
                      <td className="px-2 py-2 text-end font-mono">
                        {net != null ? (
                          fmtUsd(net)
                        ) : (
                          <span className="text-[10px] text-amber-600">
                            fiyat satırında "USD karşılığı" gir
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-end font-mono">{fmtUsd(maxCost)}</td>
                      {isLifetime ? (
                        <>
                          <td className="px-2 py-2 text-end text-[10px] text-muted-foreground" colSpan={3}>
                            Ömür boyu — fatura döngüsü yok, marj hesaplanmaz
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={cn('px-2 py-2 text-end font-mono font-semibold', profitCls)}>
                            {profitExp != null ? fmtUsd(profitExp) : '—'}
                          </td>
                          <td className={cn('px-2 py-2 text-end', profitCls)}>{fmtPct(marginExp)}</td>
                          <td className="px-2 py-2 text-end">
                            {breakEven == null ? (
                              '—'
                            ) : breakEven >= 100 ? (
                              <span className="text-emerald-600">%&gt;100 (güvenli)</span>
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

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <b>Maliyet</b> = o periyodun kredisi × ${creditCost} (reset fatura döngüsüne bağlı, periyot başına tek döngü).
          <b> Net USD fiyat</b> = USD fiyat × (1 − indirim%). <b>Kâr (beklenen)</b> = net fiyat − (max maliyet ×
          beklenen tüketim%). <b>Başabaş tüketim</b>: bu %'nin ÜSTÜNDE tüketimde zarar; &quot;%&gt;100&quot; =
          tam tüketimde bile kârlı. Ömür boyu satırlarda fatura döngüsü olmadığından marj gösterilmez.
        </p>
      </CardContent>
    </Card>
  );
}
