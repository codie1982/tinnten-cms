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
