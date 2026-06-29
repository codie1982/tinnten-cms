/**
 * Ürünler / Hizmetler bölümü — paylaşılan sabit veriler (meta + filtre/sıralama
 * seçenekleri). list/page.jsx, [id]/page.jsx ve firma detay sekmesi import eder.
 *
 * Backend `products` koleksiyonu hem ürünü hem hizmeti tutar; `type` alanı ayırır.
 * Enum değerleri model ile birebir (products.model.js): type, status, pricetype.
 * DİKKAT: type enum'u çoğul "services" — firma businessMode'daki tekil "service"
 * ile karıştırma.
 */

export const typeMeta = {
  product: { label: 'Ürün', variant: 'primary' },
  services: { label: 'Hizmet', variant: 'secondary' },
};

export const statusMeta = {
  draft: { label: 'Taslak', variant: 'muted' },
  pending: { label: 'Beklemede', variant: 'warning' },
  active: { label: 'Aktif', variant: 'success' },
  inactive: { label: 'Pasif', variant: 'muted' },
  rejected: { label: 'Reddedildi', variant: 'destructive' },
};

export const adminAproveMeta = {
  true: { label: 'Admin Onaylı', variant: 'success' },
  false: { label: 'Admin Durdurdu', variant: 'destructive' },
};

export const pricetypeMeta = {
  fixed: { label: 'Sabit Fiyat', variant: 'muted' },
  rental: { label: 'Kiralık', variant: 'secondary' },
  offer_based: { label: 'Teklife Bağlı', variant: 'warning' },
};

export const stockStatusMeta = {
  in_stock: { label: 'Stokta', variant: 'success' },
  out_of_stock: { label: 'Stok Yok', variant: 'destructive' },
  limited: { label: 'Sınırlı', variant: 'warning' },
  preorder: { label: 'Ön Sipariş', variant: 'secondary' },
};

export const typeOptions = [
  { value: 'all', label: 'Tüm Türler' },
  { value: 'product', label: 'Ürün' },
  { value: 'services', label: 'Hizmet' },
];

export const statusOptions = [
  { value: 'all', label: 'Tüm Durumlar' },
  { value: 'draft', label: 'Taslak' },
  { value: 'pending', label: 'Beklemede' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Pasif' },
  { value: 'rejected', label: 'Reddedildi' },
];

/**
 * Sıralama seçenekleri — birleşik `field:order` value. Tek <Select> hem `sort`
 * hem `order` query param'ını sürer; tüketici `:` ile ayırır.
 */
export const sortOptions = [
  { value: 'createdAt:desc', label: 'En Yeni' },
  { value: 'createdAt:asc', label: 'En Eski' },
  { value: 'updatedAt:desc', label: 'Son Güncellenen' },
  { value: 'title:asc', label: 'Başlık (A→Z)' },
  { value: 'title:desc', label: 'Başlık (Z→A)' },
  { value: 'priceAmount:desc', label: 'Fiyat (Yüksek→Düşük)' },
  { value: 'priceAmount:asc', label: 'Fiyat (Düşük→Yüksek)' },
];

/* ── Alt-kaynak (zamanlama / konum / form) seçenek & meta tabloları ───────── */

export const locationModeMeta = {
  fixed: { label: 'Sabit Adres', variant: 'primary' },
  radius: { label: 'Bölgesel (Yarıçap)', variant: 'secondary' },
  online: { label: 'Çevrimiçi', variant: 'muted' },
};

export const locationModeOptions = [
  { value: 'fixed', label: 'Sabit Adres' },
  { value: 'radius', label: 'Bölgesel (Yarıçap)' },
  { value: 'online', label: 'Çevrimiçi' },
];

/** timeRestriction.days enum değerleri (model ile birebir) + kısa TR etiket. */
export const weekDayOptions = [
  { value: 'monday', label: 'Pzt' },
  { value: 'tuesday', label: 'Sal' },
  { value: 'wednesday', label: 'Çar' },
  { value: 'thursday', label: 'Per' },
  { value: 'friday', label: 'Cum' },
  { value: 'saturday', label: 'Cmt' },
  { value: 'sunday', label: 'Paz' },
];

export const reservationPricingUnitOptions = [
  { value: 'per_night', label: 'Gecelik' },
  { value: 'per_day', label: 'Günlük' },
  { value: 'per_hour', label: 'Saatlik' },
  { value: 'per_person', label: 'Kişi Başı' },
  { value: 'flat', label: 'Sabit' },
];

/** timeRestriction.dateRanges[].type seçenekleri. */
export const rangeModeOptions = [
  { value: 'manual', label: 'Manuel Tarih' },
  { value: 'weekdays', label: 'Hafta İçi' },
  { value: 'weekends', label: 'Hafta Sonu' },
];

/** Ürün form slotları → etiket + backend dynamicform.type eşlemesi. */
export const formSlotMeta = {
  requestForm: { label: 'Müşteri Talep Formu', type: 'customer' },
  productForm: { label: 'Ürün Yapılandırma Formu', type: 'product' },
};

/** tr-TR para birimi formatlayıcı — priceAmount null ise "—". */
export function formatPrice(amount, currency) {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency || 'TRY',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency || 'TRY'}`;
  }
}
