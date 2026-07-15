'use client';

/**
 * PackageProfitAnalysis — Paket kâr/zarar analizi (canlı, salt-gösterim).
 *
 * Kredi sistemi maliyet tabanı: 1 kredi = $0.01 GERÇEK maliyet (backend
 * CREDIT_PER_USD=100 ile SENKRON — orada değişirse burayı da güncelle).
 * Paket, `limit.llm.credit` krediyi RESET DÖNGÜSÜ başına verir (llm.regeneretetime:
 * Daily → günlük, monthly → aylık). Fiyat ise periyot başına (month/year/lifetime).
 * Bu yüzden maliyet = kredi × $0.01 × (periyottaki döngü sayısı).
 *
 * Karşılaştırma USD üzerinden: currency=USD ise amount, değilse localPrices.USD
 * (yoksa satır içi USD girişi ile localPrices.USD'ye yazılır).
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Fallback: backend'den `creditUsdCost` gelmezse (offline/eski) 1 kredi = $0.01.
// Asıl değer backend Cost.creditPerUsd'den (credit-config endpoint) prop ile gelir.
const DEFAULT_CREDIT_USD_COST = 0.01;

const INTERVAL_LABEL = { month: 'Aylık', year: 'Yıllık', lifetime: 'Ömür Boyu' };

// Reset döngüsü + fiyat periyodu → periyottaki döngü sayısı (maliyet çarpanı).
function cyclesPerInterval(resetPeriod, interval) {
  const daily = String(resetPeriod ?? '').toLowerCase() === 'daily';
  if (interval === 'month') return daily ? 30 : 1;
  if (interval === 'year') return daily ? 365 : 12;
  return null; // lifetime — süre belirsiz
}

const fmtUsd = (n) => (Number.isFinite(n) ? `$${n.toFixed(2)}` : '—');
const fmtPct = (n) => (Number.isFinite(n) ? `%${Math.round(n)}` : '—');

export default function PackageProfitAnalysis({ pricing, credits, resetPeriod, creditUsdCost, setPriceRow }) {
  const [consumption, setConsumption] = useState(70); // beklenen tüketim %

  const creditNum = Number(credits) || 0;
  // Maliyet tabanı backend'den (Cost.creditPerUsd → creditUsdCost); yoksa fallback.
  const creditCost = Number(creditUsdCost) > 0 ? Number(creditUsdCost) : DEFAULT_CREDIT_USD_COST;
  const consPct = Math.min(100, Math.max(0, Number(consumption) || 0));
  const rows = (pricing || []).filter((p) => p.amount !== '' && p.amount != null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kâr / Zarar Analizi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>Maliyet tabanı: <b className="text-foreground">1 kredi = ${creditCost}</b></span>
          <span>Kredi / döngü: <b className="text-foreground">{creditNum || '—'}</b></span>
          <span>Reset: <b className="text-foreground">{resetPeriod || 'Daily'}</b></span>
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

        {creditNum <= 0 && (
          <p className="text-sm text-amber-600">LLM kredi limiti 0/boş — maliyet hesaplanamaz (Limitler → LLM → Kredi).</p>
        )}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Analiz için fiyat satırı ekleyin.</p>}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 text-start">Periyot</th>
                  <th className="px-2 py-2 text-end">Net USD Fiyat</th>
                  <th className="px-2 py-2 text-end">Maliyet (max)</th>
                  <th className="px-2 py-2 text-end">Kâr (beklenen)</th>
                  <th className="px-2 py-2 text-end">Marj (beklenen)</th>
                  <th className="px-2 py-2 text-end">Başabaş tüketim</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const i = pricing.indexOf(p);
                  const usdRaw =
                    p.currency === 'USD'
                      ? Number(p.amount)
                      : p.localPrices?.USD != null && p.localPrices?.USD !== ''
                        ? Number(p.localPrices.USD)
                        : null;
                  const disc = Math.min(100, Math.max(0, Number(p.discount) || 0));
                  const cycles = cyclesPerInterval(resetPeriod, p.interval);
                  const maxCost = creditNum * creditCost * (cycles ?? 1);
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
                        {cycles == null && (
                          <span className="ml-1 text-[10px] text-amber-600">süre belirsiz → tek döngü</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-end font-mono">
                        {net != null ? (
                          fmtUsd(net)
                        ) : (
                          <Input
                            type="number" placeholder="USD gir" className="ml-auto h-7 w-24"
                            value={p.localPrices?.USD ?? ''}
                            onChange={(e) =>
                              setPriceRow(i, 'localPrices', { ...(p.localPrices || {}), USD: e.target.value })
                            }
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 text-end font-mono">{fmtUsd(maxCost)}</td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <b>Maliyet</b> = kredi/döngü × ${creditCost} × periyottaki döngü sayısı (Daily reset: ay=30, yıl=365 döngü;
          monthly: ay=1, yıl=12). <b>Net USD fiyat</b> = USD fiyat × (1 − indirim%). <b>Kâr (beklenen)</b> =
          net fiyat − (max maliyet × beklenen tüketim%). <b>Başabaş tüketim</b>: bu %'nin ÜSTÜNDE tüketimde
          zarar; &quot;%&gt;100&quot; = tam tüketimde bile kârlı.
        </p>
      </CardContent>
    </Card>
  );
}
