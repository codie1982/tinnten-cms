'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Embedding servisi CMS ekranının bölümleri arasında paylaşılan sabitler,
 * biçimlendiriciler ve küçük sunum bileşenleri.
 */

export const PAGE_SIZE = 25;

export const STATE_META = {
  indexed: { label: 'İndekslendi', variant: 'success' },
  indexing: { label: 'İndeksleniyor', variant: 'warning' },
  queued: { label: 'Kuyrukta', variant: 'warning' },
  not_indexed: { label: 'İndekssiz', variant: 'muted' },
  error: { label: 'Hata', variant: 'destructive' },
};

export const SOURCE_LABEL = {
  upload: 'Yükleme',
  import_url: 'URL',
  integration: 'Entegrasyon',
};

export const stateMeta = (state) => STATE_META[state] || { label: state || '—', variant: 'muted' };

/* ── biçimlendiriciler ── */

export function formatTr(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Sayıyı tr-TR binlik ayraçla döndürür; null/undefined → '—'. */
export function nfmt(value) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('tr-TR') : '—';
}

/** Byte → okunabilir boyut. 0 gerçek bir değerdir, '—' değildir. */
export function bytesTr(value) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const v = n / 1024 ** i;
  return `${v.toLocaleString('tr-TR', { maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 })} ${units[i]}`;
}

/** ObjectId'yi listede okunabilir kılmak için kısaltır. */
export function shortId(id) {
  const s = String(id ?? '');
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s || '—';
}

/* ── sunum bileşenleri ── */

export function DistRow({ label, count, total, variant }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2"><Badge variant={variant || 'muted'}>{label}</Badge></span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{nfmt(count)} · {pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function StatCard({ label, value, tone, hint, loading }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2sm text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{loading ? '…' : value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function ShortId({ value, className }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('font-mono text-xs text-muted-foreground', className)} title={String(value)}>
      {shortId(value)}
    </span>
  );
}
