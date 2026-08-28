'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, Loader2, RefreshCw, Eye, MousePointerClick, Send, Users, Pause, Play,
  CheckCircle2, RotateCcw, SendHorizontal,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MailPreviewPanel } from '@/components/email/mail-preview-panel';
import { CampaignPublishSheet } from '@/components/email/campaign-publish-sheet';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetMailCampaignQuery,
  useGetMailCampaignStatsQuery,
  useGetMailCampaignRecipientsQuery,
  useSkipMailCampaignRecipientMutation,
  useSuppressMailCampaignRecipientMutation,
  useGetMailCampaignTimeSeriesQuery,
  usePauseMailCampaignMutation,
  useResumeMailCampaignMutation,
  useUpdateMailCampaignMutation,
  useFinishMailCampaignMutation,
  useRestartMailCampaignMutation,
  useContinueMailCampaignMutation,
} from '@/redux/services';

const PAGE = 25;
const numberFormatter = new Intl.NumberFormat('tr-TR');
const formatCount = (value) => numberFormatter.format(Number(value) || 0);
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatRemaining = (ms) => {
  const seconds = Math.max(0, Math.ceil(Number(ms) / 1000));
  if (seconds < 1) return '< 1 sn';
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} dk ${seconds % 60} sn` : `${seconds} sn`;
};
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const formatDuration = (minutes) => {
  const n = Number(minutes) || 0;
  if (!n) return 'Tek seferde';
  if (n % 1440 === 0) return `${n / 1440} gün`;
  if (n % 60 === 0) return `${n / 60} saat`;
  return `${n} dakika`;
};
const hhmm = (t) => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const ENGAGEMENT_TABS = [
  { key: 'all', label: 'Tümü' },
  { key: 'opened', label: 'Açanlar' },
  { key: 'clicked', label: 'Tıklayanlar' },
  { key: 'none', label: 'Tepkisiz' },
];

const DELIVERY_TABS = [
  { key: 'sent', label: 'Gönderilenler' },
  { key: 'queued', label: 'Kuyruktakiler' },
  { key: 'unsent', label: 'Gönderilmeyenler' },
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

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-semibold leading-tight">{value}</div>
          <div className="truncate text-xs text-muted-foreground">{label}{sub ? ` · ${sub}` : ''}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CampaignDashboardPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const [engagement, setEngagement] = useState('all');
  const [deliveryState, setDeliveryState] = useState('sent');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [previewRecipient, setPreviewRecipient] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [replanOpen, setReplanOpen] = useState(false);
  const [replanWhen, setReplanWhen] = useState('now');
  const [replanError, setReplanError] = useState('');
  const [replanForm, setReplanForm] = useState({
    channelKey: '',
    sendConfig: {
      ratePerSec: 5,
      batchSize: 500,
      maxRecipients: '',
      fromAddress: '',
      maxPerRecipientPerDay: 1,
      circuitBreaker: { enabled: true, bounceRatePct: 3, complaintRatePct: 0.08 },
    },
    schedule: { startAt: '', durationMinutes: '' },
  });

  const {
    data: campaign,
    isLoading: campaignLoading,
    isFetching: campaignFetching,
    refetch: refetchCampaign,
  } = useGetMailCampaignQuery(id, { skip: !authorized });

  const [pauseCampaign, { isLoading: pausing }] = usePauseMailCampaignMutation();
  const [resumeCampaign, { isLoading: resuming }] = useResumeMailCampaignMutation();
  const [updateCampaign, { isLoading: updatingCampaign }] = useUpdateMailCampaignMutation();
  const [finishCampaign, { isLoading: finishing }] = useFinishMailCampaignMutation();
  const [restartCampaign, { isLoading: restarting }] = useRestartMailCampaignMutation();
  const [continueCampaign, { isLoading: continuing }] = useContinueMailCampaignMutation();
  const [skipRecipient, { isLoading: skipping }] = useSkipMailCampaignRecipientMutation();
  const [suppressRecipient, { isLoading: suppressing }] = useSuppressMailCampaignRecipientMutation();
  const status = campaign?.status || 'draft';
  const isActive = ['queued', 'sending'].includes(status);
  const isPaused = status === 'paused';
  const isTerminal = ['sent', 'partial', 'failed'].includes(status);

  /**
   * Kampanya kitle tükenmeden kapanmaz: bir parti bitince backend `partial` +
   * `completion.reason:"batch_done"` yazar ve kalan sayısını taşır. Eskiden
   * doğrudan "Gönderildi" oluyordu ve listenin %95'i mail almadığı hiçbir
   * yerde görünmüyordu — bu yüzden bekleyen sayısı rozete kadar taşınıyor.
   */
  const waiting = Number(campaign?.completion?.remaining) || 0;
  const isWaiting = campaign?.completion?.reason === 'batch_done' && waiting > 0;
  // Yarım kalmış her yayın bitirilebilir; zaten tükenmişe "Bitir" göstermek anlamsız.
  const canFinish = (isTerminal || isPaused) && waiting > 0;

  const {
    data: statsData,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useGetMailCampaignStatsQuery(id, {
    skip: !authorized,
    // Sayaç sıfıra ulaştığında yeni dispatch sırasını al. Mail başına sorgu
    // yok; aktif dashboard açıkken sabit 5 saniyelik hafif polling yapılır.
    pollingInterval: isActive ? 5000 : 0,
  });
  const stats = statsData?.stats;
  const nextDelivery = statsData?.delivery?.nextDelivery;
  const nextDeliveryRemaining = nextDelivery?.estimatedAt
    ? Math.max(new Date(nextDelivery.estimatedAt).getTime() - now, 0)
    : 0;

  const openReplan = () => {
    const sc = campaign?.sendConfig || {};
    setReplanForm({
      channelKey: campaign?.channelKey || '',
      sendConfig: {
        ratePerSec: sc.ratePerSec ?? 5,
        batchSize: sc.batchSize ?? 500,
        maxRecipients: sc.maxRecipients ?? '',
        fromAddress: sc.fromAddress ?? '',
        maxPerRecipientPerDay: sc.maxPerRecipientPerDay ?? 1,
        circuitBreaker: {
          enabled: sc.circuitBreaker?.enabled !== false,
          bounceRatePct: sc.circuitBreaker?.bounceRatePct ?? 3,
          complaintRatePct: sc.circuitBreaker?.complaintRatePct ?? 0.08,
        },
      },
      // Eski başlangıç tarihi geçmişte olabilir; yeni tarih operatör
      // tarafından seçilir. Önceki yayılma süresi korunur.
      schedule: {
        startAt: '',
        durationMinutes: campaign?.schedule?.durationMinutes
          ? String(campaign.schedule.durationMinutes)
          : '',
      },
    });
    setReplanWhen('now');
    setReplanError('');
    setReplanOpen(true);
  };

  useEffect(() => {
    if (!nextDelivery?.estimatedAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [nextDelivery?.estimatedAt]);

  const {
    data: series = [],
    isFetching: seriesFetching,
    refetch: refetchSeries,
  } = useGetMailCampaignTimeSeriesQuery(id, { skip: !authorized });

  const {
    data: recipientsData,
    isFetching: recipientsFetching,
    refetch: refetchRecipients,
  } = useGetMailCampaignRecipientsQuery(
    { id, page, limit: PAGE, engagement, deliveryState },
    { skip: !authorized }
  );
  const recipients = recipientsData?.items || [];
  const total = recipientsData?.total || 0;

  const changeEngagement = (key) => {
    setEngagement(key);
    setPage(1);
  };

  const changeDeliveryState = (key) => {
    setDeliveryState(key);
    setPage(1);
    // Gönderilmeyen listesinde açılma/tıklama anlamlı değildir.
    if (key === 'unsent') setEngagement('all');
  };

  const refreshAll = async () => {
    await Promise.all([
      refetchCampaign(),
      refetchStats().catch(() => null),
      refetchSeries().catch(() => null),
      refetchRecipients().catch(() => null),
    ]);
  };

  const doPause = async () => {
    const r = await pauseCampaign(id).unwrap().catch((e) => ({ __err: e?.data?.message || 'Duraklatılamadı' }));
    if (r?.__err) return setNotice(r.__err);
    await refreshAll();
    setNotice('Kampanya duraklatıldı.');
  };

  const setReplanSC = (key, value) => setReplanForm((current) => ({
    ...current,
    sendConfig: { ...current.sendConfig, [key]: value },
  }));
  const setReplanCB = (key, value) => setReplanForm((current) => ({
    ...current,
    sendConfig: {
      ...current.sendConfig,
      circuitBreaker: { ...current.sendConfig.circuitBreaker, [key]: value },
    },
  }));
  const setReplanSchedule = (key, value) => setReplanForm((current) => ({
    ...current,
    schedule: { ...current.schedule, [key]: value },
  }));

  const submitReplan = async () => {
    setReplanError('');
    const startAt = replanWhen === 'at' && replanForm.schedule.startAt
      ? new Date(replanForm.schedule.startAt).toISOString()
      : null;
    if (replanWhen === 'at' && !startAt) {
      return setReplanError('Yeni başlangıç tarihini seçin.');
    }
    if (startAt && new Date(startAt).getTime() <= Date.now()) {
      return setReplanError('Yeni başlangıç tarihi gelecekte olmalı.');
    }
    const durationMinutes = Number(replanForm.schedule.durationMinutes) || null;
    const currentSC = campaign?.sendConfig || {};
    const sendConfig = {
      ratePerSec: Number(replanForm.sendConfig.ratePerSec) || 5,
      batchSize: Number(replanForm.sendConfig.batchSize) || 500,
      maxRecipients: replanForm.sendConfig.maxRecipients
        ? Number(replanForm.sendConfig.maxRecipients)
        : null,
      fromAddress: replanForm.sendConfig.fromAddress?.trim() || null,
      maxPerRecipientPerDay: replanForm.sendConfig.maxPerRecipientPerDay === ''
        ? 1
        : Math.max(0, Number(replanForm.sendConfig.maxPerRecipientPerDay) || 0),
      excludePriorRecipients: currentSC.excludePriorRecipients === true,
      samplePercent: currentSC.samplePercent ?? null,
      circuitBreaker: {
        enabled: replanForm.sendConfig.circuitBreaker.enabled !== false,
        bounceRatePct: Number(replanForm.sendConfig.circuitBreaker.bounceRatePct) || 3,
        complaintRatePct: Number(replanForm.sendConfig.circuitBreaker.complaintRatePct) || 0.08,
      },
    };
    const schedule = { startAt, durationMinutes };
    const saved = await updateCampaign({ id, sendConfig, schedule })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Planlama ayarları kaydedilemedi' }));
    if (saved?.__err) return setReplanError(saved.__err);

    const result = await resumeCampaign({ id, ...schedule })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Kampanya yeniden planlanamadı' }));
    if (result?.__err) return setReplanError(result.__err);
    setReplanOpen(false);
    await refreshAll();
    return setNotice(
      result?.scheduled
        ? `Kalan alıcılar için kampanya ${fmtDateTime(result.startAt)} tarihine yeniden planlandı.`
        : `Kampanya hemen başlatıldı; ${formatCount(result?.planned || 0)} kalan alıcı${durationMinutes ? ` ${formatDuration(durationMinutes)} içine eşit yayılarak` : ''} gönderilecek.`,
    );
  };

  const doContinue = async () => {
    const r = await continueCampaign({ id, percent: 100 })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Devam ettirilemedi' }));
    if (r?.__err) return setNotice(r.__err);
    await refreshAll();
    setNotice(r?.queued ? `${formatCount(r.queued)} alıcı kuyruğa alındı.` : 'Gönderilecek yeni alıcı bulunamadı.');
  };

  const doFinish = async () => {
    // Kalan kitleye bir daha gidilmeyeceği için onay alınır; geri alınabilir
    // ama "bitti" etiketi raporlara yansır.
    if (!window.confirm(`Kampanya bitirilecek. Kalan ${formatCount(waiting)} kişiye GÖNDERİLMEYECEK. Onaylıyor musunuz?`)) return;
    const r = await finishCampaign(id).unwrap().catch((e) => ({ __err: e?.data?.message || 'Bitirilemedi' }));
    if (r?.__err) return setNotice(r.__err);
    await refreshAll();
    setNotice(r?.remaining ? `Kampanya bitirildi. ${formatCount(r.remaining)} kişiye gönderilmedi.` : 'Kampanya bitirildi.');
  };

  const doRestart = async () => {
    // YIKICI: maillog satırları silinir → açılma/tıklama geçmişi gider ve aynı
    // kişilere yeniden mail gidebilir. Yazılı onay istenmesinin sebebi bu.
    const answer = window.prompt('Baştan başlatmak tüm gönderim ve tıklama geçmişini SİLER; aynı kişilere yeniden mail gidebilir. Onaylamak için BAŞTAN yazın:');
    if ((answer || '').trim().toLocaleUpperCase('tr-TR') !== 'BAŞTAN') return;
    const r = await restartCampaign(id).unwrap().catch((e) => ({ __err: e?.data?.message || 'Baştan başlatılamadı' }));
    if (r?.__err) return setNotice(r.__err);
    await refreshAll();
    setNotice(`Kampanya taslağa döndürüldü. ${formatCount(r?.clearedLogs || 0)} gönderim kaydı silindi.`);
  };

  const doSkipRecipient = async (email) => {
    if (!window.confirm(`${email} bu kampanyanın kuyruğundan atlanacak. Onaylıyor musunuz?`)) return;
    const r = await skipRecipient({ id, email }).unwrap().catch((e) => ({ __err: e?.data?.message || 'Alıcı atlanamadı' }));
    if (r?.__err) return setNotice(r.__err);
    await Promise.all([refetchRecipients(), refetchStats().catch(() => null), refetchCampaign()]);
    setNotice(`${email} kuyruktan atlandı.`);
  };

  const doSuppressRecipient = async (email) => {
    if (!window.confirm(`${email} kuyruktan çıkarılıp GLOBAL kara listeye alınacak. Bu adres sonraki kampanyalarda da mail almaz. Onaylıyor musunuz?`)) return;
    const r = await suppressRecipient({ id, email }).unwrap().catch((e) => ({ __err: e?.data?.message || 'Adres kara listeye alınamadı' }));
    if (r?.__err) return setNotice(r.__err);
    await Promise.all([refetchRecipients(), refetchStats().catch(() => null), refetchCampaign()]);
    setNotice(`${email} kuyruktan çıkarıldı ve kara listeye alındı.`);
  };

  const busy = campaignFetching || statsFetching || seriesFetching || recipientsFetching;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email · Kampanya Dashboard"
        title={campaign?.name || 'Kampanya'}
        description="Görüntülenme, tıklama ve alıcı bazlı geri dönüş takibi"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!campaignLoading && (
              <Badge variant={(STATUS_META[status] || {}).variant || 'secondary'}>
                {(STATUS_META[status] || {}).label || status}
                {isWaiting ? ` · ${formatCount(waiting)} bekliyor` : ''}
              </Badge>
            )}
            <Link href="/cms/email/campaigns"><Button variant="outline"><ArrowLeft className="size-4" /> Liste</Button></Link>
            <Button variant="outline" onClick={refreshAll} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Yenile
            </Button>
            {isActive && (
              <Button variant="outline" onClick={doPause} disabled={pausing}>
                {pausing ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />} Duraklat
              </Button>
            )}
            {isPaused && (
              <Button variant="outline" onClick={openReplan} disabled={resuming || updatingCampaign}>
                {resuming || updatingCampaign
                  ? <Loader2 className="size-4 animate-spin" />
                  : <Play className="size-4" />}
                Yeniden planla / sürdür
              </Button>
            )}
            {isTerminal && waiting > 0 && (
              <Button onClick={doContinue} disabled={continuing}>
                {continuing ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />} Devam Et
              </Button>
            )}
            {canFinish && (
              <Button variant="outline" onClick={doFinish} disabled={finishing}>
                {finishing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Bitir
              </Button>
            )}
            {(isTerminal || isPaused) && (
              <Button variant="outline" onClick={doRestart} disabled={restarting}>
                {restarting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Baştan Başlat
              </Button>
            )}
          </div>
        }
      />

      {notice && <Alert variant="info" className="mb-4"><AlertDescription>{notice}</AlertDescription></Alert>}
      {isWaiting && (
        <Alert variant="warning" className="mb-4">
          <AlertTitle>Kampanya tamamlanmadı — {formatCount(waiting)} kişi bekliyor</AlertTitle>
          <AlertDescription>
            {campaign?.pausedReason
              || `Bu partinin gönderimi bitti. Listede henüz mail almamış ${formatCount(waiting)} kişi var.`}
            {' '}Kalanlara göndermek için “Devam Et”, kampanyayı burada kapatmak için “Bitir”.
          </AlertDescription>
        </Alert>
      )}
      {campaign?.pausedReason && isPaused && campaign?.completion?.reason !== 'batch_done' && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Duraklatıldı</AlertTitle>
          <AlertDescription>{campaign.pausedReason}</AlertDescription>
        </Alert>
      )}
      {nextDelivery && (
        <Alert variant="info" className="mb-4">
          <AlertTitle>Sonraki mail yaklaşık {formatRemaining(nextDeliveryRemaining)} sonra kuyruğa alınacak</AlertTitle>
          <AlertDescription>Kuyruk yoğunluğu veya mail sağlayıcısı nedeniyle süre değişebilir.</AlertDescription>
        </Alert>
      )}

      {campaignLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={Send} label="Gönderildi" value={formatCount(stats?.sent)} />
            <StatCard icon={Eye} label="Açılma" value={formatCount(stats?.opened)} sub={formatPercent(stats?.openRate)} />
            <StatCard icon={MousePointerClick} label="Tıklama" value={formatCount(stats?.clicked)} sub={formatPercent(stats?.clickRate)} />
            <StatCard icon={Users} label="Alıcı" value={formatCount(stats?.total)} />
          </div>

          <Card>
            <CardHeader><CardTitle>Yayınlanma şartları</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Planlanan başlangıç</div>
                <div className="mt-1 font-medium">
                  {fmtDateTime(campaign?.schedule?.startAt || campaign?.dispatch?.startedAt || campaign?.sentAt)}
                </div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Gerçek ilk başlangıç</div>
                <div className="mt-1 font-medium">{fmtDateTime(campaign?.sentAt || campaign?.dispatch?.startedAt)}</div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Yayılma planı</div>
                <div className="mt-1 font-medium">{formatDuration(campaign?.schedule?.durationMinutes)}</div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Gönderim hızı</div>
                <div className="mt-1 font-medium">{campaign?.sendConfig?.ratePerSec || 5} mail/sn</div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Batch boyutu</div>
                <div className="mt-1 font-medium">{formatCount(campaign?.sendConfig?.batchSize || 500)}</div>
              </div>
              <div className="rounded-md border border-border p-3 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Gönderen</div>
                <div className="mt-1 truncate font-medium">{campaign?.sendConfig?.fromAddress || 'Varsayılan gönderen'}</div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Kalan alıcı</div>
                <div className="mt-1 font-medium">
                  {formatCount((Number(statsData?.delivery?.remaining) || 0) + (Number(stats?.queued) || 0))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Açılma / Tıklama Zaman Grafiği</CardTitle></CardHeader>
            <CardContent>
              {seriesFetching && series.length === 0 ? (
                <Skeleton className="h-64 w-full" />
              ) : series.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Henüz açılma/tıklama verisi yok.</p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="g-opens" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="g-clicks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                      <XAxis dataKey="t" tickFormatter={hhmm} tick={{ fontSize: 11 }} minTickGap={50} />
                      <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
                      <Tooltip labelFormatter={hhmm} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === 'opens' ? 'Açılma' : 'Tıklama')} />
                      <Area type="monotone" dataKey="opens" name="opens" stroke="#3b82f6" strokeWidth={2} fill="url(#g-opens)" />
                      <Area type="monotone" dataKey="clicks" name="clicks" stroke="#10b981" strokeWidth={2} fill="url(#g-clicks)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {stats?.buttons?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Buton Kırılımı</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Buton</TableHead>
                      <TableHead className="text-right">Tıklama</TableHead>
                      <TableHead className="text-right">Kişi</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.buttons.map((b) => (
                      <TableRow key={b.buttonId || 'unknown'}>
                        <TableCell className="font-mono text-xs">{b.buttonId || 'unknown'}</TableCell>
                        <TableCell className="text-right">{formatCount(b.clicks)}</TableCell>
                        <TableCell className="text-right">{formatCount(b.uniqueClicks)}</TableCell>
                        <TableCell className="text-right">{formatPercent(b.ctr)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {deliveryState === 'sent'
                  ? 'Gönderilenler'
                  : deliveryState === 'queued'
                    ? 'Kuyruktakiler'
                    : 'Gönderilmeyenler'}
              </CardTitle>
              <CardToolbar className="gap-2">
                {DELIVERY_TABS.map((tab) => (
                  <Button
                    key={tab.key}
                    size="sm"
                    variant={deliveryState === tab.key ? 'default' : 'outline'}
                    onClick={() => changeDeliveryState(tab.key)}
                  >
                    {tab.label}
                  </Button>
                ))}
                {deliveryState === 'sent' && ENGAGEMENT_TABS.map((tab) => (
                  <Button
                    key={tab.key}
                    size="sm"
                    variant={engagement === tab.key ? 'default' : 'outline'}
                    onClick={() => changeEngagement(tab.key)}
                  >
                    {tab.label}
                  </Button>
                ))}
                <Badge variant="muted">{formatCount(total)}</Badge>
              </CardToolbar>
            </CardHeader>
            <CardContent className="p-0">
              {recipientsFetching && recipients.length === 0 ? (
                <div className="space-y-1 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : recipients.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Bu listede alıcı yok.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alıcı</TableHead>
                      <TableHead>Durum</TableHead>
                      {deliveryState === 'sent' && <TableHead>Açıldı mı</TableHead>}
                      {deliveryState === 'sent' && <TableHead>Tıklandı mı</TableHead>}
                      <TableHead>{deliveryState === 'sent' ? 'Son işlem' : deliveryState === 'queued' ? 'Kuyruğa alındı' : 'Kuyruk durumu'}</TableHead>
                      {deliveryState === 'sent' && <TableHead className="text-right">Önizleme</TableHead>}
                      {deliveryState === 'queued' && <TableHead className="text-right">İşlem</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((r) => (
                      <TableRow key={r.to}>
                        <TableCell className="font-medium">{r.to}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {r.status === 'not_targeted' ? 'Sırası bekliyor' : r.status}
                          </Badge>
                        </TableCell>
                        {deliveryState === 'sent' && <TableCell>
                          {r.openCount > 0 ? (
                            <span className="text-emerald-600">Evet · {r.openCount}× ({fmtDateTime(r.openedAt)})</span>
                          ) : (
                            <span className="text-muted-foreground">Hayır</span>
                          )}
                        </TableCell>}
                        {deliveryState === 'sent' && <TableCell>
                          {r.clickCount > 0 ? (
                            <span className="text-emerald-600">
                              Evet · {r.clickCount}× ({fmtDateTime(r.firstClickAt)})
                              {r.clickedButtons?.length > 0 && (
                                <span className="ml-1 text-xs text-muted-foreground">[{r.clickedButtons.join(', ')}]</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Hayır</span>
                          )}
                        </TableCell>}
                        <TableCell className="text-xs text-muted-foreground">
                          {deliveryState === 'sent'
                            ? fmtDateTime(r.firstClickAt || r.openedAt || r.sentAt)
                            : deliveryState === 'queued'
                              ? (r.sentAt ? fmtDateTime(r.sentAt) : 'Gönderim sırası bekleniyor')
                              : (r.status === 'not_targeted' ? 'Henüz hedeflenmedi' : `${r.status}${r.error ? ` · ${r.error}` : ''}`)}
                        </TableCell>
                        {deliveryState === 'sent' && <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPreviewRecipient(r.to)}
                            title="Bu alıcıya giden maili önizle"
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>}
                        {deliveryState === 'queued' && <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={skipping || suppressing}
                            onClick={() => doSkipRecipient(r.to)}
                          >
                            Bu maili atla
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-2 text-destructive hover:text-destructive"
                            disabled={skipping || suppressing}
                            onClick={() => doSuppressRecipient(r.to)}
                          >
                            Kara listeye al
                          </Button>
                        </TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {total > PAGE && (
                <div className="flex items-center justify-between border-t border-border p-3 text-xs text-muted-foreground">
                  <span>{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} / {formatCount(total)}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Önceki</Button>
                    <Button size="sm" variant="outline" disabled={page * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Sonraki</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <MailPreviewPanel
        campaignId={id}
        initialAs={previewRecipient}
        open={Boolean(previewRecipient)}
        onClose={() => setPreviewRecipient(null)}
      />
      <CampaignPublishSheet
        open={replanOpen}
        onOpenChange={(open) => { setReplanOpen(open); if (!open) setReplanError(''); }}
        campaign={campaign}
        status={status}
        isFinished={false}
        isPaused={isPaused}
        recipientCount={Number(statsData?.delivery?.channelTotal || stats?.total || 0)}
        delivery={{
          ...(statsData?.delivery || {}),
          covered: Number(stats?.sent) || 0,
          remaining: (Number(statsData?.delivery?.remaining) || 0) + (Number(stats?.queued) || 0),
        }}
        percent="100"
        setPercent={() => {}}
        when={replanWhen}
        setWhen={setReplanWhen}
        form={replanForm}
        setSC={setReplanSC}
        setCB={setReplanCB}
        setSched={setReplanSchedule}
        rec={{ enabled: false, unit: 'day', byWeekday: [] }}
        setR={() => {}}
        busy={resuming || updatingCampaign}
        error={replanError}
        onSubmit={submitReplan}
      />
    </RoleGuard>
  );
}
