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
 * Liste ekranındaki kullanıcı-dostu hesap tipi ekseni.
 *
 * Backend eski kayıtlarla uyumluluk için `corporate` ve `limited` değerlerini
 * ayrı saklamaya devam eder. Yeni onboarding ise bunları tek bir "Ticari"
 * seçeneğinde toplar; liste de aynı sözleşmeyi gösterir.
 */
export const companyTypeGroupMeta = {
  individual: { label: 'Bireysel', variant: 'muted' },
  commercial: { label: 'Ticari', variant: 'primary' },
};

export const resolveCompanyTypeGroup = (companyType) => {
  if (companyType === 'individual') return 'individual';
  if (companyType === 'corporate' || companyType === 'limited')
    return 'commercial';
  return null;
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

/** Çoklu mod alanını okur; eski tekil kayıtlarda `businessMode`a geri düşer. */
export const resolveCompanyBusinessModes = (company) => {
  const storedModes =
    Array.isArray(company?.businessModes) && company.businessModes.length > 0
      ? company.businessModes
      : company?.businessMode
        ? [company.businessMode]
        : [];

  return [
    ...new Set(storedModes.filter((mode) => typeof mode === 'string' && mode)),
  ];
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
  { value: 'all', label: 'Tüm Hesap Tipleri' },
  { value: 'individual', label: 'Bireysel' },
  { value: 'commercial', label: 'Ticari' },
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
