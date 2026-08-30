import { Image as ImageIcon, Film, Music, FileText, File } from 'lucide-react';

export const MEDIA_META = {
  image: { label: 'Resim', icon: ImageIcon, tone: 'text-violet-600' },
  video: { label: 'Video', icon: Film, tone: 'text-rose-600' },
  audio: { label: 'Ses', icon: Music, tone: 'text-amber-600' },
  document: { label: 'Doküman', icon: FileText, tone: 'text-sky-600' },
  file: { label: 'Dosya', icon: File, tone: 'text-muted-foreground' },
};

/**
 * Kaynak grupları — backend `filesCmsController.SOURCE_GROUPS` ile aynı
 * anahtarlar. Anahtar seti burada değişirse orası da değişmeli; aksi halde
 * filtre butonu backend'de karşılığı olmayan bir `source` gönderir ve liste
 * sessizce filtresiz döner.
 */
export const SOURCE_META = {
  library: { label: 'Kütüphaneye eklenen', badge: 'primary' },
  conversation: { label: 'Konuşmada eklenen', badge: 'success' },
  ai: { label: 'AI üretimi', badge: 'warning' },
  media: { label: 'Medya yüklemesi', badge: 'secondary' },
  support: { label: 'Destek eki', badge: 'muted' },
};

export function formatBytes(b) {
  if (!b) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export function formatTr(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTrDateTime(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Saniye kırılımlı tam zaman damgası + göreli süre.
 * Denetim ekranında "hangi saat ve saniyede" sorusunun cevabı bu — dakika
 * hassasiyeti aynı dosyanın iki yüklemesini ayırt etmeye yetmiyor.
 */
export function formatTrExact(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function formatRelativeTr(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const units = [
    ['yıl', 365 * 24 * 3600e3], ['ay', 30 * 24 * 3600e3], ['gün', 24 * 3600e3],
    ['saat', 3600e3], ['dakika', 60e3], ['saniye', 1e3],
  ];
  for (const [label, ms] of units) {
    if (abs >= ms) {
      const n = Math.floor(abs / ms);
      return diff >= 0 ? `${n} ${label} önce` : `${n} ${label} sonra`;
    }
  }
  return 'az önce';
}

/** ClamAV tarama durumu → panelde gösterilecek etiket + rozet tonu. */
export const SCAN_META = {
  clean: { label: 'Temiz', badge: 'success' },
  infected: { label: 'VİRÜS TESPİT EDİLDİ', badge: 'destructive' },
  failed: { label: 'Tarama başarısız', badge: 'warning' },
  skipped: { label: 'Taranmadı (atlandı)', badge: 'warning' },
  pending: { label: 'Tarama bekliyor', badge: 'muted' },
};

/** files.processingStatus → okunabilir etiket. */
export const PROCESSING_LABEL = {
  uploaded: 'Yüklendi',
  quarantined: 'Karantinada',
  clean: 'Temiz',
  rejected: 'Reddedildi',
  parsed: 'Ayrıştırıldı',
  failed: 'Başarısız',
  generating: 'Üretiliyor',
  generated: 'Üretildi',
};

/** Kullanım taramasında bulunan bağlantı türleri. */
export const USAGE_LABEL = {
  library_document: 'Bilgi tabanı dokümanı',
  gallery: 'Galeri',
  support_ticket: 'Destek talebi',
  company_media: 'Firma görseli',
  user_profile_media: 'Kullanıcı profil görseli',
  product_variant: 'Ürün varyantı görseli',
  document_record: 'Doküman kaydı',
  derived_file: 'Bu dosyadan üretilen dosya',
};
