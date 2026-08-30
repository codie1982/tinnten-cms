/**
 * Abonelikten çıkma gerekçe kategorileri — SUNUM katmanı (etiket + renk).
 *
 * Kategorilerin ANLAMI backend'de tanımlı (tinnten-server
 * `src/domains/mail-list/unsubscribeReasons.js`); burada yalnız CMS'in
 * göstereceği Türkçe etiket + grafik/rozet rengi tutulur. Backend stats yanıtı
 * her çıkışa `category` alanı koyar; bu tablo o kategoriyi renklendirir.
 *
 * Renk seçimi bilinçli: kendi çıkışı NÖTR (kullanıcı hakkı, sorun değil),
 * teslimat sorunu KIRMIZI (itibar riski), liste temizliği MOR (bizim koruma),
 * elle çıkarma MAVİ (operatör aksiyonu).
 */

export const UNSUB_CATEGORY_META = {
  self: {
    label: 'Kendi çıktı',
    hint: 'Kişi mailden/hesabından abonelikten çıktı',
    color: '#f59e0b', // amber
    badge: 'muted',
  },
  operator: {
    label: 'Elle çıkarıldı',
    hint: 'CMS’te editör tarafından listeden çıkarıldı veya engellendi',
    color: '#3b82f6', // blue
    badge: 'secondary',
  },
  cleanup: {
    label: 'Liste temizliği',
    hint: 'Gönderim koruması: alan-adı sınırı veya yanlış muhatap kutusu',
    color: '#8b5cf6', // violet
    badge: 'secondary',
  },
  delivery: {
    label: 'Teslimat sorunu',
    hint: 'Kalıcı bounce, spam şikâyeti veya Kara Liste',
    color: '#ef4444', // red
    badge: 'destructive',
  },
  other: {
    label: 'Diğer',
    hint: 'Sınıflandırılmamış gerekçe',
    color: '#94a3b8', // slate
    badge: 'muted',
  },
};

/** Grafik/legend'in sabit sırası. */
export const UNSUB_CATEGORY_ORDER = ['self', 'operator', 'cleanup', 'delivery', 'other'];

export const categoryMeta = (key) => UNSUB_CATEGORY_META[key] || UNSUB_CATEGORY_META.other;

/**
 * Backend `categories` objesini ({ self: n, operator: n, ... }) grafik/legend
 * için diziye çevirir; sıfır olanlar elenir, sabit sırada döner.
 */
export const toCategorySegments = (categories = {}) =>
  UNSUB_CATEGORY_ORDER
    .map((key) => ({ key, value: Number(categories[key]) || 0, ...categoryMeta(key) }))
    .filter((s) => s.value > 0);
