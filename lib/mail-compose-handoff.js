/**
 * Gelen kutusundan "Yeni Mail" (compose) sayfasına taslak aktarımı.
 *
 * Cevapla/İlet'e basıldığında compose'a doldurulacak alanlar (from/to/subject/html)
 * URL uzunluk sınırlarına takılmadan sessionStorage üzerinden taşınır. Compose
 * sayfası mount'ta bu anahtarı OKUR ve TÜKETİR (bir kerelik devir).
 */
export const COMPOSE_PREFILL_KEY = 'cms:compose:prefill';

/** compose mount'ta çağrılır: varsa taslağı döndürür ve anahtarı temizler. */
export function takeComposePrefill() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(COMPOSE_PREFILL_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(COMPOSE_PREFILL_KEY);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
