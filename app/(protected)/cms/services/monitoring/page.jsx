'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Gauge, Boxes, Radar, LineChart as LineIcon, RefreshCw, Inbox, Cpu, MemoryStick,
  HardDrive, Activity, AlertTriangle, ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
  useGetMetricsHostQuery,
  useGetMetricsContainersQuery,
  useGetMetricsTargetsQuery,
  useGetMetricsAlertsQuery,
  useGetMetricsRangeQuery,
} from '@/redux/services';

const GRAFANA_URL = process.env.NEXT_PUBLIC_GRAFANA_URL || '';

function formatBytes(b) {
  if (b == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function formatUptime(sec) {
  if (!sec) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return d > 0 ? `${d}g ${h}s` : `${h}s`;
}
const hhmm = (t) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
const pctTone = (p) => (p == null ? '' : p >= 90 ? 'text-destructive' : p >= 70 ? 'text-amber-600' : 'text-green-600');

const SECTIONS = [
  { key: 'overview', label: 'Özet', icon: Gauge, desc: 'Host & sağlık' },
  { key: 'containers', label: 'Konteynerler', icon: Boxes, desc: 'cAdvisor CPU/RAM' },
  { key: 'targets', label: 'Hedefler & Alarm', icon: Radar, desc: 'Scrape & alarmlar' },
  { key: 'grafana', label: 'Grafana', icon: LineIcon, desc: 'Gömülü panolar' },
];

/* ── Zaman serisi grafiği (Prometheus query_range) ── */
function RangeChart({ title, query, color, unit, icon: Icon }) {
  const { data, isFetching } = useGetMetricsRangeQuery({ query, minutes: 60, step: 60 }, { pollingInterval: 30000 });
  const points = (data?.series?.[0]?.points || []).map((p) => ({ t: p.t, v: Math.round(p.v * 10) / 10 }));

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-sm">{Icon && <Icon className="size-4 text-primary" />}{title}</CardTitle></CardHeader>
      <CardContent>
        {isFetching && points.length === 0 ? <Skeleton className="h-40 w-full" /> : points.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Veri yok.</p>
        ) : (
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id={`g-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                <XAxis dataKey="t" tickFormatter={hhmm} tick={{ fontSize: 11 }} minTickGap={40} />
                <YAxis tick={{ fontSize: 11 }} width={40} domain={unit === '%' ? [0, 100] : ['auto', 'auto']} />
                <Tooltip
                  labelFormatter={(t) => hhmm(t)}
                  formatter={(v) => [`${v}${unit || ''}`, title]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#g-${title})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Özet ── */
function OverviewSection({ authorized }) {
  const host = useGetMetricsHostQuery(undefined, { skip: !authorized, pollingInterval: 20000 });
  const targets = useGetMetricsTargetsQuery(undefined, { skip: !authorized, pollingInterval: 20000 });
  const alerts = useGetMetricsAlertsQuery(undefined, { skip: !authorized, pollingInterval: 20000 });
  const h = host.data;
  const reachable = h?.ok;
  const ts = targets.data?.summary;
  const al = alerts.data?.items ?? [];

  const card = (label, value, sub, Icon, tone) => (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-2sm text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{host.isFetching && !h ? '…' : value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </CardContent></Card>
  );

  if (host.isError || reachable === false) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Prometheus'a ulaşılamadı</AlertTitle>
        <AlertDescription>{h?.reason || 'Köprü (tinnten-server /monitoring) veya Prometheus (9090) çalışmıyor olabilir.'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="success">Prometheus erişilebilir</Badge>
          {ts && <span className="text-muted-foreground">{ts.up}/{ts.total} hedef ayakta</span>}
          {h?.uptimeSec ? <span className="text-muted-foreground">· uptime {formatUptime(h.uptimeSec)}</span> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => { host.refetch(); targets.refetch(); alerts.refetch(); }} disabled={host.isFetching}>
          <RefreshCw className={host.isFetching ? 'size-4 animate-spin' : 'size-4'} /> Yenile
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {card('CPU', h?.cpuPct != null ? `%${h.cpuPct}` : '—', `Load: ${h?.load1 != null ? h.load1.toFixed(2) : '—'}`, Cpu, pctTone(h?.cpuPct))}
        {card('RAM', h?.memPct != null ? `%${h.memPct}` : '—', `${formatBytes(h?.memUsed)} / ${formatBytes(h?.memTotal)}`, MemoryStick, pctTone(h?.memPct))}
        {card('Disk', h?.diskPct != null ? `%${h.diskPct}` : '—', `${formatBytes(h?.diskUsed)} / ${formatBytes(h?.diskTotal)}`, HardDrive, pctTone(h?.diskPct))}
        {card('Hedefler', ts ? `${ts.up}/${ts.total}` : '—', ts?.down ? `${ts.down} down` : 'tümü ayakta', Activity, ts?.down ? 'text-destructive' : 'text-green-600')}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RangeChart title="CPU %" query={`100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`} color="#6366f1" unit="%" icon={Cpu} />
        <RangeChart title="RAM %" query={`100 * (1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))`} color="#10b981" unit="%" icon={MemoryStick} />
      </div>

      {/* Alarmlar */}
      {al.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /> Aktif Alarmlar</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {al.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">{a.name}</span>
                  {a.summary && <p className="truncate text-xs text-muted-foreground">{a.summary}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={a.severity === 'critical' ? 'destructive' : 'warning'}>{a.severity}</Badge>
                  <Badge variant={a.state === 'firing' ? 'destructive' : 'muted'}>{a.state}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Konteynerler ── */
function ContainersSection({ authorized }) {
  const { data, isFetching, isError, refetch } = useGetMetricsContainersQuery(undefined, { skip: !authorized, pollingInterval: 15000 });
  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Konteynerler (cAdvisor)</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{items.length} konteyner</Badge>
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}><RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /></Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {isError ? (
          <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Konteyner metrikleri alınamadı.</AlertDescription></Alert></div>
        ) : isFetching && items.length === 0 ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center"><Inbox className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Konteyner metriği yok</p></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konteyner</TableHead>
                  <TableHead>CPU %</TableHead>
                  <TableHead>RAM</TableHead>
                  <TableHead>RAM Limiti</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => {
                  const memPct = c.memLimit && c.memBytes ? Math.round((c.memBytes / c.memLimit) * 100) : null;
                  return (
                    <TableRow key={c.name}>
                      <TableCell className="max-w-[280px] truncate font-medium text-foreground">{c.name}</TableCell>
                      <TableCell className={cn('tabular-nums text-sm', pctTone(c.cpuPct))}>{c.cpuPct != null ? `%${c.cpuPct}` : '—'}</TableCell>
                      <TableCell className="tabular-nums text-sm text-muted-foreground">{formatBytes(c.memBytes)}{memPct != null ? ` (%${memPct})` : ''}</TableCell>
                      <TableCell className="tabular-nums text-xs text-muted-foreground">{c.memLimit ? formatBytes(c.memLimit) : '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Hedefler & Alarmlar ── */
function TargetsSection({ authorized }) {
  const { data, isFetching, isError, refetch } = useGetMetricsTargetsQuery(undefined, { skip: !authorized, pollingInterval: 20000 });
  const items = data?.items ?? [];
  const sum = data?.summary;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scrape Hedefleri</CardTitle>
        <CardToolbar>
          {sum && <Badge variant={sum.down ? 'destructive' : 'success'}>{sum.up}/{sum.total} ayakta</Badge>}
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}><RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /></Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {isError ? (
          <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Hedefler alınamadı.</AlertDescription></Alert></div>
        ) : isFetching && items.length === 0 ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center"><Radar className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Hedef yok</p></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Instance</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Hata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t, i) => (
                  <TableRow key={`${t.job}-${t.instance}-${i}`}>
                    <TableCell className="font-medium text-foreground">{t.job}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">{t.instance}</TableCell>
                    <TableCell><Badge variant={t.health === 'up' ? 'success' : 'destructive'}>{t.health}</Badge></TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-destructive">{t.lastError || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Grafana embed ── */
function GrafanaSection() {
  if (!GRAFANA_URL) {
    return (
      <Alert variant="info">
        <AlertTitle>Grafana yapılandırılmadı</AlertTitle>
        <AlertDescription>
          Gömülü Grafana için <code className="font-mono">NEXT_PUBLIC_GRAFANA_URL</code> ortam değişkenini tanımlayın (kimlik-korumalı reverse proxy arkasındaki Grafana adresi).
          Ayrıca Grafana tarafında <code className="font-mono">GF_SECURITY_ALLOW_EMBEDDING=true</code> gerekir.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Grafana</CardTitle>
        <CardToolbar>
          <a href={GRAFANA_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Yeni sekmede aç <ExternalLink className="size-3.5" />
          </a>
        </CardToolbar>
      </CardHeader>
      <CardContent className="p-0">
        <iframe title="Grafana" src={GRAFANA_URL} className="h-[78vh] w-full border-0" />
      </CardContent>
    </Card>
  );
}

/* ── Sayfa ── */
export default function MonitoringPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const [section, setSection] = useState('overview');

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Servisler"
        title="Sistem İzleme"
        description="Prometheus · cAdvisor · node-exporter metrikleri ve gömülü Grafana — Management API dışarı açılmadan"
      />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <nav className="space-y-0.5 p-2">
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const active = section === sec.key;
                return (
                  <button key={sec.key} onClick={() => setSection(sec.key)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    )}>
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{sec.label}</span>
                      <span className="block text-xs text-muted-foreground">{sec.desc}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        <div>
          {section === 'overview' && <OverviewSection authorized={authorized} />}
          {section === 'containers' && <ContainersSection authorized={authorized} />}
          {section === 'targets' && <TargetsSection authorized={authorized} />}
          {section === 'grafana' && <GrafanaSection />}
        </div>
      </div>
    </RoleGuard>
  );
}
