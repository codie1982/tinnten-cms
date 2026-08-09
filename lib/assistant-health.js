// ─────────────────────────────────────────────────────────────────────────────
// Asistan Sağlık Kontrolü — CMS sunum katmanı (etiketler + rozet eşlemesi).
//
// Puan ve sorun kimlikleri BACKEND'den gelir; burada yalnız Türkçe karşılıkları
// ve renkleri durur. Kural/eşik BURAYA KOPYALANMAZ — tek kaynak:
//     tinnten-server/src/services/assistantHealth.rules.js
//
// Yeni bir sorun kimliği eklenirse (backend ASSISTANT_HEALTH_ISSUE_IDS) buraya
// da etiketi yazılmalı; yazılmazsa `healthIssueLabel` kimliği ham gösterir
// (sessizce kaybolmaz, ekranda görünür ve fark edilir).
// ─────────────────────────────────────────────────────────────────────────────

/** Puan bandı → rozet. Sıra "en kötüden iyiye" (filtre menüsü bu sırayı kullanır). */
export const HEALTH_LEVEL_META = {
  critical: { label: 'Yetersiz', variant: 'destructive' },
  weak: { label: 'Zayıf', variant: 'warning' },
  fair: { label: 'İyi', variant: 'primary' },
  good: { label: 'Hazır', variant: 'success' },
};

export const HEALTH_LEVEL_OPTIONS = [
  { value: 'critical', label: 'Yetersiz' },
  { value: 'weak', label: 'Zayıf' },
  { value: 'fair', label: 'İyi' },
  { value: 'good', label: 'Hazır' },
];

export const HEALTH_SEVERITY_META = {
  critical: { label: 'Kritik', className: 'text-destructive' },
  warning: { label: 'Uyarı', className: 'text-amber-600 dark:text-amber-500' },
  info: { label: 'Bilgi', className: 'text-muted-foreground' },
};

/**
 * Sorun kimliği → müşteri temsilcisinin anlayacağı kısa Türkçe.
 * Uzun açıklama son kullanıcı panelinde (tinnten-nextjs `assistantHealth.issues.*`);
 * CMS'te amaç hızlı tarama olduğu için tek satır tutuluyor.
 */
export const HEALTH_ISSUE_LABELS = {
  no_tools: 'Hiçbir yetenek açık değil',
  no_grounding: 'Hiç bilgi kaynağı yok — web araması da kapalı',
  no_knowledge_source: 'Bilgi tabanı bağlı değil',
  knowledge_base_empty: 'Firmanın bilgi tabanı boş',
  knowledge_source_indexing: 'Bağlı kaynak henüz taranmadı (indeksleme sürüyor)',
  rag_disabled: 'Bilgi tabanı araması kapalı — kaynaklar okunmuyor',
  web_search_off: 'Web araması kapalı',
  web_search_unscoped: 'Web araması sınırsız (konu/site kısıtı yok)',
  weak_system_prompt: 'Talimat metni çok kısa',
  no_catalog_tool: 'Katalog yeteneği açık değil',
  catalog_empty_product: 'Sistemde aktif ürün yok',
  catalog_empty_service: 'Sistemde aktif hizmet yok',
  catalog_empty_booking: 'Randevu verilebilir hizmet yok',
  catalog_empty_offer: 'Teklif toplanabilir hizmet yok',
};

export const healthIssueLabel = (id) => HEALTH_ISSUE_LABELS[id] ?? id;

export const healthLevelMeta = (level) =>
  HEALTH_LEVEL_META[level] ?? { label: level ?? '—', variant: 'muted' };

/**
 * Sayım gösterimi. `null` = ÖLÇÜLEMEDİ (firma yok ya da sorgu patladı),
 * `0` = gerçekten yok. İkisini aynı göstermek yanlış teşhise yol açar:
 * "ürünü yok" ile "ürününü sayamadık" farklı aksiyonlar gerektirir.
 */
export const formatHealthCount = (value) =>
  value === null || value === undefined ? 'ölçülemedi' : String(value);
