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
