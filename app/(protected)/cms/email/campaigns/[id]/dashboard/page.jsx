'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, Loader2, RefreshCw, Eye, MousePointerClick, Send, Users, Pause, Play,
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
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetMailCampaignQuery,
  useGetMailCampaignStatsQuery,
  useGetMailCampaignRecipientsQuery,
  useGetMailCampaignTimeSeriesQuery,
  usePauseMailCampaignMutation,
  useResumeMailCampaignMutation,
} from '@/redux/services';

const PAGE = 25;
const numberFormatter = new Intl.NumberFormat('tr-TR');
const formatCount = (value) => numberFormatter.format(Number(value) || 0);
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const hhmm = (t) => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const ENGAGEMENT_TABS = [
  { key: 'all', label: 'Tümü' },
  { key: 'opened', label: 'Açanlar' },
  { key: 'clicked', label: 'Tıklayanlar' },
  { key: 'none', label: 'Tepkisiz' },
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
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [previewRecipient, setPreviewRecipient] = useState(null);

  const {
    data: campaign,
    isLoading: campaignLoading,
    isFetching: campaignFetching,
    refetch: refetchCampaign,
  } = useGetMailCampaignQuery(id, { skip: !authorized });

  const [pauseCampaign, { isLoading: pausing }] = usePauseMailCampaignMutation();
  const [resumeCampaign, { isLoading: resuming }] = useResumeMailCampaignMutation();
  const status = campaign?.status || 'draft';
  const isActive = ['queued', 'sending'].includes(status);
  const isPaused = status === 'paused';

  const {
    data: statsData,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useGetMailCampaignStatsQuery(id, { skip: !authorized });
  const stats = statsData?.stats;

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
    { id, page, limit: PAGE, engagement },
    { skip: !authorized }
  );
  const recipients = recipientsData?.items || [];
  const total = recipientsData?.total || 0;

  const changeEngagement = (key) => {
    setEngagement(key);
    setPage(1);
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

  const doResume = async () => {
    const r = await resumeCampaign(id).unwrap().catch((e) => ({ __err: e?.data?.message || 'Sürdürülemedi' }));
    if (r?.__err) return setNotice(r.__err);
    await refreshAll();
    setNotice(
      r?.requeued || r?.rescanned
        ? `Kampanya sürdürüldü (${(r.requeued || 0) + (r.rescanned || 0)} alıcı yeniden kuyruğa alındı).`
        : 'Kampanya sürdürüldü.'
    );
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
              <Button variant="outline" onClick={doResume} disabled={resuming}>
                {resuming ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Sürdür
              </Button>
            )}
          </div>
        }
      />

      {notice && <Alert variant="info" className="mb-4"><AlertDescription>{notice}</AlertDescription></Alert>}
      {campaign?.pausedReason && isPaused && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Duraklatıldı</AlertTitle>
          <AlertDescription>{campaign.pausedReason}</AlertDescription>
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
              <CardTitle>Alıcılar</CardTitle>
              <CardToolbar className="gap-2">
                {ENGAGEMENT_TABS.map((tab) => (
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
                <p className="py-10 text-center text-sm text-muted-foreground">Bu filtreye uyan alıcı yok.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alıcı</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Açıldı mı</TableHead>
                      <TableHead>Tıklandı mı</TableHead>
                      <TableHead>Son işlem</TableHead>
                      <TableHead className="text-right">Önizleme</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((r) => (
                      <TableRow key={r.to}>
                        <TableCell className="font-medium">{r.to}</TableCell>
                        <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                        <TableCell>
                          {r.openCount > 0 ? (
                            <span className="text-emerald-600">Evet · {r.openCount}× ({fmtDateTime(r.openedAt)})</span>
                          ) : (
                            <span className="text-muted-foreground">Hayır</span>
                          )}
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDateTime(r.firstClickAt || r.openedAt || r.sentAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPreviewRecipient(r.to)}
                            title="Bu alıcıya giden maili önizle"
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
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
    </RoleGuard>
  );
}
