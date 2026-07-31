'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, Clock, Database, Play, RefreshCw, Settings2, Users, Loader2,
  UserCheck, UserMinus, ListChecks, Send,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip,
} from 'recharts';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetMailChannelsQuery,
  useGetChannelStatsQuery,
  useGetCronListsQuery,
  useRunCronListMutation,
  useGetMailCampaignsQuery,
} from '@/redux/services';
import { MemberListDialog } from '@/components/email/member-list-dialog';
import { toCategorySegments, categoryMeta } from '@/lib/unsubscribeReasons';

const isManualList = (channel) => channel?.type === 'custom' || channel?.type === 'private';
const countFormatter = new Intl.NumberFormat('tr-TR');
const formatCount = (value) => countFormatter.format(Number(value) || 0);
const pct = (part, whole) => (whole > 0 ? Math.round((Number(part) / whole) * 100) : 0);

const SOURCE_LABELS = { company: 'Firmalar', users: 'Kullanıcılar', products: 'Ürünler' };
const RECIPE_STATUS_META = {
  active: { label: 'Aktif', variant: 'success' },
  paused: { label: 'Duraklatıldı', variant: 'muted' },
  provisioning: { label: 'Hazırlanıyor', variant: 'muted' },
};
const BUILD_MODE_LABELS = {
  append: 'Biriktir (aynı liste)',
  replace: 'Yenile (aynı liste)',
  new: 'Her döngüde yeni tarihli liste',
};
const CAMPAIGN_STATUS_META = {
  draft: { label: 'Taslak', variant: 'muted' },
  queued: { label: 'Kuyrukta', variant: 'secondary' },
  sending: { label: 'Gönderiliyor', variant: 'secondary' },
  sent: { label: 'Gönderildi', variant: 'success' },
  partial: { label: 'Kısmi', variant: 'warning' },
  failed: { label: 'Başarısız', variant: 'destructive' },
  paused: { label: 'Duraklatıldı', variant: 'warning' },
};

function StatCard({ icon: Icon, label, value, sub, tone = 'primary' }) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
  }[tone] || 'bg-primary/10 text-primary';
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
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

/** Çıkış nedenleri — donut + kategori legend. */
function ReasonBreakdown({ stats }) {
  const segments = toCategorySegments(stats?.categories);
  const unsub = Number(stats?.unsubscribed) || 0;

  if (unsub === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Bu listeden çıkan/çıkarılan üye yok — liste tertemiz.
      </p>
    );
  }

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
      <div className="relative h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
              stroke="none"
            >
              {segments.map((s) => <Cell key={s.key} fill={s.color} />)}
            </Pie>
            <ReTooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(value, name) => [`${formatCount(value)} kişi`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold leading-none">{formatCount(unsub)}</span>
          <span className="text-xs text-muted-foreground">çıkan</span>
        </div>
      </div>
      <ul className="space-y-2">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="flex-1">{s.label}</span>
            <span className="font-medium">{formatCount(s.value)}</span>
            <span className="w-10 text-right text-xs text-muted-foreground">%{pct(s.value, unsub)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ListDashboardPage() {
  const { key } = useParams();
  const channelKey = String(key || '').toLowerCase();
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data: channels = [] } = useGetMailChannelsQuery({ all: 'true' }, { skip: !authorized });
  const channel = channels.find((ch) => ch.key === channelKey);
  const isArchived = channel?.status === 'archived';
  const isCron = channel?.type === 'cron';

  const {
    data: stats, isLoading: statsLoading, isFetching: statsFetching, refetch: refetchStats,
  } = useGetChannelStatsQuery(channelKey, { skip: !authorized || !channelKey });

  const { data: cronLists = [] } = useGetCronListsQuery({}, { skip: !authorized || !isCron });
  const recipe = isCron ? cronLists.find((r) => r.channelKey === channelKey) : null;
  const [runCron, { isLoading: running }] = useRunCronListMutation();

  // Bu listeye (channelKey) gönderilen kampanyalar. Kampanyalar tek bir yaprak
  // kanala gider; backend filtre uçu yok → tüm kampanya listesini çekip (≤200-500,
  // cache'li) client-side süzeriz. Grup satırları detaya gelmez (üye yönetimi yok).
  const { data: allCampaigns = [] } = useGetMailCampaignsQuery(undefined, { skip: !authorized });
  const listCampaigns = allCampaigns.filter((c) => c.channelKey === channelKey);

  const [membersOpen, setMembersOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const handleRunCron = async () => {
    if (!recipe?._id) return;
    const r = await runCron(recipe._id).unwrap().catch((e) => ({ __err: e?.data?.message || 'Tetiklenemedi' }));
    setNotice(r?.__err || 'Cron listesi tetiklendi — üyeler arka planda güncelleniyor.');
  };

  const subscribed = Number(stats?.subscribed) || 0;
  const unsubscribed = Number(stats?.unsubscribed) || 0;
  const total = Number(stats?.total) || 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        breadcrumb={[
          { label: 'Email' },
          { label: 'Mail Listeleri', href: '/cms/email/lists' },
          { label: channel?.title || channelKey },
        ]}
        title={channel?.title || channelKey}
        description={channel?.description || 'Liste panosu'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => refetchStats()} disabled={statsFetching}>
              {statsFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Yenile
            </Button>
            <Button onClick={() => setMembersOpen(true)}>
              <Users className="size-4" /> Üye listesini aç
            </Button>
            <Link href={isCron ? '/cms/email/lists?tab=cron' : '/cms/email/lists'}>
              <Button variant="outline"><ArrowLeft className="size-4" /> Geri</Button>
            </Link>
          </div>
        }
      />

      {notice && (
        <Alert variant="info" className="mb-4"><AlertDescription>{notice}</AlertDescription></Alert>
      )}

      {isArchived && (
        <Alert variant="warning" className="mb-4">
          <AlertTitle>Bu liste arşivde</AlertTitle>
          <AlertDescription>
            Arşivdeki listeye yeni üye eklenemez ve kampanya gönderilemez. Mevcut üyeleri
            görüntüleyip çıkarabilirsiniz.
          </AlertDescription>
        </Alert>
      )}

      {statsLoading ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={UserCheck} tone="success" label="Aktif abone" value={formatCount(subscribed)} sub={`toplam ${total ? `%${pct(subscribed, total)}` : '—'}`} />
            <StatCard icon={UserMinus} tone="warning" label="Çıkan / çıkarılan" value={formatCount(unsubscribed)} sub={total ? `%${pct(unsubscribed, total)}` : undefined} />
            <StatCard icon={ListChecks} label="Toplam kayıt" value={formatCount(total)} />
            <StatCard
              icon={Users}
              label="Tip"
              value={isCron ? 'Cron' : isManualList(channel) ? 'E-posta' : (channel?.type || '—')}
            />
          </div>

          {isCron && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="size-4 text-muted-foreground" /> Cron Listesi
                </CardTitle>
                <CardToolbar className="gap-2">
                  {recipe && (
                    <Button size="sm" variant="outline" onClick={handleRunCron} disabled={running}>
                      {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Şimdi çalıştır
                    </Button>
                  )}
                  <Link href="/cms/email/lists?tab=cron">
                    <Button size="sm" variant="ghost"><Settings2 className="size-3.5" /> Ayarları düzenle</Button>
                  </Link>
                </CardToolbar>
              </CardHeader>
              <CardContent>
                {recipe ? (
                  <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" /> Zamanlama</dt>
                      <dd className="font-mono text-xs">{recipe.schedule?.cron}</dd>
                      <dd className="text-xs text-muted-foreground">{recipe.schedule?.timezone}</dd>
                    </div>
                    <div>
                      <dt className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Database className="size-3.5" /> Kaynak</dt>
                      <dd>{SOURCE_LABELS[recipe.source] || recipe.source}</dd>
                    </div>
                    <div>
                      <dt className="mb-1 text-xs text-muted-foreground">Mod</dt>
                      <dd className="text-xs">{BUILD_MODE_LABELS[recipe.buildMode] || recipe.buildMode}</dd>
                    </div>
                    <div>
                      <dt className="mb-1 text-xs text-muted-foreground">Durum</dt>
                      <dd>
                        <Badge variant={(RECIPE_STATUS_META[recipe.status] || {}).variant || 'muted'}>
                          {(RECIPE_STATUS_META[recipe.status] || {}).label || recipe.status}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">Bu cron kanalının reçete tanımı bulunamadı.</p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Çıkış Nedenleri</CardTitle></CardHeader>
              <CardContent>
                <ReasonBreakdown stats={stats} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gerekçe Detayı</CardTitle>
                <CardToolbar>
                  <Button size="sm" variant="outline" onClick={() => setMembersOpen(true)}>
                    <Users className="size-3.5" /> Üyeleri gör
                  </Button>
                </CardToolbar>
              </CardHeader>
              <CardContent className="p-0">
                {(stats?.reasons?.length || 0) === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Çıkış kaydı yok.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gerekçe</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">Kişi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.reasons.map((r) => {
                        const meta = categoryMeta(r.category);
                        return (
                          <TableRow key={r.reason || 'none'}>
                            <TableCell>
                              <span className="text-sm">{r.label}</span>
                              {r.reason && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{r.reason}</span>}
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
                                <span className="text-xs">{meta.label}</span>
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCount(r.count)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="size-4 text-muted-foreground" /> Gönderilen Kampanyalar
                {listCampaigns.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">({listCampaigns.length})</span>
                )}
              </CardTitle>
              <CardToolbar>
                <Link href="/cms/email/campaigns">
                  <Button size="sm" variant="outline"><Send className="size-3.5" /> Tüm Kampanyalar</Button>
                </Link>
              </CardToolbar>
            </CardHeader>
            <CardContent className="p-0">
              {listCampaigns.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Bu listeye henüz kampanya gönderilmemiş.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kampanya</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Gönderim</TableHead>
                      <TableHead className="text-right">Gönderilen / Toplam</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listCampaigns.map((c) => {
                      const cm = CAMPAIGN_STATUS_META[c.status] || { label: c.status, variant: 'muted' };
                      const sent = c.progress?.sent ?? c.audience?.sentCount ?? 0;
                      const totalTarget = c.progress?.total ?? c.audience?.total ?? 0;
                      return (
                        <TableRow key={c._id}>
                          <TableCell className="font-medium">
                            <Link href={`/cms/email/campaigns/${c._id}`} className="hover:underline">
                              {c.name}
                            </Link>
                          </TableCell>
                          <TableCell><Badge variant={cm.variant}>{cm.label}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.sentAt ? new Date(c.sentAt).toLocaleString('tr-TR') : '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCount(sent)}{totalTarget ? ` / ${formatCount(totalTarget)}` : ''}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <MemberListDialog
        open={membersOpen}
        onOpenChange={setMembersOpen}
        channel={channel}
        channelKey={channelKey}
        authorized={authorized}
      />
    </RoleGuard>
  );
}
