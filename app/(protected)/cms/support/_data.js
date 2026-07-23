/**
 * Destek masası enum meta'ları.
 *
 * ⚠️ Backend enum'larından KOPYALANIR, elle yazılmaz. Kaynaklar:
 *   status   → tinnten-server/src/domains/support-area/support-area.state.js
 *   priority → support-area.model.js
 *   callback → support-callback.model.js
 * Değer eşleşmezse rozet "bilinmiyor"a düşer ve filtre sessizce boş döner.
 */

export const statusMeta = {
  open: { label: 'Açık', variant: 'primary' },
  triaged: { label: 'Sınıflandırıldı', variant: 'secondary' },
  in_progress: { label: 'İşlemde', variant: 'warning' },
  waiting_customer: { label: 'Müşteri Bekleniyor', variant: 'info' },
  resolved: { label: 'Çözüldü', variant: 'success' },
  closed: { label: 'Kapalı', variant: 'muted' },
  cancelled: { label: 'İptal', variant: 'destructive' },
};

export const priorityMeta = {
  low: { label: 'Düşük', variant: 'muted' },
  normal: { label: 'Normal', variant: 'secondary' },
  high: { label: 'Yüksek', variant: 'warning' },
  urgent: { label: 'Acil', variant: 'destructive' },
};

export const callbackStatusMeta = {
  requested: { label: 'Bekliyor', variant: 'primary' },
  confirmed: { label: 'Onaylandı', variant: 'info' },
  completed: { label: 'Tamamlandı', variant: 'success' },
  cancelled: { label: 'İptal', variant: 'muted' },
  no_answer: { label: 'Cevap Yok', variant: 'destructive' },
};

/** Kapanış aktörü — kullanıcıya "kim kapattı" ayrımı gösterilir. */
export const closedByMeta = {
  user: 'Müşteri onayladı',
  agent: 'Destek ekibi kapattı',
  system: 'Otomatik kapandı (7 gün)',
};

/**
 * Ajanın bir talebi taşıyabileceği durumlar.
 * Backend durum makinesi ayrıca doğrular (assertTransition) — bu liste yalnız
 * arayüzü sadeleştirir, GÜVENLİK SINIRI DEĞİLDİR.
 */
export const agentStatusOptions = [
  'triaged',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed',
  'cancelled',
];

export const statusFilterOptions = Object.keys(statusMeta);
export const priorityFilterOptions = Object.keys(priorityMeta);

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

/**
 * Talebi açan kişinin görünen adı.
 *
 * Anonim talepler `userId` TAŞIMAZ — `contact` fallback'i olmadan liste boş
 * hücre gösterirdi. (Anonim talepler kullanıcı API'sinden okunamaz ama CMS
 * kuyruğunda görünür.)
 */
export const requesterLabel = (ticket) => {
  if (ticket?.isAnonymous) {
    return ticket?.contact?.email || ticket?.contact?.name || 'Anonim';
  }
  return ticket?.contact?.name || ticket?.contact?.email || 'Kullanıcı';
};
