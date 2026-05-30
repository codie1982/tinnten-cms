'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Mail, Users, Radio, Tag, Inbox, X, Search, RefreshCw, Loader2, Globe,
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
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
  useGetCmsSubscribersQuery,
  useGetCmsSubscriptionStatsQuery,
  useGetCmsSubscriberQuery,
} from '@/redux/services';

const PAGE_SIZE = 25;

const STATUS_META = {
  active: { label: 'Aktif', variant: 'success' },
  bounced: { label: 'Bounced', variant: 'warning' },
  complained: { label: 'Şikayet', variant: 'destructive' },
};
const CHANNEL_LABEL = { general: 'Genel', news: 'Haber' };

function formatTr(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const SECTIONS = [
  { key: 'subscribers', label: 'Mail Listeleri', icon: Users, desc: 'Abone (e-posta) kayıtları' },
  { key: 'subscriptions', label: 'Abonelikler', icon: Radio, desc: 'Kanal & kategori dağılımı' },
];

/* ── Yatay dağılım çubuğu ── */
function DistRow({ label, count, total, hint }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate font-medium text-foreground">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {count.toLocaleString('tr-TR')}{hint ? ` · ${pct}%` : ''}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Abone listesi sekmesi ── */
function SubscribersSection({ authorized }) {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [channel, setChannel] = useState('all');
  const [page, setPage] = useState(0);
  const [detailEmail, setDetailEmail] = useState(null);

  const params = {
    q: search || undefined,
    status: status === 'all' ? undefined : status,
    channel: channel === 'all' ? undefined : channel,
    limit: PAGE_SIZE,
    skip: page * PAGE_SIZE,
  };
  const { data, isFetching, isError, refetch } = useGetCmsSubscribersQuery(params, { skip: !authorized });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submitSearch = () => { setPage(0); setSearch(q.trim()); };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex min-w-[240px] flex-1 items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              placeholder="E-posta ara…"
            />
            <Button variant="outline" size="icon" onClick={submitSearch}><Search className="size-4" /></Button>
          </div>
          <div className="w-40">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="complained">Şikayet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Kanal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kanallar</SelectItem>
                <SelectItem value="general">Genel</SelectItem>
                <SelectItem value="news">Haber</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aboneler</CardTitle>
          <CardToolbar><Badge variant="muted">{total.toLocaleString('tr-TR')} kayıt</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {isError ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Yüklenemedi</AlertTitle>
                <AlertDescription>Abone listesi alınamadı. Backend çalışıyor mu?</AlertDescription>
              </Alert>
            </div>
          ) : isFetching && items.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Abone yok</p>
              <p className="text-sm text-muted-foreground">Bu kriterde abone bulunmuyor.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Kanallar</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Son Aktivite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((s) => {
                    const sm = STATUS_META[s.status] || { label: s.status, variant: 'muted' };
                    return (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => setDetailEmail(s.email)}>
                        <TableCell className="max-w-[260px] truncate text-sm font-medium text-foreground">{s.email}</TableCell>
                        <TableCell><Badge variant={sm.variant}>{sm.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {s.channels?.length
                              ? s.channels.map((c) => <Badge key={c} variant="outline">{CHANNEL_LABEL[c] || c}</Badge>)
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.categoryCount || 0}</TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">{s.source || '—'}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTr(s.lastActivityAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border p-3">
              <span className="text-xs text-muted-foreground">Sayfa {page + 1} / {pageCount}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0 || isFetching} onClick={() => setPage((p) => p - 1)}>Önceki</Button>
                <Button variant="outline" size="sm" disabled={page + 1 >= pageCount || isFetching} onClick={() => setPage((p) => p + 1)}>Sonraki</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {detailEmail && <SubscriberDetail email={detailEmail} onClose={() => setDetailEmail(null)} />}
    </div>
  );
}

/* ── Abone detay modalı ── */
function SubscriberDetail({ email, onClose }) {
  const { data: doc, isFetching } = useGetCmsSubscriberQuery(email);
  const sm = STATUS_META[doc?.status] || { label: doc?.status, variant: 'muted' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="flex max-h-[88vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate">{email}</CardTitle>
          <CardToolbar>
            {doc && <Badge variant={sm.variant}>{sm.label}</Badge>}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto p-5">
          {isFetching ? (
            <Skeleton className="h-48 w-full" />
          ) : !doc ? (
            <p className="text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Locale: </span>{doc.locale || '—'}</div>
                <div className="truncate"><span className="text-muted-foreground">Kaynak: </span>{doc.source || '—'}</div>
                <div><span className="text-muted-foreground">Kayıt: </span>{formatTr(doc.createdAt)}</div>
                <div><span className="text-muted-foreground">Son aktivite: </span>{formatTr(doc.lastActivityAt)}</div>
              </div>

              {doc.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {doc.tags.map((t) => <Badge key={t} variant="muted"><Tag className="me-1 size-3" />{t}</Badge>)}
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kanallar</p>
                <div className="space-y-1.5">
                  {(doc.channels || []).length === 0 && <p className="text-sm text-muted-foreground">Kanal aboneliği yok.</p>}
                  {(doc.channels || []).map((c, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="font-medium">{CHANNEL_LABEL[c.channel] || c.channel}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="muted">{c.frequency}</Badge>
                        <Badge variant={c.status === 'subscribed' ? 'success' : 'muted'}>
                          {c.status === 'subscribed' ? 'Abone' : 'Çıkmış'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Haber Kategorileri</p>
                <div className="space-y-1.5">
                  {(doc.news?.categories || []).length === 0 && <p className="text-sm text-muted-foreground">Kategori aboneliği yok.</p>}
                  {(doc.news?.categories || []).map((c, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{c.title || c.slug}{c.countryCode ? ` · ${c.countryCode}` : ''}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="muted">{c.frequency}</Badge>
                        <Badge variant={c.status === 'subscribed' ? 'success' : 'muted'}>
                          {c.status === 'subscribed' ? 'Abone' : 'Çıkmış'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Abonelik dağılımı sekmesi ── */
function SubscriptionsSection({ authorized }) {
  const { data, isFetching, isError, refetch } = useGetCmsSubscriptionStatsQuery(undefined, { skip: !authorized });
  const total = data?.total ?? 0;
  const channels = data?.channels ?? [];
  const categories = data?.categories ?? [];
  const locales = data?.locales ?? [];
  const byStatus = data?.byStatus ?? {};

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Yüklenemedi</AlertTitle>
        <AlertDescription>Abonelik dağılımı alınamadı. Backend çalışıyor mu?</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Özet kartları */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-2sm text-muted-foreground">Toplam Abone</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{isFetching ? '…' : total.toLocaleString('tr-TR')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-2sm text-muted-foreground">Aktif</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-green-600">{isFetching ? '…' : (byStatus.active || 0).toLocaleString('tr-TR')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-2sm text-muted-foreground">Bounced</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-600">{isFetching ? '…' : (byStatus.bounced || 0).toLocaleString('tr-TR')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-2sm text-muted-foreground">Şikayet</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-destructive">{isFetching ? '…' : (byStatus.complained || 0).toLocaleString('tr-TR')}</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Kanal dağılımı */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Radio className="size-4 text-primary" /> Kanal Abonelikleri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isFetching ? <Skeleton className="h-24 w-full" />
              : channels.length === 0 ? <p className="text-sm text-muted-foreground">Kanal aboneliği yok.</p>
              : channels.map((c) => (
                  <DistRow key={c.channel} label={CHANNEL_LABEL[c.channel] || c.channel} count={c.count} total={total} hint />
                ))}
          </CardContent>
        </Card>

        {/* Locale dağılımı */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="size-4 text-primary" /> Dil Dağılımı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isFetching ? <Skeleton className="h-24 w-full" />
              : locales.length === 0 ? <p className="text-sm text-muted-foreground">Veri yok.</p>
              : locales.map((l) => (
                  <DistRow key={l.locale} label={l.locale} count={l.count} total={total} hint />
                ))}
          </CardContent>
        </Card>
      </div>

      {/* Kategori dağılımı */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Tag className="size-4 text-primary" /> Haber Kategorisi Abonelikleri</CardTitle>
          <CardToolbar>
            <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}>
              <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3">
          {isFetching ? <Skeleton className="h-40 w-full" />
            : categories.length === 0 ? <p className="text-sm text-muted-foreground">Kategori aboneliği yok.</p>
            : categories.map((c) => {
                const max = categories[0]?.count || 1;
                return <DistRow key={c.slug} label={c.title || c.slug} count={c.count} total={max} />;
              })}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── page ── */
export default function MailSubscriptionsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const [section, setSection] = useState('subscribers');

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Mail Abonelikleri"
        description="Abone (e-posta) kayıtları ve kanal/kategori abonelik dağılımı"
      />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        {/* Sol alt-menü */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <nav className="space-y-0.5 p-2">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = section === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">{s.desc}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        {/* Sağ içerik */}
        <div>
          {section === 'subscribers' && <SubscribersSection authorized={authorized} />}
          {section === 'subscriptions' && <SubscriptionsSection authorized={authorized} />}
        </div>
      </div>
    </RoleGuard>
  );
}
