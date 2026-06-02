'use client';

/**
 * Hesap & Paket / Limit / Kullanım panelleri — CMS firma ve kullanıcı
 * detay sayfalarının ORTAK bileşenleri. Tasarım/davranış parity tek kaynaktan.
 *
 * Veri sözleşmesi (backend buildLimitUsage):
 *   metrics: [{ key, label, used, limit, unlimited }]
 */

import { useEffect, useState } from 'react';
import {
  SlidersHorizontal, Save, RotateCcw, Loader2, AlertTriangle, ArrowRight,
  Gauge, Package, Wallet, CalendarDays, Hash,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle, CardToolbar,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';

/* ─── helpers ─── */
export function fmtDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function keyToNested(key, value) {
  const parts = key.split('.');
  const root = {};
  let cur = root;
  parts.forEach((p, i) => {
    if (i === parts.length - 1) cur[p] = value;
    else { cur[p] = {}; cur = cur[p]; }
  });
  return root;
}

function mergeNested(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) target[k] = mergeNested(target[k] || {}, v);
    else target[k] = v;
  }
  return target;
}

const CATEGORY_BADGE = {
  free: 'muted', basic: 'primary', premium: 'secondary', enterprise: 'warning',
};

/* ─── Hesap özeti (overview satırları) ─── */
export function AccountSummary({ accountId, balance, packageCount, createdAt }) {
  const rows = [
    accountId && { icon: Hash, label: 'Hesap ID', value: accountId },
    balance && { icon: Wallet, label: 'Bakiye', value: `${balance.amount ?? 0} ${balance.currency || ''}`.trim() },
    { icon: Package, label: 'Paket Sayısı', value: `${packageCount ?? 0} paket` },
    createdAt && { icon: CalendarDays, label: 'Oluşturulma', value: fmtDate(createdAt) },
  ].filter(Boolean);

  return (
    <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
      {rows.map((r, i) => {
        const Icon = r.icon;
        return (
          <div key={i} className="flex items-center gap-3 py-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p className="break-words text-sm font-medium text-foreground">{r.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Paket tablosu (ortak) ─── */
export function PackagesTable({ packages = [] }) {
  if (packages.length === 0) {
    return (
      <EmptyState icon={<Package className="size-5" />} title="Paket yok" description="Bu hesaba ekli paket bulunmuyor." className="py-10" />
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Paket</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Bitiş</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {packages.map((p, i) => (
            <TableRow key={p.id ?? p.packageId ?? `${p.name}-${i}`}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{p.name || '—'}</span>
                  {p.forCompany && <Badge variant="muted">Firma</Badge>}
                </div>
              </TableCell>
              <TableCell>
                {p.category
                  ? <Badge variant={CATEGORY_BADGE[p.category] ?? 'muted'} className="capitalize">{p.category}</Badge>
                  : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                {p.isActive ? <Badge variant="success">Aktif</Badge> : <Badge variant="muted">Pasif</Badge>}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{p.expiredAt ? fmtDate(p.expiredAt) : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Limitler paneli (düzenlenebilir, kontrol/update) ─── */
export function LimitsPanel({ metrics = [], packageName, onSave, saving }) {
  const sig = metrics.map((m) => `${m.key}:${m.limit}`).join('|');
  const [draft, setDraft] = useState({});
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const seed = {};
    for (const m of metrics) seed[m.key] = m.limit;
    setDraft(seed);
    setReviewing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const dirty = metrics.filter((m) => Number(draft[m.key] ?? m.limit) !== Number(m.limit));

  const reset = () => {
    const seed = {};
    for (const m of metrics) seed[m.key] = m.limit;
    setDraft(seed); setReviewing(false); setNotice(null);
  };

  const save = async () => {
    const payload = {};
    for (const m of metrics) {
      const v = Number(draft[m.key]);
      if (Number.isFinite(v) && v >= 0) mergeNested(payload, keyToNested(m.key, v));
    }
    try {
      await onSave(payload);
      setNotice({ type: 'success', text: 'Limitler güncellendi.' });
      setReviewing(false);
    } catch (e) {
      setNotice({ type: 'error', text: e?.data?.message || 'Limitler güncellenemedi.' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Limitler</CardTitle>
        <CardToolbar>
          {packageName ? <Badge variant="primary">{packageName}</Badge> : <Badge variant="muted">Paket yok</Badge>}
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {metrics.length === 0 ? (
          <EmptyState icon={<SlidersHorizontal className="size-5" />} title="Limit yok" description="Bu hesaba bağlı paket/limit yok." className="py-10" />
        ) : (
          <>
            {notice && (
              <Alert variant={notice.type === 'error' ? 'destructive' : 'info'}>
                <AlertDescription>{notice.text}</AlertDescription>
              </Alert>
            )}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5" />
              Değer <span className="font-mono">0</span> = sınırsız. Değişiklikler aktif pakete özel uygulanır.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {metrics.map((m) => {
                const val = draft[m.key] ?? m.limit;
                const changed = Number(val) !== Number(m.limit);
                return (
                  <div key={m.key} className={cn('rounded-lg border p-3', changed ? 'border-primary/50 bg-primary/5' : 'border-border')}>
                    <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{m.label}</span>
                      <span className="font-mono">kullanım: {m.used}</span>
                    </label>
                    <input
                      type="number" min={0} value={val} disabled={saving}
                      onChange={(e) => {
                        setNotice(null); setReviewing(false);
                        setDraft((d) => ({ ...d, [m.key]: e.target.value === '' ? '' : Number(e.target.value) }));
                      }}
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                );
              })}
            </div>

            {reviewing && dirty.length > 0 && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
                <p className="mb-2 text-sm font-semibold text-foreground">Değişiklikleri Onayla</p>
                <ul className="space-y-1.5">
                  {dirty.map((m) => (
                    <li key={m.key} className="flex items-center gap-2 text-sm">
                      <span className="min-w-[140px] text-muted-foreground">{m.label}</span>
                      <span className="font-mono text-muted-foreground">{m.unlimited ? '∞' : m.limit}</span>
                      <ArrowRight className="size-3.5 text-primary" />
                      <span className="font-mono font-semibold text-primary">{Number(draft[m.key]) === 0 ? '∞' : Number(draft[m.key])}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Güncelle
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReviewing(false)} disabled={saving}>Vazgeç</Button>
                </div>
              </div>
            )}

            {!reviewing && (
              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">
                  {dirty.length > 0 ? `${dirty.length} değişiklik bekliyor` : 'Değişiklik yok'}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={reset} disabled={dirty.length === 0 || saving}>
                    <RotateCcw className="size-4" />Sıfırla
                  </Button>
                  <Button size="sm" onClick={() => setReviewing(true)} disabled={dirty.length === 0 || saving}>
                    <SlidersHorizontal className="size-4" />Değişiklikleri Kontrol Et
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Kullanım paneli (progress + sıfırla + miktar ayarla) ─── */
export function UsagePanel({ metrics = [], packageName, onSaveUsage, onResetUsage, savingUsage, resetting }) {
  const sig = metrics.map((m) => `${m.key}:${m.used}`).join('|');
  const [draft, setDraft] = useState({});
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const seed = {};
    for (const m of metrics) seed[m.key] = m.used;
    setDraft(seed); setEditing(false); setReviewing(false); setConfirmReset(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const dirty = metrics.filter((m) => Number(draft[m.key] ?? m.used) !== Number(m.used));

  const cancelEdit = () => {
    const seed = {};
    for (const m of metrics) seed[m.key] = m.used;
    setDraft(seed); setEditing(false); setReviewing(false); setNotice(null);
  };

  const save = async () => {
    const payload = {};
    for (const m of metrics) {
      const v = Number(draft[m.key]);
      if (Number.isFinite(v) && v >= 0) mergeNested(payload, keyToNested(m.key, v));
    }
    try {
      await onSaveUsage(payload);
      setNotice({ type: 'success', text: 'Kullanım güncellendi.' });
      setEditing(false); setReviewing(false);
    } catch (e) {
      setNotice({ type: 'error', text: e?.data?.message || 'Kullanım güncellenemedi.' });
    }
  };

  const doReset = async () => {
    try {
      await onResetUsage();
      setNotice({ type: 'success', text: 'Kullanım sıfırlandı.' });
      setConfirmReset(false);
    } catch (e) {
      setNotice({ type: 'error', text: e?.data?.message || 'Kullanım sıfırlanamadı.' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kullanım</CardTitle>
        <CardToolbar>
          {packageName ? <Badge variant="primary">{packageName}</Badge> : <Badge variant="muted">Paket yok</Badge>}
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {metrics.length === 0 ? (
          <EmptyState icon={<Gauge className="size-5" />} title="Kullanım yok" description="Bu hesaba bağlı kullanım verisi yok." className="py-10" />
        ) : (
          <>
            {notice && (
              <Alert variant={notice.type === 'error' ? 'destructive' : 'info'}>
                <AlertDescription>{notice.text}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {editing ? 'Kullanım miktarlarını düzenliyorsunuz' : 'Mevcut kullanım / limit oranları'}
              </span>
              {!editing && !confirmReset && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setNotice(null); setConfirmReset(true); }} disabled={resetting || savingUsage}>
                    <RotateCcw className="size-4" />Kullanımı Sıfırla
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setNotice(null); setEditing(true); }} disabled={resetting || savingUsage}>
                    <SlidersHorizontal className="size-4" />Miktarı Ayarla
                  </Button>
                </div>
              )}
            </div>

            {confirmReset && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="flex items-center gap-1.5 text-sm text-foreground">
                  <AlertTriangle className="size-4 text-destructive" />
                  Tüm kullanım sayaçları <span className="font-semibold">0</span>'a sıfırlanacak. Emin misiniz?
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={doReset} disabled={resetting}>
                    {resetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Evet, Sıfırla
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)} disabled={resetting}>Vazgeç</Button>
                </div>
              </div>
            )}

            {editing ? (
              <>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="size-3.5" />
                  Kullanım sayaçlarını manuel ayarlıyorsunuz. Bu, kota davranışını etkiler.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {metrics.map((m) => {
                    const val = draft[m.key] ?? m.used;
                    const changed = Number(val) !== Number(m.used);
                    return (
                      <div key={m.key} className={cn('rounded-lg border p-3', changed ? 'border-primary/50 bg-primary/5' : 'border-border')}>
                        <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{m.label}</span>
                          <span className="font-mono">limit: {m.unlimited ? '∞' : m.limit}</span>
                        </label>
                        <input
                          type="number" min={0} value={val} disabled={savingUsage}
                          onChange={(e) => {
                            setNotice(null); setReviewing(false);
                            setDraft((d) => ({ ...d, [m.key]: e.target.value === '' ? '' : Number(e.target.value) }));
                          }}
                          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                        />
                      </div>
                    );
                  })}
                </div>

                {reviewing && dirty.length > 0 && (
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
                    <p className="mb-2 text-sm font-semibold text-foreground">Değişiklikleri Onayla</p>
                    <ul className="space-y-1.5">
                      {dirty.map((m) => (
                        <li key={m.key} className="flex items-center gap-2 text-sm">
                          <span className="min-w-[140px] text-muted-foreground">{m.label}</span>
                          <span className="font-mono text-muted-foreground">{m.used}</span>
                          <ArrowRight className="size-3.5 text-primary" />
                          <span className="font-mono font-semibold text-primary">{Number(draft[m.key])}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={save} disabled={savingUsage}>
                        {savingUsage ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Güncelle
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setReviewing(false)} disabled={savingUsage}>Vazgeç</Button>
                    </div>
                  </div>
                )}

                {!reviewing && (
                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <span className="text-xs text-muted-foreground">
                      {dirty.length > 0 ? `${dirty.length} değişiklik bekliyor` : 'Değişiklik yok'}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={savingUsage}>İptal</Button>
                      <Button size="sm" onClick={() => setReviewing(true)} disabled={dirty.length === 0 || savingUsage}>
                        <SlidersHorizontal className="size-4" />Değişiklikleri Kontrol Et
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                {metrics.map((m, i) => {
                  const pct = m.unlimited || m.limit === 0 ? 0 : Math.min(Math.round((m.used / m.limit) * 100), 100);
                  const over = !m.unlimited && m.used > m.limit;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{m.label}</span>
                        <span className={cn('font-mono text-xs', over ? 'text-destructive' : 'text-muted-foreground')}>
                          {m.used}{' / '}{m.unlimited ? '∞' : m.limit}{!m.unlimited && ` · %${pct}`}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        {m.unlimited ? (
                          <div className="h-full w-full bg-gradient-to-r from-primary/30 to-primary/10" />
                        ) : (
                          <div className={cn('h-full rounded-full transition-all', over ? 'bg-destructive' : pct >= 80 ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${Math.max(pct, 2)}%` }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
