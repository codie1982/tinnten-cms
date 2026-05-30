'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Layers, Users, Plug, RefreshCw, Inbox, ArrowUpRight, ArrowDownRight, CheckCircle2,
} from 'lucide-react';
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
  useGetMqOverviewQuery,
  useGetMqQueuesQuery,
  useGetMqConsumersQuery,
  useGetMqConnectionsQuery,
} from '@/redux/services';

function formatBytes(b) {
  if (!b) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function formatTr(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}
const queueStateVariant = (s) => (s === 'running' ? 'success' : s === 'idle' ? 'muted' : 'warning');

const SECTIONS = [
  { key: 'queues', label: 'Kuyruklar', icon: Layers, desc: 'Derinlik & tüketici sayısı' },
  { key: 'consumers', label: 'Tüketiciler', icon: Users, desc: 'Aktif worker → kuyruk' },
  { key: 'connections', label: 'Bağlantılar', icon: Plug, desc: 'Bağlı istemci süreçleri' },
];

/* ── Üst özet kartları ── */
function OverviewBar() {
  const { data, isFetching, refetch } = useGetMqOverviewQuery(undefined, { pollingInterval: 10000 });
  const reachable = data?.ok;

  const stat = (label, value, tone) => (
    <Card><CardContent className="p-3">
      <p className="text-2sm text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-xl font-bold tabular-nums', tone)}>{isFetching && !data ? '…' : value}</p>
    </CardContent></Card>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {isFetching && !data ? <Badge variant="muted">Kontrol ediliyor…</Badge>
            : reachable ? <Badge variant="success">RabbitMQ erişilebilir{data?.version ? ` · v${data.version}` : ''}</Badge>
            : <Badge variant="destructive">Erişilemiyor</Badge>}
          {!reachable && data?.reason ? <span className="ms-2 text-muted-foreground">{data.reason}</span> : null}
          {reachable && data?.vhost ? <span className="ms-2 text-xs text-muted-foreground">vhost: {data.vhost}</span> : null}
        </div>
        <Button variant="outline" size="sm" onClick={refetch} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /> Yenile
        </Button>
      </div>

      {reachable && (
        <>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
            {stat('Kuyruk', data.totals?.queues ?? 0)}
            {stat('Tüketici', data.totals?.consumers ?? 0, 'text-primary')}
            {stat('Bağlantı', data.totals?.connections ?? 0)}
            {stat('Bekleyen', data.messages?.ready ?? 0, (data.messages?.ready ?? 0) > 0 ? 'text-amber-600' : undefined)}
            {stat('İşleniyor', data.messages?.unacked ?? 0)}
            {stat('Toplam Mesaj', data.messages?.total ?? 0)}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="muted"><ArrowUpRight className="me-1 size-3" /> Yayın {data.rates?.publish ?? 0}/sn</Badge>
            <Badge variant="muted"><ArrowDownRight className="me-1 size-3" /> Teslim {data.rates?.deliver ?? 0}/sn</Badge>
            <Badge variant="muted"><CheckCircle2 className="me-1 size-3" /> Ack {data.rates?.ack ?? 0}/sn</Badge>
            {data.rates?.redeliver ? <Badge variant="warning">Yeniden teslim {data.rates.redeliver}/sn</Badge> : null}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Kuyruklar ── */
function QueuesSection() {
  const { data, isFetching, isError, refetch } = useGetMqQueuesQuery(undefined, { pollingInterval: 10000 });
  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kuyruklar</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{items.length} kuyruk</Badge>
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}><RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /></Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {isError ? (
          <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Kuyruk listesi alınamadı. Management API (15672) erişilebilir mi?</AlertDescription></Alert></div>
        ) : isFetching && items.length === 0 ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center"><Inbox className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Kuyruk yok</p></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kuyruk</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Toplam</TableHead>
                  <TableHead>Bekleyen</TableHead>
                  <TableHead>İşlenen</TableHead>
                  <TableHead>Tüketici</TableHead>
                  <TableHead>Yayın/sn</TableHead>
                  <TableHead>Teslim/sn</TableHead>
                  <TableHead>Bellek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((q) => (
                  <TableRow key={q.name}>
                    <TableCell className="max-w-[260px] truncate font-medium text-foreground">{q.name}{!q.durable && <span className="ms-1 text-xs text-muted-foreground">(geçici)</span>}</TableCell>
                    <TableCell><Badge variant={queueStateVariant(q.state)}>{q.state}</Badge></TableCell>
                    <TableCell className={cn('tabular-nums text-sm', q.messages > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{q.messages}</TableCell>
                    <TableCell className={cn('tabular-nums text-sm', q.ready > 0 ? 'text-amber-600' : 'text-muted-foreground')}>{q.ready}</TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">{q.unacked}</TableCell>
                    <TableCell>
                      <Badge variant={q.consumers > 0 ? 'success' : 'destructive'}>{q.consumers}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">{q.rates?.publish ?? 0}</TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">{q.rates?.deliver ?? 0}</TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground">{formatBytes(q.memory)}</TableCell>
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

/* ── Tüketiciler ── */
function ConsumersSection() {
  const { data, isFetching, isError, refetch } = useGetMqConsumersQuery(undefined, { pollingInterval: 10000 });
  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tüketiciler (Worker'lar)</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{items.length} tüketici</Badge>
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}><RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /></Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {isError ? (
          <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Tüketici listesi alınamadı.</AlertDescription></Alert></div>
        ) : isFetching && items.length === 0 ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center"><Users className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Aktif tüketici yok</p><p className="text-sm text-muted-foreground">Hiçbir worker kuyrukları dinlemiyor olabilir.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kuyruk</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Prefetch</TableHead>
                  <TableHead>Ack</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Bağlantı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.tag}>
                    <TableCell className="font-medium text-foreground">{c.queue}</TableCell>
                    <TableCell><Badge variant={c.active ? 'success' : 'muted'}>{c.active ? 'Aktif' : 'Pasif'}</Badge></TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">{c.prefetch}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.ackRequired ? 'manuel' : 'auto'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.peerHost || '—'}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">{c.connection || c.channel || '—'}</TableCell>
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

/* ── Bağlantılar ── */
function ConnectionsSection() {
  const { data, isFetching, isError, refetch } = useGetMqConnectionsQuery(undefined, { pollingInterval: 15000 });
  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bağlantılar</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{items.length} bağlantı</Badge>
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}><RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /></Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {isError ? (
          <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Bağlantı listesi alınamadı.</AlertDescription></Alert></div>
        ) : isFetching && items.length === 0 ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center"><Plug className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Bağlantı yok</p></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İstemci</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead>Bağlanma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="max-w-[220px] truncate font-medium text-foreground">{c.clientName || c.name}</TableCell>
                    <TableCell><Badge variant={c.state === 'running' ? 'success' : 'muted'}>{c.state}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.user || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.host || '—'}</TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">{c.channels}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTr(c.connectedAt)}</TableCell>
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

/* ── Sayfa ── */
export default function QueuesPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const [section, setSection] = useState('queues');

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Servisler"
        title="Mesaj Kuyruğu (RabbitMQ)"
        description="Kuyruk derinlikleri, çalışan worker'lar ve bağlantılar — Management API üzerinden, salt-okunur"
      />

      {authorized && <div className="mb-5"><OverviewBar /></div>}

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
          {section === 'queues' && <QueuesSection />}
          {section === 'consumers' && <ConsumersSection />}
          {section === 'connections' && <ConnectionsSection />}
        </div>
      </div>
    </RoleGuard>
  );
}
