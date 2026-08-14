'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Save, Loader2, ArrowLeft, Plus, Trash2, ShieldCheck, Megaphone, RefreshCw, BarChart3, CalendarClock, Eye, Pause, Play, XCircle, Repeat, FlaskConical, Send } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetMailCampaignQuery,
  useCreateMailCampaignMutation,
  useUpdateMailCampaignMutation,
  useDeleteMailCampaignMutation,
  useSendMailCampaignMutation,
  useContinueMailCampaignMutation,
  useScheduleMailCampaignMutation,
  useUnscheduleMailCampaignMutation,
  usePauseMailCampaignMutation,
  useResumeMailCampaignMutation,
  useGetMailChannelsQuery,
  useGetMailTemplatesQuery,
  useGetRecipientCountQuery,
  useGetMailCampaignStatsQuery,
  useSetMailCampaignRecurrenceMutation,
  useGetMailCampaignSeriesQuery,
  useGetCronListsQuery,
} from '@/redux/services';
import { MailPreviewPanel } from '@/components/email/mail-preview-panel';

const DEFAULT_SEND = {
  ratePerSec: 5,
  batchSize: 500,
  maxRecipients: '',
  // buildPayload bu iki alanı taşımazsa sanitizeSendConfig sıfırdan kurduğu
  // sendConfig'te fromAddress null'a, günlük sınır 1'e düşer — her CMS kaydı
  // kampanyanın özel gönderenini silerdi.
  fromAddress: '',
  maxPerRecipientPerDay: 1,
  circuitBreaker: { enabled: true, bounceRatePct: 3, complaintRatePct: 0.08 },
};

const DEFAULT_SCHEDULE = { startAt: '', durationMinutes: '' };

// Kanal (alıcı listesi) seçicisinin grupları — mail_channels.type ile eşleşir.
const CHANNEL_TYPE_GROUPS = [
  { type: 'general', label: 'Genel Liste', types: ['general'] },
  { type: 'news_content', label: 'Haber Listeleri', types: ['news_content'] },
  { type: 'cron', label: 'Cron Listeleri', types: ['cron'] },
  { type: 'custom', label: 'Özel Listeler', types: ['custom', 'private'] },
];

// Tekrar aralığı birimleri. "hour" duvar saatine hizalanmaz (24 saatte bir =
// sabit aralık); diğerleri takvimde ilerleyip yerel saati korur.
const RECURRENCE_UNITS = [
  { value: 'hour', label: 'saatte bir', clock: false },
  { value: 'day', label: 'günde bir', clock: true },
  { value: 'week', label: 'haftada bir', clock: true },
  { value: 'month', label: 'ayda bir', clock: true },
];

const END_MODES = [
  { value: 'never', label: 'Süresiz (durdurana kadar)' },
  { value: 'date', label: 'Belirli bir tarihte bitir' },
  { value: 'count', label: 'Belirli sayıda koşudan sonra bitir' },
];

// ISO hafta günleri (1=Pzt … 7=Paz) — backend byWeekday ile birebir aynı numaralar.
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

const DEFAULT_RECURRENCE = {
  enabled: false,
  every: '1',
  unit: 'day',
  atHour: '10',
  atMinute: '0',
  timezone: 'Europe/Istanbul',
  byWeekday: [], // unit: week
  byMonthDay: '1', // unit: month
  endMode: 'never',
  endsAt: '',
  maxOccurrences: '',
};

const pad2 = (n) => String(n).padStart(2, '0');

/** "her hafta Pazartesi 09:00" / "her ayın son günü 10:00" gibi okunur özet. */
const describeRecurrence = (r) => {
  const n = Number(r.every) || 1;
  const clock = `saat ${pad2(r.atHour)}:${pad2(r.atMinute)}`;

  if (r.unit === 'hour') return `her ${n} saatte bir`;
  if (r.unit === 'day') return `${n === 1 ? 'her gün' : `${n} günde bir`}, ${clock}`;

  if (r.unit === 'week') {
    const names = WEEKDAYS.filter((d) => r.byWeekday?.includes(d.value)).map((d) => d.long);
    const when = names.length ? names.join(', ') : 'gün seçilmedi';
    return `${n === 1 ? 'her hafta' : `${n} haftada bir`} ${when}, ${clock}`;
  }

  const d = Number(r.byMonthDay);
  const dayLabel = d === LAST_DAY ? 'ayın son günü' : `ayın ${d}. günü`;
  return `${n === 1 ? 'her ay' : `${n} ayda bir`} ${dayLabel}, ${clock}`;
};

// Yayılma süresi hazır seçenekleri (dakika). '' = tek seferde (drip yok).
const DURATION_PRESETS = [
  { value: '', label: 'Tek seferde (yayılma yok)' },
  { value: '60', label: '1 saate yay' },
  { value: '360', label: '6 saate yay' },
  { value: '720', label: '12 saate yay' },
  { value: '1440', label: '24 saate yay' },
  { value: '4320', label: '3 güne yay' },
];

const STATUS_META = {
  draft: { label: 'Taslak', variant: 'secondary' },
  scheduled: { label: 'Zamanlandı', variant: 'primary' },
  queued: { label: 'Kuyrukta', variant: 'primary' },
  sending: { label: 'Gönderiliyor', variant: 'primary' },
  sent: { label: 'Gönderildi', variant: 'success' },
  partial: { label: 'Kısmi', variant: 'warning' },
  failed: { label: 'Başarısız', variant: 'destructive' },
  paused: { label: 'Duraklatıldı', variant: 'warning' },
};

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const numberFormatter = new Intl.NumberFormat('tr-TR');
const formatCount = (value) => numberFormatter.format(Number(value) || 0);
const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFormatter.format(d);
};

/** ISO/Date → <input type="datetime-local"> değeri (yerel saat). */
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const formatDuration = (min) => {
  const m = Number(min) || 0;
  if (!m) return '';
  if (m % 1440 === 0) return `${m / 1440} gün`;
  if (m % 60 === 0) return `${m / 60} saat`;
  return `${m} dk`;
};

export default function CampaignEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const isNew = id === 'new';
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const {
    data: campaign,
    isLoading,
    isFetching: campaignFetching,
    refetch: refetchCampaign,
  } = useGetMailCampaignQuery(id, {
    skip: !authorized || isNew,
    // Zamanlanmış kampanyanın "sending"e geçişini operatör görebilsin.
    pollingInterval: 30000,
    skipPollingIfUnfocused: true,
  });
  const { data: channels = [] } = useGetMailChannelsQuery({}, { skip: !authorized });
  const { data: templates = [] } = useGetMailTemplatesQuery({}, { skip: !authorized });

  const [createCampaign, { isLoading: creating }] = useCreateMailCampaignMutation();
  const [updateCampaign, { isLoading: saving }] = useUpdateMailCampaignMutation();
  const [deleteCampaign, { isLoading: deleting }] = useDeleteMailCampaignMutation();
  const [sendCampaign, { isLoading: sending }] = useSendMailCampaignMutation();
  const [continueCampaign, { isLoading: continuing }] = useContinueMailCampaignMutation();
  const [scheduleCampaign, { isLoading: scheduling }] = useScheduleMailCampaignMutation();
  const [unscheduleCampaign, { isLoading: unscheduling }] = useUnscheduleMailCampaignMutation();
  const [pauseCampaign, { isLoading: pausing }] = usePauseMailCampaignMutation();
  const [resumeCampaign, { isLoading: resuming }] = useResumeMailCampaignMutation();
  const [setRecurrence, { isLoading: savingRecurrence }] = useSetMailCampaignRecurrenceMutation();

  // Tekrarın "cron listesinin son ürettiği liste" modu için reçete seçici.
  const { data: cronLists = [] } = useGetCronListsQuery({}, { skip: !authorized });

  const [form, setForm] = useState({
    name: '',
    channelKey: '',
    templateId: '',
    subjectOverride: '',
    sendConfig: DEFAULT_SEND,
    schedule: DEFAULT_SCHEDULE,
  });
  // Gruplar kitle DEĞİLDİR: kampanya tek bir YAPRAK channelKey'e gider (bkz.
  // mail-channel.model.js parentKey notu) — grup seçilse 0 alıcı çıkardı. Grup =
  // açıkça grup olarak açılmış (metadata.isGroup) veya altında kanal taşıyan.
  // Kampanya zaten böyle bir key'e kayıtlıysa seçim görünür kalsın diye o hariç.
  const groupKeys = new Set(channels.map((c) => c.parentKey).filter(Boolean));
  const audienceChannels = channels.filter(
    (c) => c.key === form?.channelKey || (c.metadata?.isGroup !== true && !groupKeys.has(c.key)),
  );

  // Liste türüne göre grupla — tek düz listede "cron listesi mi özel liste mi"
  // ayırt edilemiyordu. Boş gruplar gösterilmez.
  const groupedAudience = CHANNEL_TYPE_GROUPS.map((g) => ({
    ...g,
    items: audienceChannels.filter((c) => g.types.includes(c.type)),
  })).filter((g) => g.items.length > 0);

  // Seçili kanal bir cron reçetesine ait mi? Tekrarlı yayımda liste AYRICA
  // seçilmez — sunucu bu bağı kanaldan türetir, arayüz sadece bilgi verir.
  const selectedChannel = channels.find((c) => c.key === form?.channelKey) || null;
  const selectedChannelRecipe =
    cronLists.find(
      (r) =>
        r.channelKey === form?.channelKey ||
        String(r._id) === String(selectedChannel?.metadata?.generatedFromCron || ''),
    ) || null;

  const [vars, setVars] = useState([]); // [{key, value}]
  const [rec, setRec] = useState(DEFAULT_RECURRENCE);
  const [notice, setNotice] = useState('');
  // Yayın onayı bekleyen yüzde: null = tüm liste, 1-99 = rastgele örneklem.
  // Boolean bir `confirmSend` yetmiyor — onay metni hangi yayın olduğunu söylemeli.
  const [confirmSend, setConfirmSend] = useState(null);
  const [testPercent, setTestPercent] = useState('5');
  const [continuePercent, setContinuePercent] = useState('100');
  const [confirmContinue, setConfirmContinue] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const status = campaign?.status || 'draft';
  const isDraft = isNew || status === 'draft';
  const isScheduled = status === 'scheduled';
  const isActive = ['queued', 'sending'].includes(status);
  const isPaused = status === 'paused';
  // Kapanmış koşu: kısmi (test) yayından sonra kalan kitleye devam edilebilir.
  const isFinished = ['sent', 'partial', 'failed'].includes(status);
  // Süre seçiliyse drip: stats polling'i gevşet — getStats her çağrıda kampanyanın
  // TÜM maillog'unu tarayan tracking aggregation'ı koşturur; 24 saat × 5 sn ağır.
  const hasDrip = Boolean(campaign?.schedule?.durationMinutes);

  const { data: recipientInfo } = useGetRecipientCountQuery(form.channelKey, {
    skip: !authorized || !form.channelKey,
  });
  const {
    data: statsData,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useGetMailCampaignStatsQuery(id, {
    skip: !authorized || isNew || status === 'draft' || status === 'scheduled',
    pollingInterval: isActive ? (hasDrip ? 30000 : 5000) : 0,
  });
  const stats = statsData?.stats;
  // Kapsama: kanaldaki güncel kitle vs. bu kampanyanın hedeflediği alıcılar.
  // `remaining` sunucuda tahmindir (hedeflenenlerin bir kısmı listeden çıkmış
  // olabilir) — az gösterebilir, fazla değil; gerçek küme gönderimde bulunur.
  const delivery = statsData?.delivery || null;
  const currentAudience = statsData?.campaign?.audience || campaign?.audience || {};
  const progress = {
    total: Number(stats?.total ?? currentAudience.total ?? 0) || 0,
    sent: Number(stats?.sent ?? currentAudience.sentCount ?? 0) || 0,
    failed: Number(stats?.failed ?? currentAudience.failedCount ?? 0) || 0,
    skipped: Number(stats?.skipped ?? 0) || 0,
    pending: Number(stats?.queued ?? currentAudience.queuedCount ?? 0) || 0,
  };
  // skipped tamamlanmış sayılır (sunucu semantiği) — sayılmazsa bastırılmış
  // alıcısı olan kampanya %100'e hiç ulaşmaz.
  progress.percent = progress.total
    ? Math.min(100, Math.round(((progress.sent + progress.failed + progress.skipped) / progress.total) * 100))
    : 0;

  useEffect(() => {
    if (campaign) {
      setForm({
        name: campaign.name || '',
        channelKey: campaign.channelKey || '',
        templateId: campaign.templateId || '',
        subjectOverride: campaign.subjectOverride || '',
        sendConfig: {
          ratePerSec: campaign.sendConfig?.ratePerSec ?? 5,
          batchSize: campaign.sendConfig?.batchSize ?? 500,
          maxRecipients: campaign.sendConfig?.maxRecipients ?? '',
          fromAddress: campaign.sendConfig?.fromAddress ?? '',
          maxPerRecipientPerDay: campaign.sendConfig?.maxPerRecipientPerDay ?? 1,
          circuitBreaker: {
            enabled: campaign.sendConfig?.circuitBreaker?.enabled !== false,
            bounceRatePct: campaign.sendConfig?.circuitBreaker?.bounceRatePct ?? 3,
            complaintRatePct: campaign.sendConfig?.circuitBreaker?.complaintRatePct ?? 0.08,
          },
        },
        schedule: {
          startAt: toLocalInput(campaign.schedule?.startAt),
          durationMinutes: campaign.schedule?.durationMinutes
            ? String(campaign.schedule.durationMinutes)
            : '',
        },
      });
      setVars(Object.entries(campaign.globalVars || {}).map(([key, value]) => ({ key, value: String(value) })));
      const r = campaign.recurrence || {};
      setRec({
        enabled: Boolean(r.enabled),
        every: String(r.every ?? 1),
        unit: r.unit || 'day',
        atHour: String(r.atHour ?? 10),
        atMinute: String(r.atMinute ?? 0),
        timezone: r.timezone || 'Europe/Istanbul',
        byWeekday: Array.isArray(r.byWeekday) ? r.byWeekday : [],
        byMonthDay: String(r.byMonthDay ?? 1),
        endMode: r.endMode || 'never',
        endsAt: toLocalInput(r.endsAt),
        maxOccurrences: r.maxOccurrences ? String(r.maxOccurrences) : '',
      });
    }
  }, [campaign]);

  const setR = (k, v) => setRec((s) => ({ ...s, [k]: v }));
  // "saatte bir" aralık tabanlıdır → sabit bir HH:MM sorulmaz.
  const unitUsesClock = RECURRENCE_UNITS.find((u) => u.value === rec.unit)?.clock !== false;

  /**
   * Tekrar ayarı ayrı bir uçtan yazılır (PATCH .../recurrence): ana kaydet yalnız
   * taslakta çalışırken tekrar, zamanlanmış kampanyada da değiştirilebilmeli —
   * seriyi durdurmanın tek yolu bekleyen son koşuda tekrarı kapatmaktır.
   */
  const saveRecurrence = async (enabled) => {
    setNotice('');
    if (isNew) return setNotice('Önce kampanyayı kaydedin, sonra tekrarı kurun.');
    if (enabled && rec.unit === 'week' && !rec.byWeekday?.length) {
      return setNotice('Haftalık tekrar için en az bir gün seçin.');
    }
    if (enabled && rec.endMode === 'date' && !rec.endsAt) {
      return setNotice('Bitiş tarihi seçin.');
    }
    if (enabled && rec.endMode === 'count' && !(Number(rec.maxOccurrences) >= 1)) {
      return setNotice('Toplam koşu sayısı en az 1 olmalı.');
    }
    const body = enabled
      ? {
          enabled: true,
          every: Number(rec.every) || 1,
          unit: rec.unit,
          atHour: Number(rec.atHour) || 0,
          atMinute: Number(rec.atMinute) || 0,
          timezone: rec.timezone.trim() || 'Europe/Istanbul',
          byWeekday: rec.unit === 'week' ? rec.byWeekday : [],
          byMonthDay: rec.unit === 'month' ? Number(rec.byMonthDay) : null,
          endMode: rec.endMode,
          endsAt: rec.endMode === 'date' && rec.endsAt ? new Date(rec.endsAt).toISOString() : null,
          maxOccurrences: rec.endMode === 'count' ? Number(rec.maxOccurrences) : null,
        }
      : { enabled: false };

    const r = await setRecurrence({ id, ...body }).unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Tekrar ayarı kaydedilemedi' }));
    if (r?.__err) return setNotice(r.__err);
    setRec((s) => ({ ...s, enabled }));
    setNotice(enabled
      ? `Tekrar kuruldu: ${describeRecurrence(rec)} (${rec.timezone}).`
      : 'Tekrar kapatıldı — bu koşudan sonra yeni kampanya üretilmeyecek.');
    refetchCampaign();
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSC = (k, v) => setForm((f) => ({ ...f, sendConfig: { ...f.sendConfig, [k]: v } }));
  const setCB = (k, v) =>
    setForm((f) => ({ ...f, sendConfig: { ...f.sendConfig, circuitBreaker: { ...f.sendConfig.circuitBreaker, [k]: v } } }));
  const setSched = (k, v) => setForm((f) => ({ ...f, schedule: { ...f.schedule, [k]: v } }));

  const recipientCount = recipientInfo?.count ?? null;
  const effDuration = Number(form.schedule.durationMinutes) || 0;

  // Süre seçili değilken eski davranış: worker hızıyla tahmini süre.
  const estimateMin = useMemo(() => {
    const n = form.sendConfig.maxRecipients
      ? Math.min(Number(form.sendConfig.maxRecipients), recipientCount ?? Infinity)
      : recipientCount;
    if (!n || !form.sendConfig.ratePerSec) return null;
    return Math.max(1, Math.ceil(n / form.sendConfig.ratePerSec / 60));
  }, [recipientCount, form.sendConfig.maxRecipients, form.sendConfig.ratePerSec]);

  // Drip özeti + fizibilite: gereken hız ratePerSec tavanını aşarsa sunucu
  // reddeder — aynı kontrolü burada erken uyarı olarak göster.
  const dripInfo = useMemo(() => {
    if (!effDuration || !recipientCount) return null;
    const n = form.sendConfig.maxRecipients
      ? Math.min(Number(form.sendConfig.maxRecipients), recipientCount)
      : recipientCount;
    if (!n) return null;
    const rate = Number(form.sendConfig.ratePerSec) || 5;
    const perHour = Math.max(1, Math.round(n / (effDuration / 60)));
    if (n / (effDuration * 60) > rate) {
      return { ok: false, n, perHour, minMinutes: Math.max(1, Math.ceil(n / (rate * 60))) };
    }
    return { ok: true, n, perHour };
  }, [effDuration, recipientCount, form.sendConfig.maxRecipients, form.sendConfig.ratePerSec]);

  // Kısmi yayın hedefleri. Sunucu da aynı formülü kullanır (ceil); alıcı limiti
  // varsa test yayınında onunla kırpılır.
  const testPercentNum = Math.min(Math.max(Math.round(Number(testPercent) || 0), 1), 99);
  const testTarget =
    recipientCount == null
      ? null
      : Math.min(
          Math.ceil((recipientCount * testPercentNum) / 100),
          Number(form.sendConfig.maxRecipients) || Infinity,
        );
  const continuePercentNum = Math.min(Math.max(Math.round(Number(continuePercent) || 0), 1), 100);
  const continueTarget = delivery ? Math.ceil((delivery.remaining * continuePercentNum) / 100) : null;

  const buildPayload = () => ({
    name: form.name.trim(),
    channelKey: form.channelKey,
    templateId: form.templateId,
    subjectOverride: form.subjectOverride.trim() || null,
    globalVars: Object.fromEntries(vars.filter((v) => v.key.trim()).map((v) => [v.key.trim(), v.value])),
    sendConfig: {
      ratePerSec: Number(form.sendConfig.ratePerSec) || 5,
      batchSize: Number(form.sendConfig.batchSize) || 500,
      maxRecipients: form.sendConfig.maxRecipients ? Number(form.sendConfig.maxRecipients) : null,
      // Taşınmazsa sunucu sendConfig'i sıfırdan kurar → özel gönderen silinir.
      fromAddress: form.sendConfig.fromAddress.trim() || null,
      maxPerRecipientPerDay:
        form.sendConfig.maxPerRecipientPerDay === '' ? 1 : Math.max(0, Number(form.sendConfig.maxPerRecipientPerDay) || 0),
      circuitBreaker: {
        enabled: !!form.sendConfig.circuitBreaker.enabled,
        bounceRatePct: Number(form.sendConfig.circuitBreaker.bounceRatePct) || 3,
        complaintRatePct: Number(form.sendConfig.circuitBreaker.complaintRatePct) || 0.08,
      },
    },
    schedule: {
      startAt: form.schedule.startAt ? new Date(form.schedule.startAt).toISOString() : null,
      durationMinutes: effDuration || null,
    },
  });

  const save = async () => {
    if (!form.name.trim() || !form.channelKey || !form.templateId) {
      return setNotice('Ad, kanal ve şablon zorunlu.');
    }
    const payload = buildPayload();
    if (isNew) {
      const r = await createCampaign(payload).unwrap().catch((e) => ({ __err: e?.data?.message || 'Oluşturulamadı' }));
      if (r?.__err) return setNotice(r.__err);
      if (r?._id) router.push(`/cms/email/campaigns/${r._id}`);
    } else {
      const r = await updateCampaign({ id, ...payload }).unwrap().catch((e) => ({ __err: e?.data?.message || 'Kaydedilemedi' }));
      setNotice(r?.__err || 'Kampanya kaydedildi.');
    }
  };

  /** percent: null = tüm liste, 1-99 = kitlenin rastgele o yüzdesi (test yayını). */
  const doSend = async (percent = null) => {
    const r = await sendCampaign({ id, percent })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Gönderilemedi' }));
    setConfirmSend(null);
    if (r?.__err) return setNotice(r.__err);
    await refetchCampaign();
    if (r?.paused) return setNotice(`Güvenlik nedeniyle duraklatıldı: ${r.reason}`);
    setNotice(
      r?.samplePercent
        ? `Test yayını kuyruğa alındı: ${formatCount(r.queued)} kişi (listenin %${r.samplePercent}'i, rastgele seçildi). Kalanı "Kampanyaya Devam Et" ile gönderebilirsiniz.`
        : `Kampanya kuyruğa alındı (${formatCount(r?.queued ?? 0)} alıcı).`
    );
  };

  /** Kalan kitleye yeni parti. percent = KALANIN yüzdesi (100 = kalan herkes). */
  const doContinue = async () => {
    const percent = Math.min(Math.max(Math.round(Number(continuePercent) || 0), 1), 100);
    const r = await continueCampaign({ id, percent })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Devam edilemedi' }));
    setConfirmContinue(false);
    if (r?.__err) return setNotice(r.__err);
    await refetchCampaign();
    await refetchStats().catch(() => null);
    setNotice(
      r?.skipped
        ? 'Devam edilecek yeni alıcı yok — listedeki herkes bu kampanyayı almış.'
        : `Devam yayını kuyruğa alındı: ${formatCount(r?.queued ?? 0)} yeni alıcı (kalanın %${percent}'i).`
    );
  };

  // Zamanla: önce taslağı kaydet (zamanlama dahil form değişiklikleri yansısın),
  // sonra draft → scheduled geçişini yap. startAt boşsa "şimdi" kabul edilir.
  const doSchedule = async () => {
    if (!form.name.trim() || !form.channelKey || !form.templateId) {
      return setNotice('Ad, kanal ve şablon zorunlu.');
    }
    const payload = buildPayload();
    if (!payload.schedule.startAt && !payload.schedule.durationMinutes) {
      return setNotice('Zamanlamak için başlangıç tarihi veya yayılma süresi girin.');
    }
    const saveRes = await updateCampaign({ id, ...payload })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Kaydedilemedi' }));
    if (saveRes?.__err) return setNotice(saveRes.__err);

    const r = await scheduleCampaign({
      id,
      startAt: payload.schedule.startAt,
      durationMinutes: payload.schedule.durationMinutes,
    })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Zamanlanamadı' }));
    if (r?.__err) return setNotice(r.__err);
    await refetchCampaign();
    setNotice(
      payload.schedule.durationMinutes
        ? `Kampanya zamanlandı: ${formatDateTime(payload.schedule.startAt || Date.now())} başlangıç, ${formatDuration(payload.schedule.durationMinutes)} yayılma.`
        : `Kampanya zamanlandı: ${formatDateTime(payload.schedule.startAt || Date.now())} başlangıç.`
    );
  };

  const doUnschedule = async () => {
    const r = await unscheduleCampaign(id).unwrap().catch((e) => ({ __err: e?.data?.message || 'İptal edilemedi' }));
    if (r?.__err) return setNotice(r.__err);
    await refetchCampaign();
    setNotice('Zamanlama iptal edildi — kampanya taslağa döndü.');
  };

  const doPause = async () => {
    const r = await pauseCampaign(id).unwrap().catch((e) => ({ __err: e?.data?.message || 'Duraklatılamadı' }));
    if (r?.__err) return setNotice(r.__err);
    await refetchCampaign();
    setNotice('Kampanya duraklatıldı.');
  };

  const doResume = async () => {
    const r = await resumeCampaign(id).unwrap().catch((e) => ({ __err: e?.data?.message || 'Sürdürülemedi' }));
    if (r?.__err) return setNotice(r.__err);
    await refetchCampaign();
    setNotice(
      r?.requeued || r?.rescanned
        ? `Kampanya sürdürüldü (${(r.requeued || 0) + (r.rescanned || 0)} alıcı yeniden kuyruğa alındı).`
        : 'Kampanya sürdürüldü.'
    );
  };

  const refreshCampaign = async () => {
    if (isNew) return;
    await refetchCampaign();
    if (status !== 'draft') {
      await refetchStats().catch(() => null);
    }
    setNotice('Kampanya durumu yenilendi.');
  };

  const removeDraft = async () => {
    const r = await deleteCampaign(id)
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Taslak kaldırılamadı' }));
    if (r?.__err) return setNotice(r.__err);
    router.push('/cms/email/campaigns');
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email · Kampanya"
        title={isNew ? 'Yeni Kampanya' : form.name || 'Kampanya'}
        description="Onaylı kullanıcılara toplu yayın — taslak oluştur, hazır olunca yayınla"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/cms/email/campaigns"><Button variant="outline"><ArrowLeft className="size-4" /> Liste</Button></Link>
            {!isNew && status !== 'draft' && (
              <Link href={`/cms/email/campaigns/${id}/dashboard`}>
                <Button variant="outline"><BarChart3 className="size-4" /> Dashboard</Button>
              </Link>
            )}
            {!isNew && (
              <Button variant="outline" onClick={refreshCampaign} disabled={campaignFetching || statsFetching}>
                {campaignFetching || statsFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Yenile
              </Button>
            )}
            {!isNew && (
              <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!form.templateId} title="Gönderilecek maili birebir gör">
                <Eye className="size-4" /> Önizle
              </Button>
            )}
            {isScheduled && (
              <Button variant="outline" onClick={doUnschedule} disabled={unscheduling}>
                {unscheduling ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Zamanlamayı İptal Et
              </Button>
            )}
            {isActive && (
              <Button variant="outline" onClick={doPause} disabled={pausing}>
                {pausing ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />} Duraklat
              </Button>
            )}
            {isPaused && (
              <Button variant="outline" onClick={doResume} disabled={resuming}>
                {resuming ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Sürdür
              </Button>
            )}
            {isDraft && (
              // Bu buton YAYINLAMAZ, taslağı kaydeder ("Sonra Yayınla" etiketi
              // yayın butonu sanılıyordu). Yayın sağdaki özet kartından yapılır.
              <Button onClick={save} disabled={creating || saving} title="Taslağı kaydet (yayınlamaz)">
                {creating || saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Kaydet
              </Button>
            )}
            {isDraft && !isNew && (
              confirmDelete ? (
                <Button variant="destructive" onClick={removeDraft} disabled={deleting}>
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Emin?
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" /> Kaldır
                </Button>
              )
            )}
          </div>
        }
      />

      {notice && <Alert variant="info" className="mb-4"><AlertDescription>{notice}</AlertDescription></Alert>}

      {!isNew && isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          {/* Sol: form */}
          <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle>Kampanya</CardTitle></CardHeader>
              <CardContent className="space-y-4 p-4">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Ad</label>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} disabled={!isDraft} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="min-w-[200px] flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">Kanal (alıcı listesi)</label>
                    <select value={form.channelKey} onChange={(e) => set('channelKey', e.target.value)} disabled={!isDraft}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30">
                      <option value="">— seçin —</option>
                      {groupedAudience.map((g) => (
                        <optgroup key={g.type} label={g.label}>
                          {g.items.map((c) => (
                            <option key={c._id} value={c.key}>
                              {c.title}{c.description ? ` — ${c.description}` : ''} ({c.key})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {selectedChannelRecipe && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Bu liste <b>{selectedChannelRecipe.name}</b> cron listesinden üretiliyor —
                        tekrarlı yayımda her koşu o listenin güncel hâline gider.
                      </p>
                    )}
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">Şablon</label>
                    <select value={form.templateId} onChange={(e) => set('templateId', e.target.value)} disabled={!isDraft}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30">
                      <option value="">— seçin —</option>
                      {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Konu override (boşsa şablon konusu)</label>
                  <Input value={form.subjectOverride} onChange={(e) => set('subjectOverride', e.target.value)} disabled={!isDraft} />
                </div>

                {/* globalVars */}
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Genel değişkenler (herkese aynı)</label>
                  <div className="space-y-2">
                    {vars.map((v, i) => (
                      <div key={i} className="flex gap-2">
                        <Input placeholder="DEGISKEN" value={v.key} disabled={!isDraft}
                          onChange={(e) => setVars((arr) => arr.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                          className="font-mono text-xs" />
                        <Input placeholder="değer" value={v.value} disabled={!isDraft}
                          onChange={(e) => setVars((arr) => arr.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                        {isDraft && <Button variant="ghost" size="sm" onClick={() => setVars((arr) => arr.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button>}
                      </div>
                    ))}
                    {isDraft && (
                      <Button variant="outline" size="sm" onClick={() => setVars((arr) => [...arr, { key: '', value: '' }])}>
                        <Plus className="size-3.5" /> Değişken ekle
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Zamanlama ve yayılma (drip) */}
            <Card>
              <CardHeader><CardTitle><CalendarClock className="mr-1 inline size-4" /> Zamanlama ve Yayılma</CardTitle></CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="w-60">
                    <label className="mb-1 block text-xs text-muted-foreground">Başlangıç (boş = hemen)</label>
                    <input
                      type="datetime-local"
                      value={form.schedule.startAt}
                      disabled={!isDraft}
                      onChange={(e) => setSched('startAt', e.target.value)}
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
                    />
                  </div>
                  <div className="min-w-[200px]">
                    <label className="mb-1 block text-xs text-muted-foreground">Yayılma süresi</label>
                    <select
                      value={DURATION_PRESETS.some((p) => p.value === form.schedule.durationMinutes) ? form.schedule.durationMinutes : 'custom'}
                      disabled={!isDraft}
                      onChange={(e) =>
                        setSched(
                          'durationMinutes',
                          e.target.value === 'custom'
                            // Mevcut değer bir preset ise onu koruyamayız (select geri
                            // preset'e düşer) → preset-dışı bir başlangıçla aç.
                            ? (DURATION_PRESETS.some((p) => p.value === form.schedule.durationMinutes)
                                ? '90'
                                : form.schedule.durationMinutes || '90')
                            : e.target.value
                        )
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
                    >
                      {DURATION_PRESETS.map((p) => <option key={p.value || 'none'} value={p.value}>{p.label}</option>)}
                      <option value="custom">Özel…</option>
                    </select>
                  </div>
                  {!DURATION_PRESETS.some((p) => p.value === form.schedule.durationMinutes) && (
                    <div className="w-36">
                      <label className="mb-1 block text-xs text-muted-foreground">Özel süre (dakika)</label>
                      <Input type="number" min={1} value={form.schedule.durationMinutes} disabled={!isDraft}
                        onChange={(e) => setSched('durationMinutes', e.target.value)} placeholder="örn. 90" />
                    </div>
                  )}
                </div>

                {effDuration > 0 && dripInfo && (
                  dripInfo.ok ? (
                    <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {formatCount(dripInfo.n)} alıcı {formatDuration(effDuration)} içinde eşit ağırlıklı gönderilir — ≈{formatCount(dripInfo.perHour)} mail/saat.
                    </p>
                  ) : (
                    <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                      Süre çok kısa: {formatCount(dripInfo.n)} alıcı {form.sendConfig.ratePerSec} mail/sn hızla bu pencereye sığmaz.
                      En az {formatDuration(dripInfo.minMinutes)} seçin (sunucu da reddeder).
                    </p>
                  )
                )}
                <p className="text-[11px] text-muted-foreground">
                  Süre seçilirse gönderim o pencereye eşit yayılır (örn. 24 alıcı / 24 saat = saatte 1 mail).
                  Alıcı sayısı kampanya <b>başlarken</b> dondurulur; sonradan listeye eklenenler bu kampanyaya girmez.
                  Gece dahil kesintisiz gönderilir.
                </p>
              </CardContent>
            </Card>

            {/* Tekrarlı yayın */}
            {!isNew && (
              <Card>
                <CardHeader>
                  <CardTitle><Repeat className="mr-1 inline size-4" /> Tekrarlı Yayın</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rec.enabled}
                      disabled={!isDraft && !isScheduled}
                      onChange={(e) => setR('enabled', e.target.checked)}
                    />
                    Bu kampanyayı düzenli olarak tekrarla
                  </label>

                  {rec.enabled && (
                    <>
                      <div className="flex flex-wrap items-end gap-3">
                        <span className="pb-2 text-sm text-muted-foreground">Her</span>
                        <div className="w-24">
                          <label className="mb-1 block text-xs text-muted-foreground">Miktar</label>
                          <Input type="number" min={1} value={rec.every}
                            onChange={(e) => setR('every', e.target.value)} />
                        </div>
                        <div className="w-44">
                          <label className="mb-1 block text-xs text-muted-foreground">Birim</label>
                          <select
                            value={rec.unit}
                            onChange={(e) => setR('unit', e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                          >
                            {RECURRENCE_UNITS.map((u) => (
                              <option key={u.value} value={u.value}>{u.label}</option>
                            ))}
                          </select>
                        </div>
                        {unitUsesClock && (
                          <>
                            <div className="w-24">
                              <label className="mb-1 block text-xs text-muted-foreground">Saat</label>
                              <Input type="number" min={0} max={23} value={rec.atHour}
                                onChange={(e) => setR('atHour', e.target.value)} />
                            </div>
                            <div className="w-24">
                              <label className="mb-1 block text-xs text-muted-foreground">Dakika</label>
                              <Input type="number" min={0} max={59} value={rec.atMinute}
                                onChange={(e) => setR('atMinute', e.target.value)} />
                            </div>
                          </>
                        )}
                        <div className="w-48">
                          <label className="mb-1 block text-xs text-muted-foreground">Zaman dilimi</label>
                          <Input value={rec.timezone} onChange={(e) => setR('timezone', e.target.value)} />
                        </div>
                      </div>

                      {/* Takvim çıpası: hafta/ay tekrarında tarih bundan seçilir.
                          Olmadığında seri, ilk koşunun rastgele denk geldiği güne
                          kilitlenir ve operatör hangi gün olduğunu göremez. */}
                      {rec.unit === 'week' && (
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">
                            Haftanın hangi günleri
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {WEEKDAYS.map((d) => {
                              const on = rec.byWeekday?.includes(d.value);
                              return (
                                <Button
                                  key={d.value}
                                  type="button"
                                  size="sm"
                                  variant={on ? 'primary' : 'outline'}
                                  title={d.long}
                                  onClick={() =>
                                    setR(
                                      'byWeekday',
                                      on
                                        ? rec.byWeekday.filter((v) => v !== d.value)
                                        : [...(rec.byWeekday || []), d.value].sort((a, b) => a - b),
                                    )
                                  }
                                >
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
                        <div className="w-60">
                          <label className="mb-1 block text-xs text-muted-foreground">Ayın hangi günü</label>
                          <select
                            value={rec.byMonthDay}
                            onChange={(e) => setR('byMonthDay', e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                          >
                            {MONTH_DAYS.map((d) => (
                              <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                          </select>
                          {Number(rec.byMonthDay) > 28 && Number(rec.byMonthDay) !== LAST_DAY && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              O günü içermeyen aylarda ayın son gününe kaydırılır.
                            </p>
                          )}
                        </div>
                      )}

                      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                        <b>{describeRecurrence(rec)}</b>
                        {!unitUsesClock && (
                          <span className="text-muted-foreground">
                            {' '}— saat birimi duvar saatine sabitlenmez, koşudan koşuya sabit aralık bırakır.
                          </span>
                        )}
                      </p>

                      <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[260px] flex-1">
                          <label className="mb-1 block text-xs text-muted-foreground">Bitiş koşulu</label>
                          <select
                            value={rec.endMode}
                            onChange={(e) => setR('endMode', e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                          >
                            {END_MODES.map((m) => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        </div>
                        {rec.endMode === 'date' && (
                          <div className="w-60">
                            <label className="mb-1 block text-xs text-muted-foreground">Son tarih</label>
                            <input
                              type="datetime-local"
                              value={rec.endsAt}
                              onChange={(e) => setR('endsAt', e.target.value)}
                              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                            />
                          </div>
                        )}
                        {rec.endMode === 'count' && (
                          <div className="w-44">
                            <label className="mb-1 block text-xs text-muted-foreground">Toplam koşu sayısı</label>
                            <Input type="number" min={1} value={rec.maxOccurrences}
                              onChange={(e) => setR('maxOccurrences', e.target.value)} placeholder="örn. 30" />
                          </div>
                        )}
                      </div>

                      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        Alıcı listesi <b>yukarıdaki kanal seçiminden</b> gelir; burada ayrıca seçilmez.
                        {selectedChannelRecipe ? (
                          <>
                            {' '}Seçilen kanal <b>{selectedChannelRecipe.name}</b> cron listesine ait olduğu için
                            her koşu o listenin <b>güncel hâline</b> gider. Liste o koşu için yeniden
                            üretilmemişse gönderim <b>yapılmaz</b> — aynı kitleye ikinci kez mail gitmez.
                            Cron listesinin saatini bu kampanyadan <b>önceye</b> ayarlayın.
                          </>
                        ) : (
                          ' Seçilen kanal sabit olduğu için her koşu aynı kanala gider.'
                        )}
                      </p>
                    </>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => saveRecurrence(rec.enabled)}
                      disabled={savingRecurrence || (!isDraft && !isScheduled)}
                    >
                      {savingRecurrence ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      {rec.enabled ? 'Tekrarı Kaydet' : 'Tekrarı Kapat'}
                    </Button>
                    {campaign?.recurrence?.enabled && (
                      <span className="text-xs text-muted-foreground">
                        {campaign.recurrence.occurrence || 1}. koşu
                        {campaign.recurrence.spawnedNextAt
                          ? ' · sonraki koşu üretildi'
                          : ' · sonraki koşu bu yayın başlarken üretilecek'}
                      </span>
                    )}
                  </div>

                  {!isDraft && !isScheduled && (
                    <p className="text-[11px] text-muted-foreground">
                      Bu kampanya başlamış/bitmiş: tekrar ayarı artık değiştirilemez. Seriyi durdurmak
                      için <b>bekleyen (zamanlanmış) son koşuyu</b> açıp tekrarı kapatın.
                    </p>
                  )}

                  {campaign?.recurrence?.seriesId && <CampaignSeries id={id} />}
                </CardContent>
              </Card>
            )}

            {/* Gönderim güvenliği */}
            <Card>
              <CardHeader><CardTitle><ShieldCheck className="mr-1 inline size-4" /> Gönderim Güvenliği</CardTitle></CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="w-40">
                    <label className="mb-1 block text-xs text-muted-foreground">Hız (mail/sn)</label>
                    <Input type="number" min={1} value={form.sendConfig.ratePerSec} disabled={!isDraft}
                      onChange={(e) => setSC('ratePerSec', e.target.value)} />
                  </div>
                  <div className="w-44">
                    <label className="mb-1 block text-xs text-muted-foreground">Alıcı limiti (boş=sınırsız)</label>
                    <Input type="number" min={0} value={form.sendConfig.maxRecipients} disabled={!isDraft}
                      onChange={(e) => setSC('maxRecipients', e.target.value)} placeholder="örn. 1000" />
                  </div>
                  <div className="w-40">
                    <label className="mb-1 block text-xs text-muted-foreground">Batch boyutu</label>
                    <Input type="number" min={1} value={form.sendConfig.batchSize} disabled={!isDraft}
                      onChange={(e) => setSC('batchSize', e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="min-w-[260px] flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Gönderen (boş = varsayılan no-reply; yalnız doğrulanmış alan adı)
                    </label>
                    <Input value={form.sendConfig.fromAddress} disabled={!isDraft}
                      onChange={(e) => setSC('fromAddress', e.target.value)}
                      placeholder='örn. "Tinnten Basın" <press@tinten.ai>' />
                  </div>
                  <div className="w-52">
                    <label className="mb-1 block text-xs text-muted-foreground">Aynı adrese günlük sınır (0=sınırsız)</label>
                    <Input type="number" min={0} value={form.sendConfig.maxPerRecipientPerDay} disabled={!isDraft}
                      onChange={(e) => setSC('maxPerRecipientPerDay', e.target.value)} />
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.sendConfig.circuitBreaker.enabled} disabled={!isDraft}
                      onChange={(e) => setCB('enabled', e.target.checked)} />
                    Otomatik fren (oran eşiği aşılırsa kampanyayı durdur)
                  </label>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <div className="w-40">
                      <label className="mb-1 block text-xs text-muted-foreground">Bounce eşiği %</label>
                      <Input type="number" step="0.1" value={form.sendConfig.circuitBreaker.bounceRatePct} disabled={!isDraft || !form.sendConfig.circuitBreaker.enabled}
                        onChange={(e) => setCB('bounceRatePct', e.target.value)} />
                    </div>
                    <div className="w-40">
                      <label className="mb-1 block text-xs text-muted-foreground">Şikayet eşiği %</label>
                      <Input type="number" step="0.01" value={form.sendConfig.circuitBreaker.complaintRatePct} disabled={!isDraft || !form.sendConfig.circuitBreaker.enabled}
                        onChange={(e) => setCB('complaintRatePct', e.target.value)} />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Kötü adresler (bounce/şikayet) otomatik elenir ve tek-tık abonelikten çıkış her maile eklenir — bunlar her zaman açıktır.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sağ: özet + gönder/stats */}
          <Card className="lg:sticky lg:top-4 lg:self-start">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Özet</CardTitle>
                {!isNew && (
                  <Button variant="ghost" size="sm" onClick={refreshCampaign} disabled={campaignFetching || statsFetching}>
                    {campaignFetching || statsFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    Yenile
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Durum</span>
                <Badge variant={(STATUS_META[status] || {}).variant || 'secondary'}>
                  {(STATUS_META[status] || {}).label || status}
                </Badge>
              </div>
              {isScheduled && (
                <div className="space-y-1 rounded-md border border-border p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Başlangıç</span>
                    <span className="font-medium">{formatDateTime(campaign?.schedule?.startAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Yayılma</span>
                    <span className="font-medium">
                      {campaign?.schedule?.durationMinutes ? formatDuration(campaign.schedule.durationMinutes) : 'Tek seferde'}
                    </span>
                  </div>
                  <p className="pt-1 text-muted-foreground">
                    Saat geldiğinde otomatik başlar. Değişiklik için zamanlamayı iptal edin.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Alıcı sayısı</span>
                <span className="font-medium">{form.channelKey ? (recipientCount ?? '…') : '—'}</span>
              </div>
              {progress.total > 0 && (
                <div className="space-y-1.5 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">İlerleme</span>
                    <span className="font-medium">{progress.percent}%</span>
                  </div>
                  <Progress value={progress.percent} indicatorClassName={progress.failed ? 'bg-amber-500' : undefined} />
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatCount(progress.sent)}/{formatCount(progress.total)} tamamlandı</span>
                    {progress.pending > 0 && <span>Kuyrukta {formatCount(progress.pending)}</span>}
                    {progress.failed > 0 && <span className="text-destructive">{formatCount(progress.failed)} hata</span>}
                  </div>
                </div>
              )}
              {effDuration > 0 && dripInfo ? (
                <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {formatDuration(effDuration)} pencereye yayılır — ≈{formatCount(dripInfo.perHour)} mail/saat
                </div>
              ) : estimateMin != null ? (
                <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  ~{estimateMin} dk’da gönderilecek ({form.sendConfig.ratePerSec} mail/sn)
                </div>
              ) : null}

              {campaign?.pausedReason && status === 'paused' && (
                <Alert variant="destructive"><AlertTitle>Duraklatıldı</AlertTitle><AlertDescription>{campaign.pausedReason}</AlertDescription></Alert>
              )}

              {stats && (
                <div className="space-y-1 rounded-md border border-border p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Gönderildi</span><span>{stats.sent}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Başarısız</span><span>{stats.failed}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Kuyrukta</span><span>{stats.queued}</span></div>
                  <div className="mt-2 border-t border-border pt-2" />
                  <div className="flex justify-between"><span className="text-muted-foreground">Açılma</span><span>{stats.opened ?? 0} · {formatPercent(stats.openRate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tıklama</span><span>{stats.clicked ?? 0} · {formatPercent(stats.clickRate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Kayıt dönüşümü</span><span>{stats.conversions?.registrations ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Firma dönüşümü</span><span>{stats.conversions?.companies ?? 0}</span></div>
                  {stats.buttons?.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-border pt-2">
                      <div className="text-xs font-medium text-muted-foreground">Butonlar</div>
                      {stats.buttons.map((button) => (
                        <div key={button.buttonId || 'unknown'} className="flex justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate font-mono">{button.buttonId || 'unknown'}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {button.clicks ?? 0} tık · {button.uniqueClicks ?? 0} kişi · {formatPercent(button.ctr)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Kısmi yayın sonrası kalan kitle — "kim almadı" ve devam kontrolü.
                  Kanal yayından sonra büyüdüyse yeni üyeler de burada görünür. */}
              {isFinished && delivery && (
                <div
                  className={`space-y-2 rounded-md border p-3 text-xs ${
                    delivery.remaining > 0
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {delivery.remaining > 0 ? 'Yayın tamamlanmadı' : 'Liste tamamlandı'}
                    </span>
                    <span>%{delivery.coveredPercent} kapsandı</span>
                  </div>
                  <p>
                    Listedeki {formatCount(delivery.channelTotal)} kişiden{' '}
                    <b>{formatCount(delivery.covered)}</b> kişiye gönderildi.
                    {delivery.remaining > 0 && (
                      <> <b>{formatCount(delivery.remaining)}</b> kişi bu kampanyayı henüz almadı.</>
                    )}
                  </p>

                  {delivery.remaining > 0 && (
                    confirmContinue ? (
                      <div className="space-y-2">
                        <p className="text-foreground">
                          Kalan {formatCount(delivery.remaining)} kişiden{' '}
                          <b>
                            {continuePercentNum >= 100
                              ? 'tamamına'
                              : `rastgele ${formatCount(continueTarget)} kişiye`}
                          </b>{' '}
                          gönderilsin mi?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            onClick={doContinue}
                            disabled={continuing}
                            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            {continuing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                            Evet, gönder
                          </Button>
                          <Button variant="outline" onClick={() => setConfirmContinue(false)}>Vazgeç</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-end gap-2">
                          <div className="w-20">
                            <label className="mb-1 block text-[11px] text-muted-foreground">Kalanın %</label>
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              value={continuePercent}
                              onChange={(e) => setContinuePercent(e.target.value)}
                              className="h-8"
                            />
                          </div>
                          <Button
                            variant="outline"
                            className="h-8 flex-1"
                            onClick={() => setConfirmContinue(true)}
                          >
                            <Send className="size-4" /> Kampanyaya Devam Et
                          </Button>
                        </div>
                        <p className="text-muted-foreground">
                          {continuePercentNum >= 100
                            ? 'Kalan herkese gönderilir.'
                            : `Kalanın %${continuePercentNum}'i ≈ ${formatCount(continueTarget)} kişi rastgele seçilir.`}{' '}
                          Daha önce mail gitmiş kişiler bu partiye <b>girmez</b>.
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}

              {isDraft && !isNew && (
                confirmSend != null ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      {confirmSend >= 100
                        ? `${formatCount(recipientCount ?? 0)} kişinin tamamına hemen yayınlansın mı?`
                        : `Listeden rastgele ${formatCount(testTarget ?? 0)} kişiye (%${confirmSend}) test yayını yapılsın mı?`}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => doSend(confirmSend >= 100 ? null : confirmSend)}
                        disabled={sending}
                        className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        {sending ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />} Evet, yayınla
                      </Button>
                      <Button variant="outline" onClick={() => setConfirmSend(null)}>Vazgeç</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(form.schedule.startAt || effDuration > 0) && (
                      <Button
                        className="w-full"
                        onClick={doSchedule}
                        disabled={scheduling || saving || !form.channelKey || !form.templateId || (dripInfo && !dripInfo.ok)}
                        title={form.schedule.startAt ? `Başlangıç: ${formatDateTime(form.schedule.startAt)}` : 'Hemen başlar, süreye yayılır'}
                      >
                        {scheduling ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
                        Zamanla{effDuration > 0 ? ` (${formatDuration(effDuration)})` : ''}
                      </Button>
                    )}
                    <Button
                      variant={form.schedule.startAt || effDuration > 0 ? 'outline' : 'default'}
                      className={form.schedule.startAt || effDuration > 0 ? 'w-full' : 'w-full bg-emerald-600 text-white hover:bg-emerald-700'}
                      onClick={() => setConfirmSend(100)}
                      disabled={!form.channelKey || !form.templateId}
                    >
                      <Megaphone className="size-4" /> Hemen Yayınla
                    </Button>

                    {/* Test yayını: kitlenin rastgele %N'i. Zamanlama DEĞİL —
                        yüzde yalnız "hemen yayınla" yolunda uygulanır. */}
                    <div className="rounded-md border border-dashed border-border p-2.5">
                      <div className="flex items-end gap-2">
                        <div className="w-20">
                          <label className="mb-1 block text-[11px] text-muted-foreground">Yüzde</label>
                          <Input
                            type="number"
                            min={1}
                            max={99}
                            value={testPercent}
                            onChange={(e) => setTestPercent(e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <Button
                          variant="outline"
                          className="h-8 flex-1"
                          onClick={() => setConfirmSend(testPercentNum)}
                          disabled={!form.channelKey || !form.templateId}
                        >
                          <FlaskConical className="size-4" /> Test Yayın (%{testPercentNum})
                        </Button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {recipientCount == null ? (
                          'Önce alıcı listesi seçin.'
                        ) : (
                          <>
                            Listeden <b>rastgele {formatCount(testTarget)} kişi</b> seçilir; kalan{' '}
                            {formatCount(Math.max(recipientCount - testTarget, 0))} kişiye mail gitmez.
                            Yayın bitince kalanına buradan devam edebilirsiniz.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )
              )}
              {isNew && <p className="text-xs text-muted-foreground">Önce taslağı oluşturun; ardından yayınlayabilir veya zamanlayabilirsiniz.</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {!isNew && (
        <MailPreviewPanel campaignId={id} open={previewOpen} onClose={() => setPreviewOpen(false)} />
      )}
    </RoleGuard>
  );
}

/**
 * Serinin koşu geçmişi — "her gün gerçekten gitti mi" sorusunun tek bakışta
 * cevabı. Başarısız koşularda `pausedReason` görünür (ör. "yeni liste üretilmedi").
 */
function CampaignSeries({ id }) {
  const { data: runs = [], isFetching } = useGetMailCampaignSeriesQuery(id);
  if (isFetching && runs.length === 0) return <Skeleton className="h-24 w-full" />;
  if (runs.length <= 1) return null;

  return (
    <div>
      <div className="mb-1 text-xs font-medium">Seri koşuları ({runs.length})</div>
      <div className="max-h-64 overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <tbody>
            {runs.map((r) => {
              const meta = STATUS_META[r.status] || { label: r.status, variant: 'secondary' };
              return (
                <tr key={r._id} className={`border-b last:border-0 ${r._id === id ? 'bg-muted/40' : ''}`}>
                  <td className="p-2 text-xs text-muted-foreground">#{r.recurrence?.occurrence || 1}</td>
                  <td className="p-2 text-xs">
                    {r.status === 'scheduled'
                      ? formatDateTime(r.schedule?.startAt)
                      : formatDateTime(r.sentAt || r.createdAt)}
                  </td>
                  <td className="p-2 font-mono text-[11px] text-muted-foreground">{r.channelKey}</td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {formatCount(r.audience?.sentCount)} / {formatCount(r.audience?.total)}
                  </td>
                  <td className="p-2 text-right">
                    <Link href={`/cms/email/campaigns/${r._id}${['draft', 'scheduled'].includes(r.status) ? '' : '/dashboard'}`}>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </Link>
                    {r.pausedReason && (
                      <div className="max-w-[240px] truncate text-[11px] text-destructive" title={r.pausedReason}>
                        {r.pausedReason}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
