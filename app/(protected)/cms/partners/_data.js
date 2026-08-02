/**
 * Partner Programı ekranlarının enum meta haritaları.
 *
 * Backend enum'larının (`src/domains/partner-application/partner-application.model.js`)
 * kopyasıdır. Backend'e yeni bir durum/tip eklenirse burası da güncellenmeli;
 * `metaOf` bilinmeyen değerde çökmez ama etiket ham string olarak görünür.
 */

/** `Badge` bileşeninin tanıdığı variant'lar: primary|success|warning|destructive|secondary|muted|outline */
export const applicationStatusMeta = {
  pending: { label: 'Beklemede', variant: 'warning' },
  in_review: { label: 'İncelemede', variant: 'primary' },
  approved: { label: 'Onaylandı', variant: 'success' },
  rejected: { label: 'Reddedildi', variant: 'destructive' },
};

export const partnerTypeMeta = {
  creator: { label: 'İçerik üreticisi', variant: 'muted' },
  agency: { label: 'Ajans', variant: 'muted' },
  consultant: { label: 'Danışman', variant: 'muted' },
  integrator: { label: 'Entegratör', variant: 'muted' },
};

export const statusFilterOptions = Object.keys(applicationStatusMeta);
export const partnerTypeFilterOptions = Object.keys(partnerTypeMeta);

/** Panelde bir başvurunun taşınabileceği durumlar. */
export const statusActionOptions = statusFilterOptions;

/** Bilinmeyen değerlerde çökmeyen güvenli etiket okuyucu. */
export const metaOf = (map, value) =>
  map[value] || { label: value || '—', variant: 'muted' };

/** Tarih gösterimi — CMS tek dilli (TR). */
export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
