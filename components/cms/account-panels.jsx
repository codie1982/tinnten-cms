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
import {
  buildMetricPatch, canEditUsage, getLimitEditor, getMetricChanges,
  metricErrorMessage, parseMetricValue, seedMetricDraft, usagePercentage,
} from './account-panel-data.mjs';

/* ─── helpers ─── */
export function fmtDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
export function LimitsPanel({ metrics: accountMetrics = [], packages = [], packageName, onSave, saving }) {
  const editor = getLimitEditor(accountMetrics, packages);
  const metrics = editor.metrics;
  const sig = JSON.stringify([editor.packageId, metrics.map((m) => [m.key, m.limit])]);
  const [draft, setDraft] = useState({});
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setDraft(seedMetricDraft(metrics, 'limit'));
    setReviewing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const dirty = getMetricChanges(metrics, draft, 'limit');
  const invalid = dirty.filter((m) => Number.isNaN(parseMetricValue(draft[m.key], m.key, 'limit')));

  const reset = () => {
    setDraft(seedMetricDraft(metrics, 'limit')); setReviewing(false); setNotice(null);
  };

  const save = async () => {
    if (!editor.editable || saving) return;
    try {
      const payload = buildMetricPatch(metrics, draft, 'limit');
      if (!Object.keys(payload).length) return;
      await onSave(payload);
      setNotice({ type: 'success', text: 'Limitler güncellendi.' });
      setReviewing(false);
    } catch (e) {
      setNotice({ type: 'error', text: metricErrorMessage(e, 'Limitler güncellenemedi.') });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Limitler</CardTitle>
        <CardToolbar>
          {editor.packageName || packageName ? <Badge variant="primary">{editor.packageName || packageName}</Badge> : <Badge variant="muted">Paket yok</Badge>}
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
              Boş alan = sınırsız, <span className="font-mono">0</span> = sıfır kota. Yalnızca değiştirilen limitler bu pakete uygulanır.
            </p>
            {!editor.editable && (
              <Alert variant="destructive"><AlertDescription>Düzenlenecek aktif paketin süresi dolmuş veya paket pasif. Hesap &amp; Paketler bölümünden geçerli bir paket atayın.</AlertDescription></Alert>
            )}
            {invalid.length > 0 && (
              <Alert variant="destructive"><AlertDescription>{invalid.map((m) => m.label).join(', ')}: geçerli, negatif olmayan bir değer girin. Adet ve kredi limitleri tam sayı olmalıdır.</AlertDescription></Alert>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {metrics.map((m) => {
                const val = draft[m.key] ?? m.limit ?? '';
                const changed = dirty.some((item) => item.key === m.key);
                return (
                  <div key={m.key} className={cn('rounded-lg border p-3', changed ? 'border-primary/50 bg-primary/5' : 'border-border')}>
                    <label htmlFor={`limit-${m.key}`} className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{m.label}</span>
                      <span className="font-mono">kullanım: {m.used}</span>
                    </label>
                    <input
                      id={`limit-${m.key}`} type="number" min={0} step={m.step} value={val} disabled={saving || !editor.editable}
                      placeholder="Sınırsız" aria-invalid={invalid.some((item) => item.key === m.key)}
                      onChange={(e) => {
                        setNotice(null); setReviewing(false);
                        setDraft((d) => ({ ...d, [m.key]: e.target.value }));
                      }}
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    {m.accountLimit !== m.limit && (
                      <p className="mt-1 text-xs text-muted-foreground">Hesap toplam limiti: {m.accountLimit == null ? '∞' : m.accountLimit} · Diğer aktif paketler de toplama dahildir.</p>
                    )}
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
                      <span className="font-mono font-semibold text-primary">{parseMetricValue(draft[m.key], m.key, 'limit') === null ? '∞' : draft[m.key]}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={save} disabled={saving || invalid.length > 0 || !editor.editable}>
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
                  <Button size="sm" onClick={() => setReviewing(true)} disabled={dirty.length === 0 || invalid.length > 0 || saving || !editor.editable}>
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
  const editableMetrics = metrics.filter((m) => canEditUsage(m.key));
  const sig = metrics.map((m) => `${m.key}:${m.used}`).join('|');
  const [draft, setDraft] = useState({});
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setDraft(seedMetricDraft(editableMetrics, 'used')); setEditing(false); setReviewing(false); setConfirmReset(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const dirty = getMetricChanges(editableMetrics, draft, 'used');
  const invalid = dirty.filter((m) => Number.isNaN(parseMetricValue(draft[m.key], m.key, 'used')));

  const cancelEdit = () => {
    setDraft(seedMetricDraft(editableMetrics, 'used')); setEditing(false); setReviewing(false); setNotice(null);
  };

  const save = async () => {
    if (savingUsage || resetting) return;
    try {
      const payload = buildMetricPatch(editableMetrics, draft, 'used');
      if (!Object.keys(payload).length) return;
      await onSaveUsage(payload);
      setNotice({ type: 'success', text: 'Kullanım güncellendi.' });
      setEditing(false); setReviewing(false);
    } catch (e) {
      setNotice({ type: 'error', text: metricErrorMessage(e, 'Kullanım güncellenemedi.') });
    }
  };

  const doReset = async () => {
    try {
      await onResetUsage();
      setNotice({ type: 'success', text: 'Kullanım sıfırlandı.' });
      setConfirmReset(false);
    } catch (e) {
      setNotice({ type: 'error', text: metricErrorMessage(e, 'Kullanım sıfırlanamadı.') });
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
                  <Button size="sm" variant="outline" onClick={() => { setNotice(null); setEditing(true); }} disabled={resetting || savingUsage || editableMetrics.length === 0}>
                    <SlidersHorizontal className="size-4" />Miktarı Ayarla
                  </Button>
                </div>
              )}
            </div>

            {confirmReset && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="flex items-center gap-1.5 text-sm text-foreground">
                  <AlertTriangle className="size-4 text-destructive" />
                  Sıfırlanabilir kullanım sayaçları ve kredi tüketimi <span className="font-semibold">0</span>'a sıfırlanacak. Canlı asistan, Space ve firma sayıları değişmez. Emin misiniz?
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
                <p className="text-xs text-muted-foreground">Kredi tüketimi maliyetlerden; asistan, Space ve firma kullanımları canlı kayıtlardan hesaplanır ve burada elle değiştirilemez.</p>
                {invalid.length > 0 && (
                  <Alert variant="destructive"><AlertDescription>{invalid.map((m) => m.label).join(', ')}: boş bırakmadan geçerli, negatif olmayan bir değer girin. Adet sayaçları tam sayı olmalıdır.</AlertDescription></Alert>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {metrics.map((m) => {
                    const val = draft[m.key] ?? m.used;
                    const editable = canEditUsage(m.key);
                    const changed = editable && dirty.some((item) => item.key === m.key);
                    return (
                      <div key={m.key} className={cn('rounded-lg border p-3', changed ? 'border-primary/50 bg-primary/5' : 'border-border')}>
                        <label htmlFor={`usage-${m.key}`} className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{m.label}</span>
                          <span className="font-mono">limit: {m.unlimited ? '∞' : m.limit}</span>
                        </label>
                        <input
                          id={`usage-${m.key}`} type="number" min={0} value={val} disabled={savingUsage || !editable}
                          aria-invalid={invalid.some((item) => item.key === m.key)}
                          onChange={(e) => {
                            setNotice(null); setReviewing(false);
                            setDraft((d) => ({ ...d, [m.key]: e.target.value }));
                          }}
                          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                        />
                        {!editable && <p className="mt-1 text-xs text-muted-foreground">Otomatik hesaplanır</p>}
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
                      <Button size="sm" onClick={save} disabled={savingUsage || invalid.length > 0}>
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
                      <Button size="sm" onClick={() => setReviewing(true)} disabled={dirty.length === 0 || invalid.length > 0 || savingUsage}>
                        <SlidersHorizontal className="size-4" />Değişiklikleri Kontrol Et
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                {metrics.map((m, i) => {
                  const pct = usagePercentage(m);
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
