'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Save, Loader2, ArrowLeft, Plus, Trash2, Megaphone, RefreshCw, BarChart3, Eye, Pause, Play, XCircle, Repeat } from 'lucide-react';
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
import { CampaignPublishSheet } from '@/components/email/campaign-publish-sheet';

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
  // Yayın kararı iki BAĞIMSIZ eksen: kimlere (%) ve ne zaman. "Test yayını"
  // ayrı bir mod değil, sadece küçük bir yüzde; %100 herkes demek.
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishPercent, setPublishPercent] = useState('100');
  const [publishWhen, setPublishWhen] = useState('now'); // now | at
  const [publishError, setPublishError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUnschedule, setConfirmUnschedule] = useState(false);
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
      // Yayın çekmecesinin iki ekseni kayıttan gelir: kaydedilmiş yüzde ve
      // zamanlama var mı. Tamamlanmış kampanyada yüzde %100'e döner — önceki
      // koşunun %25'i "kalanı gönder" ekranına sızarsa operatör farkında
      // olmadan kalanın yalnız çeyreğine gönderirdi.
      const savedPct = campaign.sendConfig?.samplePercent;
      setPublishPercent(
        ['sent', 'partial', 'failed'].includes(campaign.status) || !savedPct
          ? '100'
          : String(savedPct),
      );
      setPublishWhen(campaign.schedule?.startAt || campaign.schedule?.durationMinutes ? 'at' : 'now');
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

  /**
   * Tekrar ayarı ayrı bir uçtan yazılır (PATCH .../recurrence): ana kaydet yalnız
   * taslakta çalışırken tekrar, zamanlanmış kampanyada da değiştirilebilmeli —
   * seriyi durdurmanın tek yolu bekleyen son koşuda tekrarı kapatmaktır.
   */
  const persistRecurrence = async () => {
    const enabled = Boolean(rec.enabled);
    if (isNew) {
      setPublishError('Önce kampanyayı kaydedin, sonra tekrarı kurun.');
      return false;
    }
    if (enabled && rec.unit === 'week' && !rec.byWeekday?.length) {
      setPublishError('Haftalık tekrar için en az bir gün seçin.');
      return false;
    }
    if (enabled && rec.endMode === 'date' && !rec.endsAt) {
      setPublishError('Bitiş tarihi seçin.');
      return false;
    }
    if (enabled && rec.endMode === 'count' && !(Number(rec.maxOccurrences) >= 1)) {
      setPublishError('Toplam koşu sayısı en az 1 olmalı.');
      return false;
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
    if (r?.__err) {
      setPublishError(r.__err);
      return false;
    }
    refetchCampaign();
    return true;
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

  const publishPercentNum = Math.min(Math.max(Math.round(Number(publishPercent) || 0), 1), 100);

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
      // Yüzde kampanyaya KAYDEDİLİR: zamanlanmış koşu onu başlarken uygular
      // (örneklemi dondurur). Yalnız eyleme parametre olarak geçilseydi
      // zamanlanan yayında sessizce yok sayılırdı. %100 → null (örnekleme yok).
      samplePercent: publishPercentNum >= 100 ? null : publishPercentNum,
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

  /**
   * Çekmecenin tek çıkışı. Duruma göre üç uçtan birine gider ama operatör için
   * hepsi aynı eylem: "yayına al".
   *   tamamlanmış → /continue   (kalanlardan, listenin %N'i kadar)
   *   taslak + hemen → /send    (yüzde eyleme de geçilir; sunucu kayıtlıyı da okur)
   *   taslak + zamanla → PATCH + /schedule (yüzde sendConfig'te taşınır)
   * Zamanlanmışta yalnız tekrar değişebilir (sunucu kuralı: yalnız taslak zamanlanır).
   */
  const submitPublish = async () => {
    setPublishError('');
    setNotice('');

    if (isFinished) {
      const r = await continueCampaign({ id, percent: publishPercentNum })
        .unwrap()
        .catch((e) => ({ __err: e?.data?.message || 'Devam edilemedi' }));
      if (r?.__err) return setPublishError(r.__err);
      setPublishOpen(false);
      await refetchCampaign();
      await refetchStats().catch(() => null);
      return setNotice(
        r?.skipped
          ? 'Devam edilecek yeni alıcı yok — listedeki herkes bu kampanyayı almış.'
          : `Devam yayını kuyruğa alındı: ${formatCount(r?.queued ?? 0)} yeni alıcı (listenin %${publishPercentNum}'i kadar).`
      );
    }

    if (isScheduled) {
      const ok = await persistRecurrence();
      if (!ok) return;
      setPublishOpen(false);
      return setNotice('Tekrar ayarı kaydedildi.');
    }

    if (!form.name.trim() || !form.channelKey || !form.templateId) {
      return setPublishError('Ad, kanal ve şablon zorunlu.');
    }

    // Yüzde ve gönderim ayarları ÖNCE kaydedilir: zamanlanan koşu yüzdeyi
    // kampanya kaydından okur, hemen giden yayın da aynı kaydı görür.
    const payload = buildPayload();
    const saved = await updateCampaign({ id, ...payload })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Kaydedilemedi' }));
    if (saved?.__err) return setPublishError(saved.__err);

    if (publishWhen === 'at') {
      if (!payload.schedule.startAt && !payload.schedule.durationMinutes) {
        return setPublishError('Başlangıç tarihi veya yayılma süresi girin.');
      }
      const r = await scheduleCampaign({
        id,
        startAt: payload.schedule.startAt,
        durationMinutes: payload.schedule.durationMinutes,
      })
        .unwrap()
        .catch((e) => ({ __err: e?.data?.message || 'Zamanlanamadı' }));
      if (r?.__err) return setPublishError(r.__err);
      // Tekrar AYRI uçtan yazılır; zamanlama başarılı olduktan sonra denenir ki
      // tekrar hatası zamanlamayı geri almasın.
      const recOk = await persistRecurrence();
      setPublishOpen(false);
      await refetchCampaign();
      return setNotice(
        `Kampanya zamanlandı: ${formatDateTime(payload.schedule.startAt || Date.now())}` +
        (payload.schedule.durationMinutes ? `, ${formatDuration(payload.schedule.durationMinutes)} yayılma` : '') +
        (publishPercentNum < 100 ? ` · listenin %${publishPercentNum}'i` : '') +
        (recOk ? '' : ' (tekrar ayarı kaydedilemedi)')
      );
    }

    const r = await sendCampaign({ id, percent: publishPercentNum < 100 ? publishPercentNum : null })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Gönderilemedi' }));
    if (r?.__err) return setPublishError(r.__err);
    setPublishOpen(false);
    await refetchCampaign();
    if (r?.paused) return setNotice(`Güvenlik nedeniyle duraklatıldı: ${r.reason}`);
    setNotice(
      r?.samplePercent
        ? `Yayın kuyruğa alındı: ${formatCount(r.queued)} kişi (listenin %${r.samplePercent}'i, rastgele seçildi). Kalanına daha sonra devam edebilirsiniz.`
        : `Kampanya kuyruğa alındı (${formatCount(r?.queued ?? 0)} alıcı).`
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

            {/* Zamanlama, tekrar ve gönderim güvenliği artık YAYIN ÇEKMECESİNDE:
                hepsi tek bir "ne zaman / kime / ne hızda" kararının parçası ve
                ayrı kartlara dağılmışken karar tek ekranda görünmüyordu.
                Sayfada yalnız kampanyanın TANIMI ve koşu SONUÇLARI kalır. */}
            {campaign?.recurrence?.seriesId && (
              <Card>
                <CardHeader>
                  <CardTitle><Repeat className="mr-1 inline size-4" /> Seri koşuları</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {campaign?.recurrence?.enabled && (
                    <p className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                      <b>{describeRecurrence({
                        every: campaign.recurrence.every,
                        unit: campaign.recurrence.unit,
                        atHour: campaign.recurrence.atHour,
                        atMinute: campaign.recurrence.atMinute,
                        byWeekday: campaign.recurrence.byWeekday,
                        byMonthDay: campaign.recurrence.byMonthDay,
                      })}</b>{' '}({campaign.recurrence.timezone}) · {campaign.recurrence.occurrence || 1}. koşu
                      {campaign.recurrence.spawnedNextAt
                        ? ' · sonraki koşu üretildi'
                        : ' · sonraki koşu bu yayın başlarken üretilecek'}
                    </p>
                  )}
                  <CampaignSeries id={id} />
                </CardContent>
              </Card>
            )}
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

              {/* Kapsama — kısmi yayından sonra "kim almadı". Kanal yayından
                  sonra büyüdüyse yeni üyeler de burada görünür. */}
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
                  <Progress value={delivery.coveredPercent} />
                  <p>
                    Listedeki {formatCount(delivery.channelTotal)} kişiden{' '}
                    <b>{formatCount(delivery.covered)}</b> kişiye gönderildi.
                    {delivery.remaining > 0 && (
                      <> <b>{formatCount(delivery.remaining)}</b> kişi bu kampanyayı henüz almadı.</>
                    )}
                  </p>
                </div>
              )}

              {/* TEK eylem. Yüzde ve zaman kararı çekmecenin içinde; zamanlanmışta
                  yanına iptal gelir (saati değiştirmenin tek yolu odur). */}
              {!isNew && (isDraft || isScheduled || isFinished) && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => { setPublishError(''); setPublishOpen(true); }}
                    disabled={!form.channelKey || !form.templateId}
                    title={!form.channelKey ? 'Önce alıcı listesi seçin' : undefined}
                  >
                    <Megaphone className="size-4" />
                    {isScheduled ? 'Zamanlamayı düzenle' : isFinished ? 'Kalanı yayına al' : 'Yayına al'}
                  </Button>
                  {isScheduled && (
                    confirmUnschedule ? (
                      <Button variant="destructive" onClick={doUnschedule} disabled={unscheduling}>
                        {unscheduling ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                        Emin?
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => setConfirmUnschedule(true)}>
                        <XCircle className="size-4" /> İptal et
                      </Button>
                    )
                  )}
                </div>
              )}
              {isDraft && !isNew && (
                <p className="text-[11px] text-muted-foreground">
                  Kimlere ve ne zaman gideceğini yayın ekranında seçersiniz.
                </p>
              )}
              {isNew && <p className="text-xs text-muted-foreground">Önce taslağı oluşturun; ardından yayınlayabilir veya zamanlayabilirsiniz.</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {!isNew && (
        <MailPreviewPanel campaignId={id} open={previewOpen} onClose={() => setPreviewOpen(false)} />
      )}

      {!isNew && (
        <CampaignPublishSheet
          open={publishOpen}
          onOpenChange={(v) => { setPublishOpen(v); if (!v) setPublishError(''); }}
          campaign={campaign}
          status={status}
          isFinished={isFinished}
          recipientCount={recipientCount}
          delivery={delivery}
          percent={publishPercent}
          setPercent={setPublishPercent}
          when={publishWhen}
          setWhen={setPublishWhen}
          form={form}
          setSC={setSC}
          setCB={setCB}
          setSched={setSched}
          rec={rec}
          setR={setR}
          busy={saving || sending || scheduling || continuing || savingRecurrence}
          error={publishError}
          onSubmit={submitPublish}
        />
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
