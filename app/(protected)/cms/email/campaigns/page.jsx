'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2, Plus, RefreshCw, Trash2, Search, FilterX } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useDeleteMailCampaignMutation,
  useGetMailCampaignsQuery,
  useGetMailChannelsQuery,
} from '@/redux/services';

const statusMeta = {
  draft: { label: 'Taslak', variant: 'secondary' },
  scheduled: { label: 'Zamanlandı', variant: 'primary' },
  queued: { label: 'Kuyrukta', variant: 'primary' },
  sending: { label: 'Gönderiliyor', variant: 'primary' },
  sent: { label: 'Gönderildi', variant: 'success' },
  partial: { label: 'Kısmi', variant: 'warning' },
  failed: { label: 'Başarısız', variant: 'destructive' },
  paused: { label: 'Duraklatıldı', variant: 'warning' },
};

/**
 * Liste görünümleri. Varsayılan "Etkin" — bitmiş koşular listeyi boğuyordu
 * (tekrarlı bir kampanya her koşuda yeni bir "Gönderildi" satırı üretir).
 * Gruplar sunucudaki VIEW_STATUSES ile BİREBİR aynı olmalı
 * (tinnten-server/src/controller/mailCampaignController.js).
 */
const VIEWS = [
  { value: 'active', label: 'Etkin', hint: 'Taslak, zamanlanmış ve akan koşular' },
  { value: 'done', label: 'Tamamlanan', hint: 'Gönderildi, kısmi ve başarısız koşular' },
  { value: 'all', label: 'Tümü', hint: 'Bütün kampanyalar' },
];

// Durum seçenekleri görünüme göre daralır: "Etkin"te "Gönderildi" seçilebilse
// segment ile tablo çelişirdi.
const VIEW_STATUS_OPTIONS = {
  active: ['draft', 'scheduled', 'queued', 'sending', 'paused'],
  done: ['sent', 'partial', 'failed'],
  all: ['draft', 'scheduled', 'queued', 'sending', 'paused', 'sent', 'partial', 'failed'],
};

const RECURRING_OPTIONS = [
  { value: '', label: 'Tekrar: tümü' },
  { value: '1', label: 'Sadece tekrarlı' },
  { value: '0', label: 'Sadece tek seferlik' },
];

// Sunucu tavanı 500; tablo bu sayıya dayanırsa filtre daraltma uyarısı çıkar.
const LIST_LIMIT = 200;

const numberFormatter = new Intl.NumberFormat('tr-TR');
const formatCount = (value) => numberFormatter.format(Number(value) || 0);
const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
const WEEKDAY_SHORT = { 1: 'Pzt', 2: 'Sal', 3: 'Çar', 4: 'Per', 5: 'Cum', 6: 'Cmt', 7: 'Paz' };

/** "her hafta Pzt 09:00" / "her ayın son günü 10:00" — takvim çıpasını da gösterir. */
const formatRecurrence = (r = {}) => {
  const n = Number(r.every) || 1;
  const clock = `${String(r.atHour ?? 0).padStart(2, '0')}:${String(r.atMinute ?? 0).padStart(2, '0')}`;

  if (r.unit === 'hour') return `her ${n} saatte bir`;
  if (r.unit === 'week') {
    const days = (r.byWeekday || []).map((d) => WEEKDAY_SHORT[d]).filter(Boolean).join(', ');
    return `${n === 1 ? 'her hafta' : `${n} haftada bir`}${days ? ` ${days}` : ''} ${clock}`;
  }
  if (r.unit === 'month') {
    const d = Number(r.byMonthDay);
    const day = d === -1 ? 'son gün' : d ? `${d}.` : '';
    return `${n === 1 ? 'her ay' : `${n} ayda bir`}${day ? ` ${day}` : ''} ${clock}`;
  }
  return `${n === 1 ? 'her gün' : `${n} günde bir`} ${clock}`;
};

const formatStartAt = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : dateTimeFormatter.format(d);
};
const formatDuration = (min) => {
  const m = Number(min) || 0;
  if (!m) return '';
  if (m % 1440 === 0) return `${m / 1440} gün`;
  if (m % 60 === 0) return `${m / 60} saat`;
  return `${m} dk`;
};
const getProgress = (campaign) => {
  const audience = campaign.audience || {};
  const progress = campaign.progress || {};
  const total = Number(progress.total ?? audience.total ?? 0) || 0;
  const sent = Number(progress.sent ?? audience.sentCount ?? 0) || 0;
  const failed = Number(progress.failed ?? audience.failedCount ?? 0) || 0;
  // skipped tamamlanmış sayılır (sunucu semantiğiyle aynı) — sayılmazsa
  // bastırılmış alıcısı olan kampanya "Gönderildi" olduğu halde %83 görünür.
  const skipped = Number(progress.skipped ?? 0) || 0;
  const pending = Math.max(Number(progress.pending ?? progress.queued ?? audience.queuedCount ?? total - sent - failed) || 0, 0);
  const done = sent + failed + skipped;
  return {
    total,
    sent,
    failed,
    skipped,
    pending,
    percent: total ? Math.min(100, Math.round((done / total) * 100)) : 0,
  };
};

export default function CampaignsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const [notice, setNotice] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  // Filtreler SUNUCUDA uygulanır: istemcide filtrelemek limitle kırpılmış
  // sayfada arardı ve bitmiş koşuların maillog aggregation'ı boşa koşardı.
  const [view, setView] = useState('active');
  const [status, setStatus] = useState('');
  const [channelKey, setChannelKey] = useState('');
  const [recurring, setRecurring] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  // Basit debounce — her tuş vuruşunda istek atma.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const filtersActive = Boolean(status || channelKey || recurring || q) || view !== 'active';

  const { data: allChannels = [] } = useGetMailChannelsQuery({}, { skip: !authorized });
  // Kampanya tek bir YAPRAK kanala gider (bkz. mail-channel.model.js parentKey) —
  // grup seçeneği her zaman 0 sonuç verirdi, o yüzden listelenmez.
  const groupKeys = new Set(allChannels.map((c) => c.parentKey).filter(Boolean));
  const channels = allChannels.filter(
    (c) => c.metadata?.isGroup !== true && !groupKeys.has(c.key),
  );

  const {
    data: campaigns = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetMailCampaignsQuery(
    {
      view,
      limit: LIST_LIMIT,
      ...(status ? { status } : {}),
      ...(channelKey ? { channelKey } : {}),
      ...(recurring ? { recurring } : {}),
      ...(q ? { q } : {}),
    },
    { skip: !authorized },
  );
  const [deleteCampaign, { isLoading: deleting }] = useDeleteMailCampaignMutation();

  const resetFilters = () => {
    setView('active');
    setStatus('');
    setChannelKey('');
    setRecurring('');
    setQInput('');
    setQ('');
  };

  const handleRefresh = async () => {
    await refetch();
    setNotice({ variant: 'info', message: 'Kampanya durumları yenilendi.' });
  };

  const handleDelete = async (campaign) => {
    const result = await deleteCampaign(campaign._id)
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Kampanya kaldırılamadı.' }));
    setConfirmId(null);
    if (result?.__err) {
      setNotice({ variant: 'destructive', message: result.__err });
      return;
    }
    setNotice({ variant: 'info', message: result?.message || 'Taslak kampanya silindi.' });
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Kampanyalar"
        description="Kanal + şablon seçip onaylı kullanıcılara toplu mail gönderin"
        actions={
          <Link href="/cms/email/campaigns/new">
            <Button><Plus className="size-4" /> Yeni Kampanya</Button>
          </Link>
        }
      />

      {notice?.message && (
        <Alert variant={notice.variant || 'info'} className="mb-4">
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Kampanyalar</CardTitle>
          <CardToolbar className="gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
              {isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Yenile
            </Button>
            <Badge variant="muted" title={`${VIEWS.find((v) => v.value === view)?.label} görünümü`}>
              {campaigns.length}
            </Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          {/* Filtre çubuğu */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <div className="flex rounded-md border border-input p-0.5">
              {VIEWS.map((v) => (
                <Button
                  key={v.value}
                  size="sm"
                  variant={view === v.value ? 'primary' : 'ghost'}
                  title={v.hint}
                  onClick={() => {
                    setView(v.value);
                    // Durum seçenekleri gruba bağlı — görünüm değişince sıfırlanmalı.
                    setStatus('');
                  }}
                >
                  {v.label}
                </Button>
              ))}
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Durum: tümü</option>
              {VIEW_STATUS_OPTIONS[view].map((s) => (
                <option key={s} value={s}>{statusMeta[s]?.label || s}</option>
              ))}
            </select>

            <select
              value={channelKey}
              onChange={(e) => setChannelKey(e.target.value)}
              className="h-8 max-w-[220px] rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Kanal: tümü</option>
              {channels.map((c) => (
                <option key={c._id} value={c.key}>{c.title || c.key}</option>
              ))}
            </select>

            <select
              value={recurring}
              onChange={(e) => setRecurring(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/30"
            >
              {RECURRING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Kampanya adında ara…"
                className="h-8 pl-8 text-xs"
              />
            </div>

            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={resetFilters} title="Filtreleri temizle">
                <FilterX className="size-3.5" /> Temizle
              </Button>
            )}
          </div>

          {error ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription></Alert></div>
          ) : isLoading ? (
            <div className="space-y-1 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : campaigns.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {filtersActive ? (
                <>
                  <p>Bu filtreye uyan kampanya yok.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={resetFilters}>
                    <FilterX className="size-3.5" /> Filtreleri temizle
                  </Button>
                </>
              ) : (
                <p>Etkin kampanya yok. Tamamlanmış koşular için <b>Tamamlanan</b> filtresine bakın.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İlerleme</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => {
                  const m = statusMeta[c.status] || { label: c.status, variant: 'muted' };
                  const progress = getProgress(c);
                  return (
                    <TableRow key={c._id}>
                      <TableCell className="font-medium">
                        <Link
                          // scheduled da edit sayfasına: dashboard'da iptal kontrolü yok.
                          href={['draft', 'scheduled'].includes(c.status) ? `/cms/email/campaigns/${c._id}` : `/cms/email/campaigns/${c._id}/dashboard`}
                          className="text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                        {c.recurrence?.enabled && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            Tekrarlı · {c.recurrence.occurrence || 1}. koşu ·{' '}
                            {formatRecurrence(c.recurrence)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell><span className="font-mono text-xs">{c.channelKey}</span></TableCell>
                      <TableCell>
                        <Badge variant={m.variant}>{m.label}</Badge>
                        {c.status === 'scheduled' && c.schedule?.startAt && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatStartAt(c.schedule.startAt)}
                            {c.schedule.durationMinutes ? ` · ${formatDuration(c.schedule.durationMinutes)} yayılır` : ''}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        {progress.total ? (
                          <div className="space-y-1.5">
                            <Progress value={progress.percent} indicatorClassName={progress.failed ? 'bg-amber-500' : undefined} />
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{formatCount(progress.sent)}/{formatCount(progress.total)}</span>
                              {progress.pending > 0 && <span>Kuyrukta {formatCount(progress.pending)}</span>}
                              {progress.failed > 0 && <span className="text-destructive">{formatCount(progress.failed)} hata</span>}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.status === 'draft' ? (
                          confirmId === c._id ? (
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(c)} disabled={deleting}>
                              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : 'Emin?'}
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setConfirmId(c._id)} title="Taslağı kaldır">
                              <Trash2 className="size-3.5" />
                            </Button>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Sunucu tavanına dayandıysa liste kırpılmış olabilir — sessiz kesme
              "hepsi bu" gibi okunur, o yüzden açıkça söylenir. */}
          {campaigns.length >= LIST_LIMIT && (
            <p className="border-t border-border p-3 text-xs text-muted-foreground">
              İlk {formatCount(LIST_LIMIT)} kampanya gösteriliyor — daha fazlası olabilir.
              Kanal, durum veya ad filtresiyle daraltın.
            </p>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
