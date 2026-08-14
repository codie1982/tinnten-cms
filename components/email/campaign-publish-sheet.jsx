'use client';

import { Loader2, Megaphone, CalendarClock, Repeat, ShieldCheck } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Kampanya yayın çekmecesi — yayın kararının TEK yeri.
 *
 * Karar iki BAĞIMSIZ eksendir; bunlar ayrı "mod"lar değildir:
 *   1) Kimlere → yüzde. %100 herkes, %5 test yayını. Ayrı bir "test" eylemi yok.
 *   2) Ne zaman → hemen ya da belirli bir saatte (yayılma + tekrar oradan).
 * Böylece "listenin %25'ini yarın 09:00'da" gibi bir yayın ekstra moda gerek
 * duymadan ifade edilebiliyor.
 *
 * Yüzdenin paydası HER ZAMAN kanalın tam kitlesidir — devam yayınında da. Payda
 * sabit olduğu için yüzdeler kapsamaya toplanır (%5 + %10 = %15) ve operatör
 * "listenin ne kadarına ulaştım" sorusunu tek sayıyla izler.
 *
 * Bileşen DURUMU TUTMAZ: değerler ve setter'lar sayfadan gelir (sayfa zaten
 * kaydetme/zamanlama uçlarının sahibi). Buradaki tek iş, kararı tek ekranda
 * toplayıp onaydan önce ne olacağını tek cümleyle söylemek.
 */

const DURATION_PRESETS = [
  { value: '', label: 'Tek seferde (yayılma yok)' },
  { value: '60', label: '1 saate yay' },
  { value: '360', label: '6 saate yay' },
  { value: '720', label: '12 saate yay' },
  { value: '1440', label: '24 saate yay' },
  { value: '4320', label: '3 güne yay' },
];

const PCT_PRESETS = [5, 10, 25, 50, 100];

const RECURRENCE_UNITS = [
  { value: 'hour', label: 'saatte bir', clock: false },
  { value: 'day', label: 'günde bir', clock: true },
  { value: 'week', label: 'haftada bir', clock: true },
  { value: 'month', label: 'ayda bir', clock: true },
];

const WEEKDAYS = [
  { value: 1, short: 'Pzt', long: 'Pazartesi' },
  { value: 2, short: 'Sal', long: 'Salı' },
  { value: 3, short: 'Çar', long: 'Çarşamba' },
  { value: 4, short: 'Per', long: 'Perşembe' },
  { value: 5, short: 'Cum', long: 'Cuma' },
  { value: 6, short: 'Cmt', long: 'Cumartesi' },
  { value: 7, short: 'Paz', long: 'Pazar' },
];

const LAST_DAY = -1;
const MONTH_DAYS = [
  ...Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: `Ayın ${i + 1}. günü` })),
  { value: LAST_DAY, label: 'Ayın son günü' },
];

const END_MODES = [
  { value: 'never', label: 'Süresiz (durdurana kadar)' },
  { value: 'date', label: 'Belirli bir tarihte bitir' },
  { value: 'count', label: 'Belirli sayıda koşudan sonra bitir' },
];

const nf = new Intl.NumberFormat('tr-TR');
const fmt = (v) => nf.format(Number(v) || 0);

/**
 * Türkçe ek uyumu: %5’i, %10’u, %50’si, %100’ü. Ek, sayının okunuşundaki son
 * sözcüğün son ünlüsüne bağlıdır — sabit "’i" yazmak "%10’i" gibi hata üretir.
 */
const SUF = {
  1: 'i', 2: 'si', 3: 'ü', 4: 'ü', 5: 'i', 6: 'sı', 7: 'si', 8: 'i', 9: 'u',
  10: 'u', 20: 'si', 30: 'u', 40: 'ı', 50: 'si', 60: 'ı', 70: 'i', 80: 'i', 90: 'ı', 100: 'ü',
};
const suf = (n) => SUF[n] || SUF[n % 10] || SUF[n - (n % 100)] || 'i';

const formatDuration = (min) => {
  const m = Number(min) || 0;
  if (!m) return '';
  if (m % 1440 === 0) return `${m / 1440} gün`;
  if (m % 60 === 0) return `${m / 60} saat`;
  return `${m} dk`;
};

const dtf = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
const formatDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : dtf.format(d);
};

const pad2 = (n) => String(n).padStart(2, '0');

const Block = ({ title, aside, children }) => (
  <section className="space-y-2.5">
    <div className="flex items-baseline justify-between gap-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {aside}
    </div>
    {children}
  </section>
);

export function CampaignPublishSheet({
  open,
  onOpenChange,
  campaign,
  status,
  isFinished,
  recipientCount,
  delivery,
  percent,
  setPercent,
  when,
  setWhen,
  form,
  setSC,
  setCB,
  setSched,
  rec,
  setR,
  busy,
  error,
  onSubmit,
}) {
  const isScheduled = status === 'scheduled';
  // Devam yayını HER ZAMAN hemen gider (sunucuda /continue anlık bir uçtur);
  // önceki koşudan kalmış "belirli bir zamanda" seçimi özet cümlesine tarih
  // yazdırıp yalan söylerdi.
  const effWhen = isFinished ? 'now' : when;
  // Zamanlanmışta zamanlama SUNUCUDA kilitli (yalnız taslak zamanlanabilir);
  // burada okunur gösterilir, değiştirmek için önce iptal edilir. Tekrar ise
  // zamanlanmışta da değişir — seriyi durdurmanın tek yolu odur.
  const scheduleLocked = isScheduled;

  const total = Number(delivery?.channelTotal ?? recipientCount) || 0;
  const left = isFinished ? Number(delivery?.remaining) || 0 : total;
  const sent = isFinished ? Number(delivery?.covered) || 0 : 0;

  const pct = Math.min(Math.max(Math.round(Number(percent) || 0), 1), 100);
  // Payda tüm liste; devam yayınında kalandan fazlası istenemez.
  const target = Math.min(Math.ceil((total * pct) / 100), left);
  const capped = isFinished && target >= left && left > 0;
  const coverAfter = total ? Math.round(((sent + target) / total) * 100) : 0;

  const effDuration = Number(form.schedule.durationMinutes) || 0;
  const rate = Number(form.sendConfig.ratePerSec) || 5;
  const etaMin = target ? Math.max(1, Math.ceil(target / rate / 60)) : 0;
  const sender = form.sendConfig.fromAddress?.trim() || 'no-reply@tinten.ai';
  const unitUsesClock = RECURRENCE_UNITS.find((u) => u.value === rec.unit)?.clock !== false;

  // Yayılma penceresi fizibilitesi — sunucu da aynı kontrolü yapar, burada
  // erken uyarı olarak gösterilir (gece yarısı sürpriz olmasın).
  const tooFast = effWhen === 'at' && effDuration > 0 && target > 0
    && target / (effDuration * 60) > rate;
  const minMinutes = tooFast ? Math.max(1, Math.ceil(target / (rate * 60))) : 0;

  const blocked =
    left === 0
      ? (isFinished ? 'Bu kampanyayı almamış kimse kalmadı.' : 'Kanal seçilmedi — gönderilecek alıcı yok.')
      : effWhen === 'at' && rec.enabled && rec.unit === 'week' && !rec.byWeekday?.length
        ? 'Haftalık tekrar için en az bir gün seçin.'
        : tooFast
          ? `Süre çok kısa: ${fmt(target)} alıcı ${rate} mail/sn hızla en az ${formatDuration(minMinutes)} sürer.`
          : null;

  const who = isFinished
    ? (capped
        ? `bu kampanyayı almamış ${fmt(left)} kişinin tamamına`
        : `kalan ${fmt(left)} kişi arasından rastgele ${fmt(target)} kişiye (listenin %${pct}’${suf(pct)})`)
    : (pct >= 100
        ? `listedeki ${fmt(target)} kişinin tamamına`
        : `listeden rastgele ${fmt(target)} kişiye (%${pct})`);

  const recapWhen = effWhen === 'now'
    ? `şimdi. ${rate} mail/sn ile ≈${etaMin} dk`
    : `${formatDateTime(form.schedule.startAt) || 'hemen'}’de, ${effDuration ? `${formatDuration(effDuration)} içine yayılarak` : 'tek seferde'}`;

  const cta = isFinished ? 'Kalanı yayına al' : effWhen === 'at' ? 'Zamanla' : 'Yayına al';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-[460px]">
        <SheetHeader className="border-b border-border px-5 py-4 pe-12">
          <SheetTitle>
            {isScheduled ? 'Zamanlamayı düzenle' : isFinished ? 'Kalanı yayına al' : 'Yayına al'}
          </SheetTitle>
          <SheetDescription className="truncate">
            {campaign?.name || 'Kampanya'} · <span className="font-mono">{form.channelKey || '—'}</span>
            {' · '}{fmt(total)} alıcı
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* EKSEN 1 — kimlere */}
          <Block
            title="Kimlere gidecek"
            aside={
              <span className="text-[11.5px] tabular-nums">
                {isFinished
                  ? `Tüm liste ${fmt(total)} · ${fmt(sent)} gönderildi · ${fmt(left)} kaldı`
                  : `Tüm liste · ${fmt(total)} kişi`}
              </span>
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {PCT_PRESETS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={pct === p ? 'primary' : 'outline'}
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setPercent(String(p))}
                >
                  {p === 100 && isFinished ? 'Kalanların tümü' : `%${p}`}
                </Button>
              ))}
            </div>
            <div className="flex gap-2.5">
              <div className="w-[92px]">
                <label className="mb-1 block text-xs text-muted-foreground" htmlFor="pubPct">Yüzde</label>
                <Input id="pubPct" type="number" min={1} max={100} value={percent}
                  onChange={(e) => setPercent(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">Gidecek kişi</label>
                <Input value={fmt(target)} readOnly className="tabular-nums" />
              </div>
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              {pct >= 100 && !isFinished
                ? '%100 — listedeki herkes.'
                : capped
                  ? `Kalan ${fmt(left)} kişinin tamamına gider; kampanya %100 kapsamaya ulaşır.`
                  : `Listenin %${pct}’${suf(pct)} = ${fmt(target)} kişi; ${isFinished ? `kalan ${fmt(left)} kişi arasından ` : ''}rastgele seçilir. Bu yayından sonra kapsama %${coverAfter} olur.`}
            </p>
          </Block>

          {/* EKSEN 2 — ne zaman. Devam yayını her zaman hemen gider. */}
          {!isFinished && (
            <Block title="Yayın zamanı">
              {scheduleLocked && (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-[11.5px] text-muted-foreground">
                  Zamanlanmış kampanyanın saati değiştirilemez — değiştirmek için
                  <b> İptal et</b> deyip yeniden zamanlayın. Tekrar ayarı burada değişmeye devam eder.
                </p>
              )}
              <div className="space-y-1.5">
                {[
                  { value: 'now', t: 'Hemen', d: 'Onaylar onaylamaz kuyruğa girer' },
                  { value: 'at', t: 'Belirli bir zamanda', d: 'Tarih, saat ve yayılma' },
                ].map((o) => (
                  <label
                    key={o.value}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 ${
                      when === o.value ? 'border-primary bg-primary/5' : 'border-input'
                    } ${scheduleLocked ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <input type="radio" name="pubWhen" value={o.value} checked={when === o.value}
                      disabled={scheduleLocked} onChange={() => setWhen(o.value)} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium">{o.t}</span>
                      <span className="block text-[11.5px] text-muted-foreground">{o.d}</span>
                    </span>
                  </label>
                ))}
              </div>

              {when === 'at' && (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap gap-2.5">
                    <div className="min-w-[190px] flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground" htmlFor="pubStart">Başlangıç</label>
                      <input
                        id="pubStart"
                        type="datetime-local"
                        value={form.schedule.startAt}
                        disabled={scheduleLocked}
                        onChange={(e) => setSched('startAt', e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
                      />
                    </div>
                    <div className="min-w-[170px] flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground" htmlFor="pubSpread">Yayılma süresi</label>
                      <select
                        id="pubSpread"
                        value={DURATION_PRESETS.some((p) => p.value === form.schedule.durationMinutes)
                          ? form.schedule.durationMinutes : 'custom'}
                        disabled={scheduleLocked}
                        onChange={(e) =>
                          setSched('durationMinutes',
                            e.target.value === 'custom'
                              ? (DURATION_PRESETS.some((p) => p.value === form.schedule.durationMinutes)
                                  ? '90' : form.schedule.durationMinutes || '90')
                              : e.target.value)
                        }
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
                      >
                        {DURATION_PRESETS.map((p) => <option key={p.value || 'none'} value={p.value}>{p.label}</option>)}
                        <option value="custom">Özel…</option>
                      </select>
                    </div>
                    {!DURATION_PRESETS.some((p) => p.value === form.schedule.durationMinutes) && (
                      <div className="w-32">
                        <label className="mb-1 block text-xs text-muted-foreground">Özel süre (dk)</label>
                        <Input type="number" min={1} value={form.schedule.durationMinutes}
                          disabled={scheduleLocked} placeholder="örn. 90"
                          onChange={(e) => setSched('durationMinutes', e.target.value)} />
                      </div>
                    )}
                  </div>

                  {/* Tekrar — "belirli bir zamanda"nın alt kırılımı, ayrı kart değil */}
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-input p-2.5">
                    <input type="checkbox" checked={rec.enabled} className="mt-0.5"
                      onChange={(e) => setR('enabled', e.target.checked)} />
                    <span>
                      <span className="block text-sm font-medium"><Repeat className="mr-1 inline size-3.5" />Düzenli tekrarla</span>
                      <span className="block text-[11.5px] text-muted-foreground">Her koşu zincirin sonraki halkasını üretir</span>
                    </span>
                  </label>

                  {rec.enabled && (
                    <div className="space-y-3 rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-end gap-2.5">
                        <div className="w-[74px]">
                          <label className="mb-1 block text-xs text-muted-foreground">Her</label>
                          <Input type="number" min={1} value={rec.every} onChange={(e) => setR('every', e.target.value)} />
                        </div>
                        <div className="min-w-[130px] flex-1">
                          <label className="mb-1 block text-xs text-muted-foreground">Birim</label>
                          <select value={rec.unit} onChange={(e) => setR('unit', e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30">
                            {RECURRENCE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select>
                        </div>
                        {unitUsesClock && (
                          <div className="w-[104px]">
                            <label className="mb-1 block text-xs text-muted-foreground">Saat</label>
                            <input
                              type="time"
                              value={`${pad2(rec.atHour)}:${pad2(rec.atMinute)}`}
                              onChange={(e) => {
                                const [h, m] = e.target.value.split(':');
                                setR('atHour', String(Number(h) || 0));
                                setR('atMinute', String(Number(m) || 0));
                              }}
                              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                            />
                          </div>
                        )}
                      </div>

                      {rec.unit === 'week' && (
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">Haftanın hangi günleri</label>
                          <div className="flex flex-wrap gap-1.5">
                            {WEEKDAYS.map((d) => {
                              const on = rec.byWeekday?.includes(d.value);
                              return (
                                <Button key={d.value} type="button" size="sm" title={d.long}
                                  variant={on ? 'primary' : 'outline'} className="h-7 px-2.5 text-xs"
                                  onClick={() => setR('byWeekday', on
                                    ? rec.byWeekday.filter((v) => v !== d.value)
                                    : [...(rec.byWeekday || []), d.value].sort((a, b) => a - b))}>
                                  {d.short}
                                </Button>
                              );
                            })}
                          </div>
                          {!rec.byWeekday?.length && (
                            <p className="mt-1 text-[11px] text-destructive">En az bir gün seçin.</p>
                          )}
                        </div>
                      )}

                      {rec.unit === 'month' && (
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">Ayın hangi günü</label>
                          <select value={rec.byMonthDay} onChange={(e) => setR('byMonthDay', e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30">
                            {MONTH_DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                          </select>
                        </div>
                      )}

                      <div className="flex flex-wrap items-end gap-2.5">
                        <div className="min-w-[180px] flex-1">
                          <label className="mb-1 block text-xs text-muted-foreground">Bitiş koşulu</label>
                          <select value={rec.endMode} onChange={(e) => setR('endMode', e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30">
                            {END_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        {rec.endMode === 'date' && (
                          <div className="min-w-[190px] flex-1">
                            <label className="mb-1 block text-xs text-muted-foreground">Son tarih</label>
                            <input type="datetime-local" value={rec.endsAt} onChange={(e) => setR('endsAt', e.target.value)}
                              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
                          </div>
                        )}
                        {rec.endMode === 'count' && (
                          <div className="w-36">
                            <label className="mb-1 block text-xs text-muted-foreground">Toplam koşu</label>
                            <Input type="number" min={1} value={rec.maxOccurrences} placeholder="örn. 30"
                              onChange={(e) => setR('maxOccurrences', e.target.value)} />
                          </div>
                        )}
                      </div>

                      <div className="w-full">
                        <label className="mb-1 block text-xs text-muted-foreground">Zaman dilimi</label>
                        <Input value={rec.timezone} onChange={(e) => setR('timezone', e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Block>
          )}

          {isFinished && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-[11.5px] text-muted-foreground">
              Devam yayını her zaman hemen gider. Daha önce mail gitmiş kişiler bu partiye <b>girmez</b>.
            </p>
          )}

          {/* Gelişmiş — yayını etkiler ama her yayında dokunulmaz */}
          <details className="rounded-lg border border-border">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-xs">
              <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Gelişmiş gönderim ayarları</span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {rate}/sn · {form.sendConfig.maxRecipients ? `limit ${form.sendConfig.maxRecipients}` : 'limit yok'} · {sender}
              </span>
            </summary>
            <div className="space-y-3 border-t border-border p-3">
              <div className="flex flex-wrap gap-2.5">
                <div className="min-w-[120px] flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Hız (mail/sn)</label>
                  <Input type="number" min={1} value={form.sendConfig.ratePerSec}
                    onChange={(e) => setSC('ratePerSec', e.target.value)} />
                </div>
                <div className="min-w-[130px] flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Alıcı limiti</label>
                  <Input type="number" min={0} placeholder="sınırsız" value={form.sendConfig.maxRecipients}
                    onChange={(e) => setSC('maxRecipients', e.target.value)} />
                </div>
                <div className="min-w-[120px] flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Batch boyutu</label>
                  <Input type="number" min={1} value={form.sendConfig.batchSize}
                    onChange={(e) => setSC('batchSize', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Gönderen (boş = varsayılan; yalnız doğrulanmış alan adı)
                </label>
                <Input value={form.sendConfig.fromAddress} placeholder='örn. "Tinnten Basın" <press@tinten.ai>'
                  onChange={(e) => setSC('fromAddress', e.target.value)} />
              </div>
              <div className="w-52">
                <label className="mb-1 block text-xs text-muted-foreground">Aynı adrese günlük sınır (0=sınırsız)</label>
                <Input type="number" min={0} value={form.sendConfig.maxPerRecipientPerDay}
                  onChange={(e) => setSC('maxPerRecipientPerDay', e.target.value)} />
              </div>
              <div className="rounded-lg border border-border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.sendConfig.circuitBreaker.enabled}
                    onChange={(e) => setCB('enabled', e.target.checked)} />
                  Otomatik fren (oran eşiği aşılırsa durdur)
                </label>
                <div className="mt-2.5 flex flex-wrap gap-2.5">
                  <div className="min-w-[110px] flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">Bounce eşiği %</label>
                    <Input type="number" step="0.1" value={form.sendConfig.circuitBreaker.bounceRatePct}
                      disabled={!form.sendConfig.circuitBreaker.enabled}
                      onChange={(e) => setCB('bounceRatePct', e.target.value)} />
                  </div>
                  <div className="min-w-[110px] flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">Şikayet eşiği %</label>
                    <Input type="number" step="0.01" value={form.sendConfig.circuitBreaker.complaintRatePct}
                      disabled={!form.sendConfig.circuitBreaker.enabled}
                      onChange={(e) => setCB('complaintRatePct', e.target.value)} />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Kötü adresler otomatik elenir ve tek-tık abonelikten çıkış her maile eklenir — bunlar her zaman açıktır.
              </p>
            </div>
          </details>
        </SheetBody>

        {/* SheetFooter varsayılanı sm:flex-row + space-x — çekmecede dikey
            yığın istiyoruz, breakpoint varyantını da açıkça geri alıyoruz. */}
        <SheetFooter className="flex-col gap-2.5 border-t border-border px-5 py-4 sm:flex-col sm:justify-start sm:space-x-0">
          {/* Onaydan ÖNCE tek cümle: bugün bu bilgi dört karta dağılmış durumda */}
          <div className={`w-full rounded-md px-3 py-2.5 text-xs leading-relaxed ${
            blocked ? 'border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-muted'
          }`}>
            {blocked ? <><b>Yayınlanamaz.</b> {blocked}</> : <>{who}, <b>{recapWhen}</b>. Gönderen: {sender}.</>}
          </div>
          {error && <p className="w-full text-xs text-destructive">{error}</p>}
          <div className="flex w-full gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Vazgeç</Button>
            <Button className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={onSubmit} disabled={busy || Boolean(blocked)}>
              {busy ? <Loader2 className="size-4 animate-spin" />
                : effWhen === 'at' ? <CalendarClock className="size-4" />
                : <Megaphone className="size-4" />}
              {cta}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default CampaignPublishSheet;
