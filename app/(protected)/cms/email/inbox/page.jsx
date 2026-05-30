'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Inbox, RefreshCw, Loader2, X, Mail } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useLazyGetInboxQuery, useGetInboxMailQuery, useSetInboxReadMutation } from '@/redux/services';

function formatTrDateTime(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}
// "Ad <a@b.com>" → a@b.com
const emailOf = (s) => {
  const m = /<([^>]+)>/.exec(s || '');
  return (m ? m[1] : s || '').trim().toLowerCase();
};

export default function InboxPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const [loadInbox, { isFetching }] = useLazyGetInboxQuery();
  const [items, setItems] = useState([]);
  const [nextToken, setNextToken] = useState(null);
  const [error, setError] = useState('');
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [recipient, setRecipient] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  const [detailKey, setDetailKey] = useState(null);

  const fetchPage = async (token) => {
    setError('');
    try {
      const d = await loadInbox({ limit: 25, token: token || undefined }).unwrap();
      setItems((prev) => (token ? [...prev, ...(d.items || [])] : d.items || []));
      setNextToken(d.nextToken || null);
    } catch (e) {
      setError(e?.data?.message || e?.normalizedMessage || 'Gelen kutusu yüklenemedi.');
    } finally {
      setLoadedOnce(true);
    }
  };

  useEffect(() => {
    if (authorized) fetchPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  // Kullanıcı (alıcı) bazlı sınıflama
  const recipients = useMemo(() => {
    const set = new Set(items.map((m) => emailOf(m.to)).filter(Boolean));
    return [...set].sort();
  }, [items]);
  const filtered = items
    .filter((m) => recipient === 'all' || emailOf(m.to) === recipient)
    .filter((m) => readFilter === 'all' || (readFilter === 'unread' ? !m.read : m.read));
  const unreadCount = items.filter((m) => !m.read).length;

  const { data: detail, isFetching: detailLoading } = useGetInboxMailQuery(detailKey, { skip: !detailKey });
  const [setInboxRead] = useSetInboxReadMutation();

  const openDetail = (key) => {
    setDetailKey(key);
    // Açılışta backend okundu işaretliyor → listede de optimistik güncelle
    setItems((prev) => prev.map((m) => (m.key === key ? { ...m, read: true } : m)));
  };
  const markUnread = async (key) => {
    await setInboxRead({ key, read: false }).unwrap().catch(() => {});
    setItems((prev) => prev.map((m) => (m.key === key ? { ...m, read: false } : m)));
    setDetailKey(null);
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Gelen Mailler"
        description="@tinnten.com ve @tinten.ai adreslerine gelen e-postalar (S3 inbox)"
        actions={
          <Button variant="outline" onClick={() => fetchPage(null)} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /> Yenile
          </Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="w-72">
            <Select value={recipient} onValueChange={setRecipient}>
              <SelectTrigger><SelectValue placeholder="Alıcıya göre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Alıcılar</SelectItem>
                {recipients.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select value={readFilter} onValueChange={setReadFilter}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="unread">Okunmadı</SelectItem>
                <SelectItem value="read">Okundu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} / {items.length} mail · {unreadCount} okunmadı</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gelen Kutusu</CardTitle>
          <CardToolbar><Badge variant="muted">{items.length} yüklendi</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {error ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div>
          ) : !loadedOnce && isFetching ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Mail yok</p>
              <p className="text-sm text-muted-foreground">Bu kriterde gelen mail bulunmuyor.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gönderen</TableHead>
                      <TableHead>Alıcı</TableHead>
                      <TableHead>Konu</TableHead>
                      <TableHead>Tarih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m) => (
                      <TableRow key={m.key} className={`cursor-pointer ${!m.read ? 'bg-primary/[0.03]' : ''}`} onClick={() => openDetail(m.key)}>
                        <TableCell className="max-w-[220px] truncate text-sm">
                          <span className="inline-flex items-center gap-2">
                            {!m.read && <span className="size-2 shrink-0 rounded-full bg-primary" title="Okunmadı" />}
                            <span className={!m.read ? 'font-semibold text-foreground' : 'text-foreground'}>{m.from || '—'}</span>
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{m.to || '—'}</TableCell>
                        <TableCell className={`max-w-xs truncate text-sm ${!m.read ? 'font-medium text-foreground' : 'text-foreground'}`}>{m.subject}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTrDateTime(m.date)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {nextToken && recipient === 'all' && (
                <div className="flex justify-center border-t border-border p-3">
                  <Button variant="outline" size="sm" onClick={() => fetchPage(nextToken)} disabled={isFetching}>
                    {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Inbox className="size-4" />} Daha Fazla Yükle
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detay modalı */}
      {detailKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={() => setDetailKey(null)}>
          <Card className="flex max-h-[88vh] w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="truncate">{detail?.subject || 'Mail'}</CardTitle>
              <CardToolbar>
                <Button variant="ghost" size="icon" onClick={() => setDetailKey(null)}><X className="size-4" /></Button>
              </CardToolbar>
            </CardHeader>
            <CardContent className="space-y-3 overflow-y-auto p-5">
              {detailLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : detail ? (
                <>
                  <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                    <div className="truncate"><span className="text-muted-foreground">Gönderen: </span>{detail.from || '—'}</div>
                    <div className="truncate"><span className="text-muted-foreground">Alıcı: </span>{detail.to || '—'}</div>
                    {detail.cc && <div className="truncate"><span className="text-muted-foreground">CC: </span>{detail.cc}</div>}
                    <div><span className="text-muted-foreground">Tarih: </span>{formatTrDateTime(detail.date)}</div>
                  </div>
                  {detail.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {detail.attachments.map((a, i) => (
                        <Badge key={i} variant="muted"><Mail className="me-1 size-3" />{a.filename || a.contentType}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="rounded-lg border border-border">
                    {detail.html ? (
                      <iframe title="mail" srcDoc={detail.html} className="h-[55vh] w-full rounded-lg bg-white" sandbox="" />
                    ) : (
                      <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap p-4 text-sm">{detail.text || '(içerik yok)'}</pre>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="min-w-0 text-xs text-muted-foreground">
                      {detail.readers?.length > 0 ? (
                        <span>
                          <span className="font-medium text-foreground">Okuyanlar: </span>
                          {detail.readers
                            .map((r) => `${r.name || 'Kullanıcı'}${r.readAt ? ` · ${formatTrDateTime(r.readAt)}` : ''}`)
                            .join('  •  ')}
                        </span>
                      ) : (
                        <span>Henüz okuyan kaydı yok.</span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markUnread(detailKey)}
                    >
                      Okunmadı Yap
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Mail yüklenemedi.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </RoleGuard>
  );
}
