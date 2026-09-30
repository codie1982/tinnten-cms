'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Inbox, RefreshCw, Loader2, X, Mail, Reply, Forward, Search,
  ArrowUpDown, ChevronUp, ChevronDown, CheckCheck, MailOpen,
  Archive, CloudDownload, CloudOff,
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
import { COMPOSE_PREFILL_KEY } from '@/lib/mail-compose-handoff';
import {
  useDeleteInboxMutation,
  useGetInboxDeleteJobQuery,
  useGetInboxMailQuery,
  useLazyGetInboxQuery,
  useSetInboxReadMutation,
  useSyncInboxMutation,
} from '@/redux/services';

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
// Çoklu alıcı: ilk adres ("Ad <a@b>, c@d" → a@b)
const firstEmailOf = (s) => emailOf(String(s || '').split(',')[0]);

const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripHtml = (html) => String(html || '')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<\/(p|div|br|tr|li|h[1-6])>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// "Re:"/"Fwd:" (TR varyantları dahil) baştaki önekleri kırpar.
const stripSubjectPrefix = (s) =>
  String(s || '').replace(/^\s*(re|fwd|fw|yan|ynt|ilt)\s*:\s*/i, '').trim();

const chunksOf = (items, size = 100) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const ACTIVE_DELETE_JOB_KEY = 'tinnten.cms.inbox.activeDeleteJob';

// Cevapla/İlet için orijinal maili alıntılayan editör içeriği (HTML).
const buildQuotedBody = (mail) => {
  const meta = [
    ['Kimden', mail.from], ['Tarih', formatTrDateTime(mail.date)],
    ['Konu', mail.subject], ['Kime', mail.to],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<b>${escapeHtml(k)}:</b> ${escapeHtml(v)}`)
    .join('<br>');
  const bodyText = mail.text && mail.text.trim() ? mail.text : stripHtml(mail.html);
  const quoted = escapeHtml(bodyText).replace(/\n/g, '<br>');
  return `<p></p><p>---------- Orijinal Mesaj ----------</p><p>${meta}</p><blockquote>${quoted}</blockquote>`;
};

export default function InboxPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const [loadInbox, { isFetching }] = useLazyGetInboxQuery();
  const [items, setItems] = useState([]);
  const [nextToken, setNextToken] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [recipient, setRecipient] = useState('all');
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [readFilter, setReadFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('date'); // 'date' | 'from' | 'to' | 'subject'
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [detailKey, setDetailKey] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteJobId, setDeleteJobId] = useState(null);
  const {
    data: deleteJob,
    error: deleteJobStatusError,
  } = useGetInboxDeleteJobQuery(deleteJobId, {
    skip: !deleteJobId || !authorized,
    pollingInterval: deleteJobId ? 1500 : 0,
    refetchOnMountOrArgChange: true,
  });

  const fetchPage = async (token) => {
    setError('');
    try {
      // preferCacheValue=false (varsayılan) → her çağrıda taze veri çeker (Yenile).
      const d = await loadInbox({
        limit: 25,
        token: token || undefined,
        recipient,
        read: readFilter,
        query: query.trim() || undefined,
        sortKey,
        sortDir,
      }).unwrap();
      setItems((prev) => (token ? [...prev, ...(d.items || [])] : d.items || []));
      if (!token) setSelectedKeys([]);
      setNextToken(d.nextToken || null);
      setTotal(Number(d.total) || 0);
      if (Array.isArray(d.recipients)) setRecipientOptions(d.recipients);
    } catch (e) {
      setError(e?.data?.message || e?.normalizedMessage || 'Gelen kutusu yüklenemedi.');
    } finally {
      setLoadedOnce(true);
    }
  };

  useEffect(() => {
    if (!authorized) return undefined;
    const timer = window.setTimeout(() => fetchPage(null), query ? 300 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, recipient, readFilter, query, sortKey, sortDir]);

  // Sekme yenilense de kuyruktaki silme işinin durumunu izlemeye devam et.
  useEffect(() => {
    if (!authorized) return;
    try {
      const activeJobId = localStorage.getItem(ACTIVE_DELETE_JOB_KEY);
      if (activeJobId) {
        setDeleteJobId(activeJobId);
        setActionBusy(true);
      }
    } catch { /* localStorage kullanılamıyorsa yalnız bu oturumda izle */ }
  }, [authorized]);

  useEffect(() => {
    if (!deleteJobId || !deleteJob) return;
    const requested = Number(deleteJob.requested) || 0;
    const processed = Number(deleteJob.processed) || 0;
    const deleted = Number(deleteJob.deleted) || 0;
    const failedCount = Number(deleteJob.failedCount) || 0;
    const terminal = ['completed', 'partial', 'failed'].includes(deleteJob.status);

    if (!terminal) {
      setActionBusy(true);
      setNotice(`Silme kuyruğu işleniyor: ${processed} / ${requested} mail tamamlandı.`);
      return;
    }

    try { localStorage.removeItem(ACTIVE_DELETE_JOB_KEY); } catch { /* yoksay */ }
    setDeleteJobId(null);
    setActionBusy(false);
    setSelectedKeys([]);
    setDetailKey(null);
    fetchPage(null);

    if (deleteJob.status === 'failed') {
      setNotice('');
      setActionError(deleteJob.error || `Silme işi ${processed} / ${requested} mailden sonra durdu.`);
    } else if (failedCount > 0) {
      setNotice('');
      setActionError(`${deleted} mail silindi, ${failedCount} mail silinemedi.`);
    } else {
      setActionError('');
      setNotice(deleteJob.deleteFromAws
        ? `${deleted} mail sistemden ve AWS S3'ten kalıcı olarak silindi.`
        : `${deleted} mail sistemden kaldırıldı; AWS kopyası korundu.`);
    }
    // fetchPage her render'da yeniden oluştuğu için yalnız iş durumu değişimlerini izle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteJobId, deleteJob]);

  useEffect(() => {
    if (!deleteJobId || !deleteJobStatusError) return;
    if (deleteJobStatusError.status === 404) {
      try { localStorage.removeItem(ACTIVE_DELETE_JOB_KEY); } catch { /* yoksay */ }
      setDeleteJobId(null);
      setActionBusy(false);
      setActionError('Silme işi kaydı bulunamadı. Listeyi yenileyip tekrar deneyin.');
      return;
    }
    setActionError('Silme kuyruğu durumu geçici olarak alınamadı; işlem sunucuda devam ediyor.');
  }, [deleteJobId, deleteJobStatusError]);

  // Yenile: baştan (page 1) taze çek + sayfalamayı sıfırla.
  const refresh = () => {
    setActionError('');
    setNotice('');
    setNextToken(null);
    fetchPage(null);
  };

  // Filtreleme, sıralama ve sayfalama backend'de MongoDB üzerinden yapılır.
  const sorted = items;

  const unreadCount = items.filter((m) => !m.read).length;

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'date' ? 'desc' : 'asc'); }
  };

  const { data: detail, isFetching: detailLoading } = useGetInboxMailQuery(detailKey, { skip: !detailKey });
  const [setInboxRead] = useSetInboxReadMutation();
  const [deleteInbox] = useDeleteInboxMutation();
  const [syncInbox] = useSyncInboxMutation();

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

  const toggleSelected = (key) => {
    setSelectedKeys((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    ));
  };

  const allVisibleSelected = sorted.length > 0 && sorted.every((m) => selectedKeys.includes(m.key));
  const toggleAllVisible = () => {
    const visibleKeys = sorted.map((m) => m.key);
    setSelectedKeys((prev) => (
      allVisibleSelected
        ? prev.filter((key) => !visibleKeys.includes(key))
        : [...new Set([...prev, ...visibleKeys])]
    ));
  };

  const setReadForKeys = async (keys, read) => {
    if (!keys.length) return;
    setActionBusy(true);
    setActionError('');
    setNotice('');
    const updatedKeys = [];
    try {
      for (const batch of chunksOf(keys)) {
        await setInboxRead({ keys: batch, read }).unwrap();
        updatedKeys.push(...batch);
      }
      setItems((prev) => prev.map((m) => (updatedKeys.includes(m.key) ? { ...m, read } : m)));
      setNotice(`${keys.length} mail ${read ? 'okundu' : 'okunmadı'} olarak işaretlendi.`);
    } catch (e) {
      if (updatedKeys.length) {
        setItems((prev) => prev.map((m) => (updatedKeys.includes(m.key) ? { ...m, read } : m)));
      }
      const prefix = updatedKeys.length ? `${updatedKeys.length} mail güncellendi. ` : '';
      setActionError(`${prefix}${e?.data?.message || e?.normalizedMessage || 'Toplu işlem tamamlanamadı.'}`);
    } finally {
      setActionBusy(false);
    }
  };

  const deleteMails = async (keys, deleteFromAws) => {
    if (!keys.length) return;
    const label = keys.length === 1 ? 'Bu mail' : `${keys.length} mail`;
    const confirmation = deleteFromAws
      ? `${label} hem sistemden hem AWS S3'ten kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`
      : `${label} sistemden kaldırılsın mı? AWS kopyası korunacak.`;
    if (!window.confirm(confirmation)) return;

    setActionBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = await deleteInbox({ keys, deleteFromAws }).unwrap();
      if (!result?.jobId) throw new Error('Silme işi kimliği alınamadı.');
      setDeleteJobId(result.jobId);
      try { localStorage.setItem(ACTIVE_DELETE_JOB_KEY, result.jobId); } catch { /* yoksay */ }
      setNotice(`${Number(result.requested) || keys.length} mail silme kuyruğuna alındı: 0 / ${Number(result.requested) || keys.length} tamamlandı.`);
    } catch (e) {
      setActionBusy(false);
      setActionError(e?.data?.message || e?.normalizedMessage || e?.message || 'Silme işi kuyruğa alınamadı.');
    }
  };

  const syncFromAws = async () => {
    setActionBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = await syncInbox(100).unwrap();
      await fetchPage(null);
      const pending = Number(result?.pending) || 0;
      setNotice(`${Number(result?.imported) || 0} mail DB'ye aktarıldı.${pending ? ` ${pending} mail sonraki senkronizasyonu bekliyor.` : ''}`);
    } catch (e) {
      setActionError(e?.data?.message || e?.normalizedMessage || 'AWS senkronizasyonu tamamlanamadı.');
    } finally {
      setActionBusy(false);
    }
  };

  // Cevapla/İlet: taslağı sessionStorage'a bırakıp Yeni Mail sayfasına yönlen.
  const goCompose = (payload) => {
    try { sessionStorage.setItem(COMPOSE_PREFILL_KEY, JSON.stringify(payload)); } catch { /* yoksay */ }
    router.push('/cms/email/compose');
  };
  const replyTo = () => detail && goCompose({
    from: firstEmailOf(detail.to),        // maili alan adresten yanıtla (compose izinliyse seçer)
    to: firstEmailOf(detail.from),        // gönderen → alıcı
    subject: `Re: ${stripSubjectPrefix(detail.subject)}`,
    html: buildQuotedBody(detail),
  });
  const forward = () => detail && goCompose({
    to: '',
    subject: `Fwd: ${stripSubjectPrefix(detail.subject)}`,
    html: buildQuotedBody(detail),
  });
  // Satırdan hızlı cevap: gövde henüz yüklü olmadığından yalnızca başlıklarla devreder.
  const replyRow = (m) => goCompose({
    from: firstEmailOf(m.to),
    to: firstEmailOf(m.from),
    subject: `Re: ${stripSubjectPrefix(m.subject)}`,
    html: '<p></p>',
  });

  const SortHead = ({ label, k, className }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 select-none hover:text-foreground"
      >
        {label}
        {sortKey === k
          ? (sortDir === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />)
          : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </TableHead>
  );

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Gelen Mailler"
        description="Mailler MongoDB'den listelenir; AWS yalnız kaynak arşividir"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={syncFromAws} disabled={actionBusy || isFetching}>
              {actionBusy ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />} AWS Senkronize
            </Button>
            <Button variant="outline" onClick={refresh} disabled={isFetching || actionBusy}>
              <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /> DB Yenile
            </Button>
          </div>
        }
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Gönderen, alıcı, konu ara…"
              className="pl-8"
            />
          </div>
          <div className="w-72">
            <Select value={recipient} onValueChange={setRecipient}>
              <SelectTrigger><SelectValue placeholder="Alıcıya göre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Alıcılar</SelectItem>
                {recipientOptions.map((item) => (
                  <SelectItem key={item.email} value={item.email}>
                    {item.email} ({item.count})
                  </SelectItem>
                ))}
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
          <span className="text-xs text-muted-foreground">{items.length} / {total} mail · yüklenenlerde {unreadCount} okunmadı</span>
          {selectedKeys.length > 0 && (
            <div className="flex basis-full flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="me-auto text-sm font-medium">{selectedKeys.length} mail seçili</span>
              <Button variant="outline" size="sm" disabled={actionBusy} onClick={() => setReadForKeys(selectedKeys, true)}>
                <CheckCheck className="size-4" /> Okundu
              </Button>
              <Button variant="outline" size="sm" disabled={actionBusy} onClick={() => setReadForKeys(selectedKeys, false)}>
                <MailOpen className="size-4" /> Okunmadı
              </Button>
              <Button variant="outline" size="sm" disabled={actionBusy} onClick={() => deleteMails(selectedKeys, false)}>
                <Archive className="size-4" /> Sistemden Kaldır
              </Button>
              <Button variant="destructive" size="sm" disabled={actionBusy} onClick={() => deleteMails(selectedKeys, true)}>
                {actionBusy ? <Loader2 className="size-4 animate-spin" /> : <CloudOff className="size-4" />} AWS Dahil Sil
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {notice && (
        <Alert className="mb-5">
          <AlertTitle>{deleteJobId ? 'İşlem kuyruğa alındı' : 'İşlem tamamlandı'}</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {actionError && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>İşlem tamamlanamadı</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gelen Kutusu</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{items.length}{total ? ` / ${total}` : ''} yüklendi</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {error ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div>
          ) : !loadedOnce && isFetching ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : sorted.length === 0 ? (
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
                      <TableHead className="w-12 text-center">
                        <input
                          type="checkbox"
                          aria-label="Görünen maillerin tümünü seç"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                          className="size-4 cursor-pointer accent-primary"
                        />
                      </TableHead>
                      <SortHead label="Gönderen" k="from" />
                      <SortHead label="Alıcı" k="to" />
                      <SortHead label="Konu" k="subject" />
                      <SortHead label="Tarih" k="date" />
                      <TableHead className="w-px" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((m) => (
                      <TableRow key={m.key} className={`cursor-pointer ${selectedKeys.includes(m.key) ? 'bg-primary/[0.07]' : (!m.read ? 'bg-primary/[0.03]' : '')}`} onClick={() => openDetail(m.key)}>
                        <TableCell className="w-12 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`${m.subject || 'Mail'} seç`}
                            checked={selectedKeys.includes(m.key)}
                            onChange={() => toggleSelected(m.key)}
                            className="size-4 cursor-pointer accent-primary"
                          />
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-sm">
                          <span className="inline-flex items-center gap-2">
                            {!m.read && <span className="size-2 shrink-0 rounded-full bg-primary" title="Okunmadı" />}
                            <span className={!m.read ? 'font-semibold text-foreground' : 'text-foreground'}>{m.from || '—'}</span>
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{m.to || '—'}</TableCell>
                        <TableCell className={`max-w-xs truncate text-sm ${!m.read ? 'font-medium text-foreground' : 'text-foreground'}`}>{m.subject}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTrDateTime(m.date)}</TableCell>
                        <TableCell className="whitespace-nowrap py-1 pe-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Cevapla"
                            onClick={() => replyRow(m)}
                          >
                            <Reply className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Sistemden kaldır, AWS'de sakla"
                            disabled={actionBusy}
                            onClick={() => deleteMails([m.key], false)}
                          >
                            <Archive className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Sistemden ve AWS S3'ten kalıcı sil"
                            disabled={actionBusy}
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMails([m.key], true)}
                          >
                            <CloudOff className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {nextToken && (
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
                <Button variant="outline" size="sm" onClick={replyTo} disabled={!detail}>
                  <Reply className="size-4" /> Cevapla
                </Button>
                <Button variant="outline" size="sm" onClick={forward} disabled={!detail}>
                  <Forward className="size-4" /> İlet
                </Button>
                <Button variant="outline" size="sm" onClick={() => deleteMails([detailKey], false)} disabled={!detail || actionBusy}>
                  <Archive className="size-4" /> Sistemden Kaldır
                </Button>
                <Button variant="destructive" size="sm" onClick={() => deleteMails([detailKey], true)} disabled={!detail || actionBusy}>
                  {actionBusy ? <Loader2 className="size-4 animate-spin" /> : <CloudOff className="size-4" />} AWS Dahil Sil
                </Button>
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
                    <Button variant="outline" size="sm" onClick={() => markUnread(detailKey)}>
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
