/**
 * Firmalar bölümü — paylaşılan sabit veriler (meta + filtre seçenekleri).
 * list/page.jsx ve [id]/page.jsx bu dosyadan import eder.
 *
 * Durum (status) backend'de türetilir: deriveCompanyStatus()
 *   rejected → blocked, active/adminActive → suspended,
 *   salesApproval.pending → pending, diğer → approved
 */

export const statusMeta = {
  approved: { label: 'Onaylı', variant: 'success' },
  pending: { label: 'Beklemede', variant: 'warning' },
  suspended: { label: 'Askıda', variant: 'muted' },
  blocked: { label: 'Engelli', variant: 'destructive' },
};

export const companyTypeMeta = {
  individual: { label: 'Bireysel', variant: 'muted' },
  corporate: { label: 'Kurumsal', variant: 'primary' },
  limited: { label: 'Limited', variant: 'secondary' },
};

/**
 * İş modu (businessMode) — backend `constants/businessModes.js` ile BİREBİR
 * aynı olmalı. `service` canonical değil, taşınmamış eski kayıtların storage
 * değeridir; yeni firma bu değeri ALMAZ ama listede görünebilir.
 */
export const businessModeMeta = {
  ecommerce: { label: 'E-ticaret', variant: 'primary' },
  direct: { label: 'Düz satış', variant: 'secondary' },
  quote: { label: 'Teklif', variant: 'secondary' },
  reservation: { label: 'Rezervasyon', variant: 'secondary' },
  appointment: { label: 'Randevu', variant: 'secondary' },
  content: { label: 'Blog / İçerik', variant: 'outline' },
  service: { label: 'Hizmet (eski)', variant: 'muted' },
};

/**
 * POC = demo/vitrin firması, gerçek müşteri DEĞİL. Ayırt eden tek kalıcı alan
 * `companies.poc`; slug öneki ("poc-") ve firma adındaki ek müşteriye görünür
 * oldukları için kaldırıldı — onlara GÜVENME.
 */
export const pocMeta = {
  true: { label: 'POC', variant: 'warning' },
};

/**
 * Dil ekseni firmada DEĞİL asistandadır (`asistans.locale`); liste bu yüzden
 * firmanın asistanlarında geçen dilleri gösterir. Diller frontend
 * `messages/<locale>.json` ailesiyle aynı 9 dildir.
 */
export const localeMeta = {
  tr: { label: 'TR' },
  en: { label: 'EN' },
  de: { label: 'DE' },
  ar: { label: 'AR' },
  el: { label: 'EL' },
  es: { label: 'ES' },
  fr: { label: 'FR' },
  it: { label: 'IT' },
  ru: { label: 'RU' },
};

export const statusOptions = [
  { value: 'all', label: 'Tüm Durumlar' },
  { value: 'approved', label: 'Onaylı' },
  { value: 'pending', label: 'Beklemede' },
  { value: 'suspended', label: 'Askıda' },
  { value: 'blocked', label: 'Engelli' },
];

export const businessModeOptions = [
  { value: 'all', label: 'Tüm Modlar' },
  { value: 'ecommerce', label: 'E-ticaret' },
  { value: 'direct', label: 'Düz satış' },
  { value: 'quote', label: 'Teklif' },
  { value: 'reservation', label: 'Rezervasyon' },
  { value: 'appointment', label: 'Randevu' },
  { value: 'content', label: 'Blog / İçerik' },
  { value: 'service', label: 'Hizmet (eski)' },
];

export const companyTypeOptions = [
  { value: 'all', label: 'Firma Tipi' },
  { value: 'individual', label: 'Bireysel' },
  { value: 'corporate', label: 'Kurumsal' },
  { value: 'limited', label: 'Limited' },
];

/** `poc` değerleri string gönderilir — backend `req.query.poc === "true"` karşılaştırır. */
export const pocOptions = [
  { value: 'all', label: 'POC + Gerçek' },
  { value: 'true', label: 'Yalnız POC' },
  { value: 'false', label: 'Yalnız gerçek' },
];

/** Asistan diline göre filtre (backend: asistans.locale → firma id'leri). */
export const localeOptions = [
  { value: 'all', label: 'Tüm Diller' },
  ...Object.entries(localeMeta).map(([value, meta]) => ({ value, label: meta.label })),
];
