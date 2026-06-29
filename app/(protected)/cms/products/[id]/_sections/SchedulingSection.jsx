'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Edit3, Loader2, Save } from 'lucide-react';
import {
  useUpdateCmsProductReservationConfigMutation,
  useUpdateCmsProductTimeRestrictionMutation,
} from '@/redux/services';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  rangeModeOptions,
  reservationPricingUnitOptions,
  weekDayOptions,
} from '../../_data';

function mutationMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.normalizedMessage ||
    error?.message ||
    fallback
  );
}

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function buildTimeForm(product) {
  const tr = product?.timeRestriction || {};
  const firstRange = Array.isArray(tr.dateRanges) ? tr.dateRanges[0] : null;
  return {
    enabled: tr.enabled === true,
    unlimitedDates: tr.unlimitedDates === true,
    allDay: tr.allDay === true,
    dailyStartTime: tr.dailyStartTime || '',
    dailyEndTime: tr.dailyEndTime || '',
    slotDurationMinutes:
      tr.slotDurationMinutes != null ? String(tr.slotDurationMinutes) : '',
    timeZone: tr.timeZone || 'Europe/Istanbul',
    note: tr.note || '',
    days: Array.isArray(tr.days) ? tr.days : [],
    rangeMode: firstRange?.type || 'manual',
    rangeStart: toDateInput(firstRange?.startDate),
    rangeEnd: toDateInput(firstRange?.endDate),
  };
}

function buildReservationForm(product) {
  const rc = product?.reservationConfig || {};
  return {
    enabled: rc.enabled === true,
    unlimitedDates: rc.unlimitedDates === true,
    pricingUnit: rc.pricingUnit || 'per_day',
    minDuration: rc.minDuration != null ? String(rc.minDuration) : '',
    maxDuration: rc.maxDuration != null ? String(rc.maxDuration) : '',
    capacity: rc.capacity != null ? String(rc.capacity) : '',
    rangeStart: toDateInput(rc.availableRange?.startDate),
    rangeEnd: toDateInput(rc.availableRange?.endDate),
    note: rc.note || '',
  };
}

function optInt(value, min = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= min ? n : null;
}

export default function SchedulingSection({ product, onNotice }) {
  const id = product?._id || product?.id;
  const [timeOpen, setTimeOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const [timeForm, setTimeForm] = useState(() => buildTimeForm(product));
  const [resForm, setResForm] = useState(() => buildReservationForm(product));

  const [updateTime, { isLoading: savingTime }] =
    useUpdateCmsProductTimeRestrictionMutation();
  const [updateRes, { isLoading: savingRes }] =
    useUpdateCmsProductReservationConfigMutation();

  useEffect(() => {
    if (product) {
      setTimeForm(buildTimeForm(product));
      setResForm(buildReservationForm(product));
    }
  }, [product]);

  const setT = (field, value) =>
    setTimeForm((cur) => ({ ...cur, [field]: value }));
  const setR = (field, value) =>
    setResForm((cur) => ({ ...cur, [field]: value }));

  const toggleDay = (day) =>
    setTimeForm((cur) => ({
      ...cur,
      days: cur.days.includes(day)
        ? cur.days.filter((d) => d !== day)
        : [...cur.days, day],
    }));

  const tr = product?.timeRestriction || {};
  const rc = product?.reservationConfig || {};

  const handleTimeSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      enabled: timeForm.enabled,
      unlimitedDates: timeForm.unlimitedDates,
      allDay: timeForm.allDay,
      timeZone: timeForm.timeZone.trim() || 'Europe/Istanbul',
    };
    if (timeForm.dailyStartTime) payload.dailyStartTime = timeForm.dailyStartTime;
    if (timeForm.dailyEndTime) payload.dailyEndTime = timeForm.dailyEndTime;
    const slot = optInt(timeForm.slotDurationMinutes, 1);
    if (slot != null) payload.slotDurationMinutes = slot;
    if (timeForm.note.trim()) payload.note = timeForm.note.trim();
    if (timeForm.days.length) payload.days = timeForm.days;
    if (timeForm.enabled && !timeForm.unlimitedDates) {
      if (timeForm.rangeMode === 'manual') {
        if (timeForm.rangeStart && timeForm.rangeEnd) {
          payload.dateRanges = [
            {
              type: 'manual',
              startDate: timeForm.rangeStart,
              endDate: timeForm.rangeEnd,
            },
          ];
        }
      } else {
        payload.dateRanges = [{ type: timeForm.rangeMode }];
      }
    }

    try {
      await updateTime({ id, timeRestriction: payload }).unwrap();
      setTimeOpen(false);
      onNotice?.({
        variant: 'info',
        title: 'Zaman kısıtı güncellendi',
        description: 'Değişiklikler kaydedildi.',
      });
    } catch (err) {
      onNotice?.({
        variant: 'destructive',
        title: 'Güncelleme başarısız',
        description: mutationMessage(err, 'Zaman kısıtı güncellenemedi.'),
      });
    }
  };

  const handleResSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      enabled: resForm.enabled,
      unlimitedDates: resForm.unlimitedDates,
      pricingUnit: resForm.pricingUnit,
    };
    const min = optInt(resForm.minDuration);
    const max = optInt(resForm.maxDuration);
    const cap = optInt(resForm.capacity);
    if (min != null) payload.minDuration = min;
    if (max != null) payload.maxDuration = max;
    if (cap != null) payload.capacity = cap;
    if (resForm.note.trim()) payload.note = resForm.note.trim();
    if (resForm.enabled && !resForm.unlimitedDates) {
      const range = {};
      if (resForm.rangeStart) range.startDate = resForm.rangeStart;
      if (resForm.rangeEnd) range.endDate = resForm.rangeEnd;
      if (Object.keys(range).length) payload.availableRange = range;
    }

    try {
      await updateRes({ id, reservationConfig: payload }).unwrap();
      setResOpen(false);
      onNotice?.({
        variant: 'info',
        title: 'Rezervasyon ayarları güncellendi',
        description: 'Değişiklikler kaydedildi.',
      });
    } catch (err) {
      onNotice?.({
        variant: 'destructive',
        title: 'Güncelleme başarısız',
        description: mutationMessage(err, 'Rezervasyon ayarları güncellenemedi.'),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zamanlama & Rezervasyon</CardTitle>
        <CardToolbar>
          <Badge variant={tr.enabled ? 'success' : 'muted'}>
            Zaman {tr.enabled ? 'açık' : 'kapalı'}
          </Badge>
          <Badge variant={rc.enabled ? 'success' : 'muted'}>
            Rezervasyon {rc.enabled ? 'açık' : 'kapalı'}
          </Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Randevu Saatleri</p>
              <p className="text-xs text-muted-foreground">
                {tr.enabled
                  ? tr.allDay
                    ? 'Tüm gün'
                    : [tr.dailyStartTime, tr.dailyEndTime]
                        .filter(Boolean)
                        .join(' – ') || 'Tanımsız'
                  : 'Devre dışı'}
                {Array.isArray(tr.days) && tr.days.length > 0
                  ? ` · ${tr.days.length} gün`
                  : ''}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setTimeOpen(true)}>
            <Edit3 className="size-4" />
            Zaman kısıtını düzenle
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Rezervasyon</p>
              <p className="text-xs text-muted-foreground">
                {rc.enabled
                  ? `${
                      reservationPricingUnitOptions.find(
                        (o) => o.value === rc.pricingUnit,
                      )?.label || rc.pricingUnit
                    }${rc.capacity != null ? ` · kapasite ${rc.capacity}` : ''}`
                  : 'Devre dışı'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setResOpen(true)}>
            <Edit3 className="size-4" />
            Rezervasyonu düzenle
          </Button>
        </div>
      </CardContent>

      {/* Zaman kısıtı dialog */}
      <Dialog
        open={timeOpen}
        onOpenChange={(next) => {
          if (!savingTime) setTimeOpen(next);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <form onSubmit={handleTimeSubmit} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Zaman Kısıtı (Randevu)</DialogTitle>
            </DialogHeader>
            <DialogBody className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={timeForm.enabled}
                    onChange={(e) => setT('enabled', e.target.checked)}
                    className="size-4"
                  />
                  Etkin
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={timeForm.allDay}
                    onChange={(e) => setT('allDay', e.target.checked)}
                    className="size-4"
                  />
                  Tüm gün
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={timeForm.unlimitedDates}
                    onChange={(e) => setT('unlimitedDates', e.target.checked)}
                    className="size-4"
                  />
                  Tarih limiti yok
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Günlük Başlangıç
                  </span>
                  <Input
                    type="time"
                    value={timeForm.dailyStartTime}
                    onChange={(e) => setT('dailyStartTime', e.target.value)}
                    disabled={timeForm.allDay}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Günlük Bitiş
                  </span>
                  <Input
                    type="time"
                    value={timeForm.dailyEndTime}
                    onChange={(e) => setT('dailyEndTime', e.target.value)}
                    disabled={timeForm.allDay}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Slot Süresi (dk)
                  </span>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={timeForm.slotDurationMinutes}
                    onChange={(e) =>
                      setT('slotDurationMinutes', e.target.value)
                    }
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Saat Dilimi
                  </span>
                  <Input
                    value={timeForm.timeZone}
                    onChange={(e) => setT('timeZone', e.target.value)}
                  />
                </label>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Günler
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {weekDayOptions.map((d) => {
                    const active = timeForm.days.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!timeForm.unlimitedDates && (
                <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Tarih Aralığı Tipi
                    </span>
                    <Select
                      value={timeForm.rangeMode}
                      onValueChange={(value) => setT('rangeMode', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tip" />
                      </SelectTrigger>
                      <SelectContent>
                        {rangeModeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  {timeForm.rangeMode === 'manual' && (
                    <>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Başlangıç
                        </span>
                        <Input
                          type="date"
                          value={timeForm.rangeStart}
                          onChange={(e) => setT('rangeStart', e.target.value)}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Bitiş
                        </span>
                        <Input
                          type="date"
                          value={timeForm.rangeEnd}
                          onChange={(e) => setT('rangeEnd', e.target.value)}
                        />
                      </label>
                    </>
                  )}
                </div>
              )}

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Not
                </span>
                <textarea
                  value={timeForm.note}
                  onChange={(e) => setT('note', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                />
              </label>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTimeOpen(false)}
                disabled={savingTime}
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={savingTime}>
                {savingTime ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rezervasyon dialog */}
      <Dialog
        open={resOpen}
        onOpenChange={(next) => {
          if (!savingRes) setResOpen(next);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <form onSubmit={handleResSubmit} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Rezervasyon Ayarları</DialogTitle>
            </DialogHeader>
            <DialogBody className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={resForm.enabled}
                    onChange={(e) => setR('enabled', e.target.checked)}
                    className="size-4"
                  />
                  Etkin
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={resForm.unlimitedDates}
                    onChange={(e) => setR('unlimitedDates', e.target.checked)}
                    className="size-4"
                  />
                  Tarih limiti yok
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Fiyatlandırma Birimi
                  </span>
                  <Select
                    value={resForm.pricingUnit}
                    onValueChange={(value) => setR('pricingUnit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Birim" />
                    </SelectTrigger>
                    <SelectContent>
                      {reservationPricingUnitOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Kapasite
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={resForm.capacity}
                    onChange={(e) => setR('capacity', e.target.value)}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Min. Süre
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={resForm.minDuration}
                    onChange={(e) => setR('minDuration', e.target.value)}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Maks. Süre
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={resForm.maxDuration}
                    onChange={(e) => setR('maxDuration', e.target.value)}
                  />
                </label>
                {!resForm.unlimitedDates && (
                  <>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Müsait Başlangıç
                      </span>
                      <Input
                        type="date"
                        value={resForm.rangeStart}
                        onChange={(e) => setR('rangeStart', e.target.value)}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Müsait Bitiş
                      </span>
                      <Input
                        type="date"
                        value={resForm.rangeEnd}
                        onChange={(e) => setR('rangeEnd', e.target.value)}
                      />
                    </label>
                  </>
                )}
              </div>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Not
                </span>
                <textarea
                  value={resForm.note}
                  onChange={(e) => setR('note', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                />
              </label>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResOpen(false)}
                disabled={savingRes}
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={savingRes}>
                {savingRes ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
