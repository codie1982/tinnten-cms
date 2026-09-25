'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Inbox, MessageSquareMore, Send, Search, RefreshCw, X, ExternalLink } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetSmsMessagesQuery,
  useGetSmsSenderQuery,
  useGetSmsRecipientsQuery,
  useGetSmsMessageQuery,
  useSendSmsMutation,
  useSyncSmsMessagesMutation,
  useSetSmsReadMutation,
} from '@/redux/services';

const STATUS = {
  accepted: ['Kabul edildi', 'secondary'], queued: ['Kuyrukta', 'warning'], sending: ['Gönderiliyor', 'warning'],
  sent: ['Gönderildi', 'success'], delivered: ['Teslim edildi', 'success'], received: ['Alındı', 'success'],
  undelivered: ['Teslim edilemedi', 'destructive'], failed: ['Başarısız', 'destructive'],
};
const dateTime = (value) => value && !Number.isNaN(new Date(value).getTime())
  ? new Date(value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const preview = (text) => String(text || '').replace(/\s+/g, ' ').trim();

function StatusBadge({ status }) {
  const [label, variant] = STATUS[status] || [status || 'Bilinmiyor', 'muted'];
  return <Badge variant={variant}>{label}</Badge>;
}

function SmsList({ direction, onDetail }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, isLoading, isFetching, error, refetch } = useGetSmsMessagesQuery({
    direction, query: submitted || undefined, page, limit: pageSize,
  }, { pollingInterval: 5000, skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnMountOrArgChange: true });
  const items = data?.items || [];
  const title = direction === 'inbound' ? 'Gelen SMS’ler' : 'Gönderilen SMS günlüğü';
  const search = () => { setPage(1); setSubmitted(query.trim()); };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardToolbar><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">5 sn’de bir güncellenir</span>{direction === 'inbound' && data?.unreadCount > 0 && <Badge variant="warning">{data.unreadCount} yeni</Badge>}<Badge variant="muted">{data?.total ?? 0} kayıt</Badge></div></CardToolbar>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-0">
        <div className="flex gap-2 px-5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Numara, metin veya Twilio SID ara" className="ps-9" />
          </div>
          <Button variant="outline" onClick={search} disabled={isFetching}><Search className="size-4" />Ara</Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Yenile"><RefreshCw className="size-4" /></Button>
        </div>
        {error ? <div className="px-5 pb-5"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>{error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}</AlertDescription></Alert></div>
          : isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          : !items.length ? <div className="py-14 text-center text-sm text-muted-foreground">Henüz kayıt yok.</div>
          : <div className="overflow-x-auto"><Table><TableHeader><TableRow>
            <TableHead>{direction === 'inbound' ? 'Gönderen' : 'Alıcı'}</TableHead><TableHead>Mesaj</TableHead><TableHead>Durum</TableHead>{direction === 'outbound' && <TableHead>Twilio SID / Hata</TableHead>}<TableHead>{direction === 'inbound' ? 'Geliş tarihi' : 'Oluşturulma / Güncelleme'}</TableHead>
          </TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item._id} className="cursor-pointer" onClick={() => onDetail(item._id)}>
            <TableCell><p className="font-medium">{direction === 'inbound' ? item.from : item.recipientName || item.to}</p><p className="text-xs text-muted-foreground">{direction === 'inbound' ? `Kime: ${item.to}` : `${item.recipientName ? `${item.to} · ` : ''}Kimden: ${item.from}`}</p></TableCell>
            <TableCell className="max-w-md truncate">{preview(item.body) || '—'}{item.numMedia > 0 && <span className="ms-2 text-xs text-muted-foreground">+{item.numMedia} medya</span>}</TableCell>
            <TableCell><StatusBadge status={item.status} />{direction === 'inbound' && !item.read && <Badge className="ms-2" variant="warning">Yeni</Badge>}</TableCell>
            {direction === 'outbound' && <TableCell className="max-w-44 text-xs"><code className="break-all">{item.twilioMessageSid || '—'}</code>{(item.errorCode || item.errorMessage) && <p className="mt-1 text-destructive">{item.errorCode || item.errorMessage}</p>}</TableCell>}
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground"><div>{dateTime(item.dateCreatedProvider || item.createdAt)}</div>{direction === 'outbound' && <div>Güncelleme: {dateTime(item.dateUpdatedProvider || item.updatedAt)}</div>}</TableCell>
          </TableRow>)}</TableBody></Table></div>}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>Sayfa {page} · Toplam {data?.total ?? 0} kayıt</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((value) => value - 1)}>Önceki</Button><Button variant="outline" size="sm" disabled={isFetching || page * pageSize >= (data?.total ?? 0)} onClick={() => setPage((value) => value + 1)}>Sonraki</Button></div></div>
      </CardContent>
    </Card>
  );
}

function ComposeSms() {
  const [mode, setMode] = useState('saved');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState(null);
  const [sendSms, { isLoading }] = useSendSmsMutation();
  const { data: sender, isLoading: senderLoading, error: senderError } = useGetSmsSenderQuery();
  const { data: recipients = [], isFetching: searching, error: searchError } = useGetSmsRecipientsQuery(debouncedSearch, {
    skip: mode !== 'saved' || debouncedSearch.length < 2,
  });
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const chars = body.length;
  const submit = async (event) => {
    event.preventDefault(); setNotice(null);
    try {
      const destination = mode === 'saved'
        ? { recipientUserId: selected.userId, recipientPhoneId: selected.phoneId }
        : { to: to.trim() };
      const item = await sendSms({ ...destination, body }).unwrap();
      setNotice({ kind: 'success', text: `Twilio kabul etti: ${item.twilioMessageSid || 'SID bekleniyor'}` });
      setTo(''); setBody(''); setSelected(null);
    } catch (error) {
      setNotice({ kind: 'error', text: error?.data?.message || error?.normalizedMessage || 'SMS gönderilemedi.' });
    }
  };
  return <Card className="max-w-3xl"><CardHeader><CardTitle>Yeni SMS</CardTitle></CardHeader><CardContent>
    <form className="space-y-5" onSubmit={submit}>
      {notice && <Alert variant={notice.kind === 'error' ? 'destructive' : 'default'}><AlertDescription>{notice.text}</AlertDescription></Alert>}
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <div className="font-medium">Gönderen: {sender?.senderLabel || 'Tinten'}</div>
        <div className="mt-1 text-muted-foreground">Alıcı telefonunda görünen numara: <span className="font-medium text-foreground">{senderLoading ? 'Yükleniyor…' : sender?.fromNumber || 'Sunucuda ayarlanmadı'}</span></div>
        {senderError && <p className="mt-2 text-destructive">Gönderici bilgisi alınamadı.</p>}
        {!senderLoading && !sender?.ready && <p className="mt-2 text-destructive">SMS göndermek için sunucuda Twilio numarası yapılandırılmalı.</p>}
      </div>
      <div className="space-y-3">
        <div className="text-sm font-medium">Alıcı</div>
        <div className="flex gap-2">
          <Button type="button" variant={mode === 'saved' ? 'default' : 'outline'} onClick={() => setMode('saved')}>Kayıtlı kullanıcı</Button>
          <Button type="button" variant={mode === 'manual' ? 'default' : 'outline'} onClick={() => setMode('manual')}>Numarayı elle gir</Button>
        </div>
        {mode === 'saved' ? <div className="space-y-3">
          <div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setSelected(null); }} placeholder="Ad, e-posta veya telefon ara" className="ps-9" /></div>
          {selected && <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm"><div className="font-medium">Seçilen: {selected.name}</div><div>{selected.number}</div><Button type="button" variant="link" className="h-auto p-0" onClick={() => setSelected(null)}>Seçimi değiştir</Button></div>}
          {!selected && debouncedSearch.length >= 2 && <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {searching ? <p className="p-2 text-sm text-muted-foreground">Kullanıcılar aranıyor…</p>
              : searchError ? <p className="p-2 text-sm text-destructive">Kullanıcılar yüklenemedi.</p>
              : !recipients.length ? <p className="p-2 text-sm text-muted-foreground">Telefonu kayıtlı kullanıcı bulunamadı.</p>
              : recipients.map((user) => <div key={user.id} className="border-b border-border p-2 last:border-0"><p className="text-sm font-medium">{user.name} <span className="font-normal text-muted-foreground">{user.email}</span></p><div className="mt-1 flex flex-wrap gap-2">{user.phones.map((phone) => <Button key={phone.id} type="button" size="sm" variant="outline" disabled={!phone.normalizedNumber} onClick={() => setSelected({ userId: user.id, phoneId: phone.id, name: user.name, number: phone.normalizedNumber })}>{phone.normalizedNumber || phone.number}{phone.isPrimary ? ' · Birincil' : ''}{phone.label ? ` · ${phone.label}` : ''}</Button>)}</div></div>)}
          </div>}
          {debouncedSearch.length < 2 && !selected && <p className="text-xs text-muted-foreground">Aramak için en az 2 karakter yazın.</p>}
        </div> : <div className="space-y-2"><label htmlFor="sms-to" className="text-sm font-medium">Alıcı numarası</label><Input id="sms-to" required value={to} onChange={(event) => setTo(event.target.value)} placeholder="+905xxxxxxxxx" inputMode="tel" /><p className="text-xs text-muted-foreground">Ülke koduyla girin; Türk numaralarında 05xxxxxxxxx biçimi de kabul edilir.</p></div>}
      </div>
      <div className="space-y-2"><div className="flex justify-between"><label htmlFor="sms-body" className="text-sm font-medium">Mesaj</label><span className={chars > 1600 ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>{chars}/1600</span></div><textarea id="sms-body" required maxLength={1600} value={body} onChange={(e) => setBody(e.target.value)} className="min-h-36 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" placeholder="SMS metnini yazın…" /></div>
      <Button type="submit" disabled={isLoading || !sender?.ready || !(mode === 'saved' ? selected : to.trim()) || !body.trim()}><Send className="size-4" />{isLoading ? 'Twilio’ya iletiliyor…' : 'SMS Gönder'}</Button>
    </form>
  </CardContent></Card>;
}

function SmsDetail({ id, onClose }) {
  const { data: item, isLoading } = useGetSmsMessageQuery(id, {
    skip: !id, pollingInterval: 5000, skipPollingIfUnfocused: true, refetchOnFocus: true,
  });
  const [setRead] = useSetSmsReadMutation();
  const raw = useMemo(() => item && JSON.stringify({
    createResponse: item.rawCreateResponse, providerMessage: item.rawProviderMessage,
    incomingWebhook: item.rawIncomingWebhook, statusCallbacks: item.statusCallbacks,
  }, null, 2), [item]);
  const statusLog = useMemo(() => {
    if (!item || item.direction !== 'outbound') return [];
    const firstStatus = item.rawCreateResponse?.status || item.rawProviderMessage?.status || item.status;
    const entries = [{ status: firstStatus, at: item.dateCreatedProvider || item.createdAt, source: 'Twilio kaydı' }];
    for (const callback of item.statusCallbacks || []) {
      entries.push({
        status: callback.payload?.MessageStatus || callback.payload?.SmsStatus || callback.payload?.status,
        at: callback.receivedAt,
        source: 'Durum bildirimi',
        error: callback.payload?.ErrorCode || callback.payload?.ErrorMessage,
      });
    }
    if (entries.at(-1)?.status !== item.status) {
      entries.push({ status: item.status, at: item.dateUpdatedProvider || item.updatedAt, source: 'Son durum' });
    }
    return entries;
  }, [item]);
  if (!id) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}><Card className="flex max-h-[90vh] w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}><CardHeader><CardTitle>SMS Detayı</CardTitle><CardToolbar><Button size="icon" variant="ghost" onClick={onClose}><X className="size-4" /></Button></CardToolbar></CardHeader><CardContent className="space-y-4 overflow-y-auto pb-5">
    {isLoading || !item ? <Skeleton className="h-52 w-full" /> : <>
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"><div><span className="text-muted-foreground">Kimden: </span>{item.from}</div><div><span className="text-muted-foreground">Kime: </span>{item.to}</div><div><span className="text-muted-foreground">Durum: </span><StatusBadge status={item.status} /></div><div><span className="text-muted-foreground">Twilio SID: </span><code className="break-all text-xs">{item.twilioMessageSid || '—'}</code></div><div><span className="text-muted-foreground">Fiyat: </span>{item.price ? `${item.price} ${item.priceUnit || ''}` : '—'}</div><div><span className="text-muted-foreground">Segment: </span>{item.numSegments ?? '—'}</div></div>
      <div className="rounded-lg border border-border p-3 whitespace-pre-wrap text-sm">{item.body || '—'}</div>
      {item.direction === 'outbound' && <div className="space-y-2"><h3 className="text-sm font-semibold">Gönderim günlüğü</h3><div className="divide-y divide-border rounded-lg border border-border">{statusLog.map((entry, index) => <div key={`${entry.source}-${index}`} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><div className="flex items-center gap-2"><StatusBadge status={entry.status} /><span className="text-muted-foreground">{entry.source}</span>{entry.error && <span className="text-destructive">Hata: {entry.error}</span>}</div><span className="text-xs text-muted-foreground">{dateTime(entry.at)}</span></div>)}</div></div>}
      {item.errorMessage && <Alert variant="destructive"><AlertTitle>{item.errorCode || 'Twilio hatası'}</AlertTitle><AlertDescription>{item.errorMessage}</AlertDescription></Alert>}
      {item.direction === 'inbound' && !item.read && <Button variant="outline" onClick={() => setRead({ id, read: true })}>Okundu işaretle</Button>}
      {item.media?.length > 0 && <div><h3 className="mb-2 text-sm font-semibold">Medya</h3>{item.media.map((media) => <div key={media.index} className="flex items-center gap-2 text-sm"><span>{media.contentType || 'Medya'}</span>{media.url && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={media.url} target="_blank" rel="noreferrer">Twilio URL <ExternalLink className="size-3" /></a>}</div>)}</div>}
      <details><summary className="cursor-pointer text-sm font-medium">Twilio’dan alınan tüm ham veriler</summary><pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs">{raw}</pre></details>
    </>}
  </CardContent></Card></div>;
}

export default function SmsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const [detailId, setDetailId] = useState(null);
  const [syncSms, { isLoading: syncing }] = useSyncSmsMessagesMutation();
  const [syncNotice, setSyncNotice] = useState(null);
  const sync = async () => {
    setSyncNotice(null);
    try {
      const result = await syncSms().unwrap();
      setSyncNotice({ kind: 'success', text: `${result.fetched} kayıt Twilio’dan okundu; ${result.imported} yeni, ${result.updated} güncellendi.${result.hasMore ? ' Daha eski kayıtlar da mevcut.' : ''}` });
    } catch (error) {
      setSyncNotice({ kind: 'error', text: error?.data?.message || error?.normalizedMessage || 'Twilio kayıtları okunamadı.' });
    }
  };
  return <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}><PageHeader section="Email · SMS" title="SMS" description="Twilio numarası üzerinden gelen ve gönderilen mesajlar" actions={<Button variant="outline" disabled={syncing} onClick={sync}><RefreshCw className={syncing ? 'size-4 animate-spin' : 'size-4'} />Twilio’dan eşitle</Button>} />
    {syncNotice && <Alert className="mb-5" variant={syncNotice.kind === 'error' ? 'destructive' : 'default'}><AlertDescription>{syncNotice.text}</AlertDescription></Alert>}
    {authorized && <Tabs defaultValue="inbound" className="space-y-5"><TabsList><TabsTrigger value="inbound"><Inbox className="me-2 size-4" />Gelen SMS’ler</TabsTrigger><TabsTrigger value="outbound"><MessageSquareMore className="me-2 size-4" />Gönderilen SMS’ler</TabsTrigger><TabsTrigger value="compose"><Send className="me-2 size-4" />Yeni SMS</TabsTrigger></TabsList><TabsContent value="inbound"><SmsList direction="inbound" onDetail={setDetailId} /></TabsContent><TabsContent value="outbound"><SmsList direction="outbound" onDetail={setDetailId} /></TabsContent><TabsContent value="compose"><ComposeSms /></TabsContent></Tabs>}
    <SmsDetail id={detailId} onClose={() => setDetailId(null)} />
  </RoleGuard>;
}
