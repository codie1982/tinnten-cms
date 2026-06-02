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

export const businessModeMeta = {
  service: { label: 'Hizmet', variant: 'secondary' },
  ecommerce: { label: 'E-ticaret', variant: 'primary' },
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
  { value: 'service', label: 'Hizmet' },
  { value: 'ecommerce', label: 'E-ticaret' },
];

export const companyTypeOptions = [
  { value: 'all', label: 'Firma Tipi' },
  { value: 'individual', label: 'Bireysel' },
  { value: 'corporate', label: 'Kurumsal' },
  { value: 'limited', label: 'Limited' },
];
