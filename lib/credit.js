/**
 * Kredi yardımcıları (CMS) — USD maliyeti kullanıcıya gösterilen krediye çevirir.
 *
 * Backend Cost.usdToCredits(usd) = round(usd × CREDIT_PER_USD) ile SENKRON.
 * Oran (creditPerUsd) backend'den `GET /system-packages/cms/credit-config` ile
 * gelir (useGetCreditConfigQuery); gelmezse varsayılan 100 (1 kredi = $0.01).
 */

export const DEFAULT_CREDIT_PER_USD = 100;

/** USD → kredi (tam sayı). Backend usdToCredits ile aynı formül. */
export function usdToCredits(usd, creditPerUsd = DEFAULT_CREDIT_PER_USD) {
  const v = Number(usd);
  const rate = Number(creditPerUsd) > 0 ? Number(creditPerUsd) : DEFAULT_CREDIT_PER_USD;
  return Number.isFinite(v) ? Math.round(v * rate) : 0;
}

/** Kredi gösterimi (binlik ayraçlı tam sayı). */
export function formatCredits(n, locale = 'tr-TR') {
  const v = Math.round(Number(n) || 0);
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v);
  } catch {
    return String(v);
  }
}
