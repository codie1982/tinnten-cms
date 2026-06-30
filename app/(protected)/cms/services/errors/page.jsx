'use client';

import { useState } from 'react';
import {
  RefreshCw, X, Inbox, AlertTriangle, CheckCircle2, EyeOff, RotateCcw, User as UserIcon,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
  useGetErrorStatsQuery,
  useGetErrorIssuesQuery,
  useGetErrorIssueDetailQuery,
  useUpdateErrorIssueMutation,
} from '@/redux/services';

const LEVEL_META = {
  fatal: { label: 'Fatal', variant: 'destructive' },
  error: { label: 'Error', variant: 'destructive' },
  warning: { label: 'Warning', variant: 'warning' },
  info: { label: 'Info', variant: 'muted' },
};
const STATUS_META = {
  unresolved: { label: 'Açık', variant: 'warning' },
  resolved: { label: 'Çözüldü', variant: 'success' },
  ignored: { label: 'Yoksayıldı', variant: 'muted' },
};
const PAGE_SIZE = 25;

function formatTr(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

function userLabel(u) {
  if (!u || (!u.email && !u.name && !u.id)) return 'Anonim';
  return u.email || u.name || u.username || u.id;
}

/* ════════════ Stat kartları ════════════ */
function StatCards({ authorized }) {
  const { data, isFetching } = useGetErrorStatsQuery(undefined, {
    skip: !authorized,
    pollingInterval: 30000,
  });
  const issues = data?.issues || {};
  const events = data?.events || {};

  const stat = (label, value, tone) => (
    <Card><CardContent className="p-4">
      <p className="text-2sm text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>
        {isFetching && data == null ? '…' : value ?? 0}
      </p>
    </CardContent></Card>
  );

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stat('Açık Issue', issues.unresolved, (issues.unresolved ?? 0) > 0 ? 'text-amber-600' : undefined)}
      {stat('Çözüldü', issues.resolved, 'text-green-600')}
      {stat('Yoksayıldı', issues.ignored, 'text-muted-foreground')}
      {stat('Son 24s Olay', events.last24h, (events.last24h ?? 0) > 0 ? 'text-destructive' : undefined)}
    </div>
  );
}

/* ════════════ Issue tablosu ════════════ */
function IssuesSection({ authorized }) {
  const [status, setStatus] = useState('unresolved');
  const [level, setLevel] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [detailFp, setDetailFp] = useState(null);

  const params = {
    page,
    limit: PAGE_SIZE,
    status: status === 'all' ? undefined : status,
    level: level === 'all' ? undefined : level,
    q: q.trim() || undefined,
  };
  const { data, isFetching, isError, refetch } = useGetErrorIssuesQuery(params, { skip: !authorized });
  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const resetPageAnd = (fn) => (v) => { fn(v); setPage(1); };

  return (
    <div className="space-y-4">
      {/* Filtreler */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={status} onValueChange={resetPageAnd(setStatus)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="unresolved">Açık</SelectItem>
              <SelectItem value="resolved">Çözüldü</SelectItem>
              <SelectItem value="ignored">Yoksayıldı</SelectItem>
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={resetPageAnd(setLevel)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Seviye" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Seviyeler</SelectItem>
              <SelectItem value="fatal">Fatal</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Başlıkta ara…"
            className="w-[220px]"
          />
          <span className="text-xs text-muted-foreground">{total} issue</span>
          <div className="ms-auto">
            <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
              <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tablo */}
      <Card>
        <CardContent className="px-0 py-0">
          {isError ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Hata listesi alınamadı.</AlertDescription></Alert></div>
          ) : isFetching && items.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center"><Inbox className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Hata kaydı yok</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Başlık</TableHead>
                    <TableHead>Seviye</TableHead>
                    <TableHead>Ortam</TableHead>
                    <TableHead>Adet</TableHead>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>Son Görülme</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const lm = LEVEL_META[it.level] || { label: it.level, variant: 'muted' };
                    const sm = STATUS_META[it.status] || { label: it.status, variant: 'muted' };
                    return (
                      <TableRow key={it.fingerprint} className="cursor-pointer" onClick={() => setDetailFp(it.fingerprint)}>
                        <TableCell className="max-w-[360px]">
                          <div className="truncate font-medium text-foreground">{it.title || '—'}</div>
                          {it.culprit && <div className="truncate font-mono text-xs text-muted-foreground">{it.culprit}</div>}
                        </TableCell>
                        <TableCell><Badge variant={lm.variant}>{lm.label}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{(it.environments || []).join(', ') || '—'}</TableCell>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">{it.eventCount ?? 0}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">{userLabel(it.lastUser)}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTr(it.lastSeen)}</TableCell>
                        <TableCell><Badge variant={sm.variant}>{sm.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>Önceki</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sonraki</Button>
        </div>
      )}

      {detailFp && <IssueDetail fingerprint={detailFp} onClose={() => setDetailFp(null)} />}
    </div>
  );
}

/* ════════════ Issue detayı (modal) ════════════ */
function IssueDetail({ fingerprint, onClose }) {
  const { data, isFetching } = useGetErrorIssueDetailQuery(fingerprint);
  const [updateIssue, { isLoading: updating }] = useUpdateErrorIssueMutation();
  const [notice, setNotice] = useState(null);
  const issue = data?.issue;
  const events = data?.events || [];

  const setStatus = async (status) => {
    setNotice(null);

    try {
      const result = await updateIssue({ fingerprint, status }).unwrap();
      const notification = result?.data?.notification;

      if (status !== 'resolved') {
        setNotice({ variant: 'info', message: 'Issue durumu güncellendi.' });
        return;
      }

      if (notification?.status === 'queued') {
        setNotice({ variant: 'info', message: `Issue çözüldü ve ${notification.to} adresine bilgilendirme maili kuyruğa alındı.` });
        return;
      }

      if (notification?.reason === 'missing_recipient') {
        setNotice({
          variant: 'warning',
          message: 'Issue çözüldü, ancak kullanıcı e-postası bulunamadığı için bilgilendirme maili gönderilmedi.',
        });
        return;
      }

      if (notification?.reason === 'queue_error') {
        setNotice({
          variant: 'warning',
          message: 'Issue çözüldü, ancak bilgilendirme maili kuyruğa alınamadı.',
        });
        return;
      }

      setNotice({ variant: 'info', message: 'Issue çözüldü.' });
    } catch (error) {
      setNotice({
        variant: 'destructive',
        message: error?.data?.message || error?.normalizedMessage || 'Issue durumu güncellenemedi.',
      });
    }
  };

  const sm = issue ? (STATUS_META[issue.status] || { label: issue.status, variant: 'muted' }) : null;
  const lm = issue ? (LEVEL_META[issue.level] || { label: issue.level, variant: 'muted' }) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="flex max-h-[90vh] w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 truncate">
            <AlertTriangle className="size-4 text-destructive shrink-0" />
            <span className="truncate">{isFetching && !issue ? 'Yükleniyor…' : (issue?.title || 'Issue')}</span>
          </CardTitle>
          <CardToolbar><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></CardToolbar>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto p-5">
          {isFetching && !issue ? (
            <Skeleton className="h-40 w-full" />
          ) : !issue ? (
            <Alert variant="destructive"><AlertTitle>Bulunamadı</AlertTitle><AlertDescription>Issue alınamadı.</AlertDescription></Alert>
          ) : (
            <>
              {/* Özet + aksiyonlar */}
              <div className="flex flex-wrap items-center gap-2">
                {lm && <Badge variant={lm.variant}>{lm.label}</Badge>}
                {sm && <Badge variant={sm.variant}>{sm.label}</Badge>}
                <span className="text-xs text-muted-foreground">{issue.eventCount} olay</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{(issue.environments || []).join(', ')}</span>
                <div className="ms-auto flex gap-2">
                  <Button size="sm" variant="outline" disabled={updating || issue.status === 'resolved'} onClick={() => setStatus('resolved')}>
                    <CheckCircle2 className="size-3.5 text-green-600" /> Çöz
                  </Button>
                  <Button size="sm" variant="outline" disabled={updating || issue.status === 'ignored'} onClick={() => setStatus('ignored')}>
                    <EyeOff className="size-3.5" /> Yoksay
                  </Button>
                  <Button size="sm" variant="outline" disabled={updating || issue.status === 'unresolved'} onClick={() => setStatus('unresolved')}>
                    <RotateCcw className="size-3.5" /> Yeniden Aç
                  </Button>
                </div>
              </div>

              {notice?.message && (
                <Alert variant={notice.variant}>
                  <AlertDescription>{notice.message}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <div>İlk: {formatTr(issue.firstSeen)}</div>
                <div>Son: {formatTr(issue.lastSeen)}</div>
                <div className="flex items-center gap-1"><UserIcon className="size-3" /> {userLabel(issue.lastUser)}</div>
                <div className="truncate font-mono">{fingerprint}</div>
              </div>

              {/* Son olaylar */}
              <div className="space-y-2">
                <p className="text-2sm font-medium text-foreground">Son Olaylar ({events.length})</p>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ham olay kaydı yok (TTL ile temizlenmiş olabilir).</p>
                ) : (
                  events.map((ev) => (
                    <div key={ev._id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{ev.message || ev.exceptionType}</span>
                        <span className="font-mono text-xs text-muted-foreground">{formatTr(ev.createdAt)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {ev.source && <span>kaynak: {ev.source}</span>}
                        {ev.method && <span>{ev.method} {ev.url}</span>}
                        {ev.transaction && !ev.url && <span>{ev.transaction}</span>}
                        {ev.statusCode != null && <span>HTTP {ev.statusCode}</span>}
                        {ev.user?.email && <span>👤 {ev.user.email}</span>}
                        {ev.requestId && <span>req: {ev.requestId}</span>}
                      </div>
                      {ev.stack && (
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono text-[11px] text-muted-foreground">{ev.stack}</pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ════════════ Sayfa ════════════ */
export default function ErrorMonitoringPage() {
  const authorized = true; // RoleGuard zaten cms:admin'i zorluyor

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Servisler"
        title="Hata İzleme"
        description="Uygulama hataları, gruplu issue'lar ve etkilenen kullanıcılar"
      />
      <div className="space-y-5">
        <StatCards authorized={authorized} />
        <IssuesSection authorized={authorized} />
      </div>
    </RoleGuard>
  );
}
