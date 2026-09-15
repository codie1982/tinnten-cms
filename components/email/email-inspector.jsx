'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  CircleAlert,
  Eye,
  History,
  ListFilter,
  Loader2,
  Mail,
  MousePointerClick,
  RefreshCw,
  Search,
  Send,
  ShieldBan,
  UserRound,
  X,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useGetCmsEmailInsightQuery, useGetSentMailQuery } from '@/redux/services';

const countFormatter = new Intl.NumberFormat('tr-TR');
const formatCount = (value) => countFormatter.format(Number(value) || 0);

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const DELIVERY_META = {
  sendable: { label: 'Gönderilebilir', variant: 'success', Icon: CheckCircle2 },
  blocked: { label: 'Gönderim engelli', variant: 'destructive', Icon: ShieldBan },
  not_subscribed: { label: 'Aktif aboneliği yok', variant: 'warning', Icon: CircleAlert },
  not_listed: { label: 'Listelerde yok', variant: 'muted', Icon: CircleAlert },
};

const IDENTITY_LABELS = {
  registered_user: 'Kayıtlı kullanıcı',
  external_user: 'Harici kullanıcı kaydı',
  guest_user: 'Misafir kullanıcı',
  external_contact: 'Dışarıdan eklenen adres',
  suppression_only: 'Yalnız kara liste kaydı',
  history_only: 'Yalnız gönderim geçmişi',
  unknown: 'Kayıt bulunamadı',
};

const MAIL_STATUS_META = {
  sent: { label: 'Gönderildi', variant: 'success' },
  failed: { label: 'Başarısız', variant: 'destructive' },
  queued: { label: 'Kuyrukta', variant: 'warning' },
  skipped: { label: 'Atlandı', variant: 'secondary' },
};

const CAMPAIGN_STATUS_LABELS = {
  draft: 'Taslak',
  scheduled: 'Zamanlandı',
  queued: 'Kuyrukta',
  sending: 'Gönderiliyor',
  sent: 'Tamamlandı',
  partial: 'Kısmi',
  failed: 'Başarısız',
  paused: 'Duraklatıldı',
};

const REASON_LABELS = {
  ses_bounce: 'Kalıcı bounce',
  ses_complaint: 'Spam şikâyeti',
  user_unsubscribed: 'Kullanıcı çıkışı',
  user_unsubscribed_via_email: 'E-postadan çıkış',
  one_click: 'Tek tıkla çıkış',
  cms_removed: 'CMS ile çıkarıldı',
  wrong_recipient_risk: 'Yanlış alıcı riski',
  moved_to_language_channel: 'Dil listesine taşındı',
  mail_list_removed: 'Listeden çıkarıldı',
  manual: 'Elle eklendi',
};

function MailStatusBadge({ status }) {
  const meta = MAIL_STATUS_META[status] || { label: status || 'Bilinmiyor', variant: 'muted' };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function CampaignLink({ campaign, className = '' }) {
  if (!campaign) return <span className={className}>İşlemsel / doğrudan</span>;
  if (campaign.missing) return <span className={className}>{campaign.name}</span>;
  const suffix = ['draft', 'scheduled'].includes(campaign.status) ? '' : '/dashboard';
  return (
    <Link className={`hover:text-primary hover:underline ${className}`} href={`/cms/email/campaigns/${campaign.id}${suffix}`}>
      {campaign.name}
    </Link>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'primary' }) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
    destructive: 'bg-destructive/10 text-destructive',
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {detail && <div className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function MailDetailModal({ id, onClose }) {
  const { data, isFetching } = useGetSentMailQuery(id, { skip: !id });
  if (!id) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="flex max-h-[88vh] w-full max-w-3xl flex-col" onClick={(event) => event.stopPropagation()}>
        <CardHeader>
          <CardTitle>Mail Detayı</CardTitle>
          <CardToolbar>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto p-5">
          {isFetching ? (
            <Skeleton className="h-72 w-full" />
          ) : data ? (
            <>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">Gönderen: </span>{data.from}</div>
                <div><span className="text-muted-foreground">Alıcı: </span>{data.to}</div>
                <div className="sm:col-span-2"><span className="text-muted-foreground">Konu: </span>{data.subject}</div>
                <div><span className="text-muted-foreground">Tür: </span>{data.emailType || '—'}</div>
                <div className="flex items-center gap-2"><span className="text-muted-foreground">Durum: </span><MailStatusBadge status={data.status} /></div>
                <div><span className="text-muted-foreground">Tarih: </span>{formatDateTime(data.createdAt)}</div>
                <div><span className="text-muted-foreground">İlk açılma: </span>{formatDateTime(data.openedAt)}</div>
              </div>
              {data.error && <Alert variant="destructive"><AlertDescription>{data.error}</AlertDescription></Alert>}
              {data.status === 'queued' ? (
                <Alert><AlertDescription>Mail henüz kuyrukta; oluşturulmuş bir içerik bulunmuyor.</AlertDescription></Alert>
              ) : (
                <div className="rounded-lg border border-border">
                  <iframe title="Mail içeriği" srcDoc={data.text || ''} className="h-[460px] w-full rounded-lg bg-white" sandbox="" />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Mail detayı bulunamadı.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function EmailInspector({ authorized }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlEmail = searchParams.get('email') || '';
  const [draft, setDraft] = useState(urlEmail);
  const [submitted, setSubmitted] = useState(urlEmail.toLowerCase());
  const [localError, setLocalError] = useState('');
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    setDraft(urlEmail);
    setSubmitted(urlEmail.toLowerCase());
  }, [urlEmail]);

  const { data, isLoading, isFetching, error, refetch } = useGetCmsEmailInsightQuery(
    { email: submitted, limit: 100 },
    { skip: !authorized || !submitted },
  );

  const runSearch = (event) => {
    event?.preventDefault();
    const email = draft.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError('Geçerli bir e-posta adresi girin.');
      return;
    }
    setLocalError('');
    setSubmitted(email);
    setDetailId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('tab');
    params.set('email', email);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const clearSearch = () => {
    setDraft('');
    setSubmitted('');
    setLocalError('');
    setDetailId(null);
    router.replace(pathname, { scroll: false });
  };

  const listByKey = useMemo(
    () => new Map((data?.lists || []).map((list) => [list.key, list])),
    [data?.lists],
  );
  const history = data?.history;
  const summary = history?.summary || {};
  const deliveryMeta = DELIVERY_META[data?.deliverability?.state] || DELIVERY_META.not_listed;
  const DeliveryIcon = deliveryMeta.Icon;
  const user = data?.identity?.user;
  const subscriber = data?.subscriber;
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || subscriber?.profile?.name || '—';

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="p-5 sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Search className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold">E-posta inceleme merkezi</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Bir adresin kullanıcı kaydını, liste üyeliklerini, suppression durumunu, kampanyalarını ve gerçek gönderim geçmişini birlikte inceleyin.
              </p>
            </div>
          </div>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={runSearch}>
            <div className="relative flex-1">
              <Mail className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                autoComplete="off"
                value={draft}
                onChange={(event) => { setDraft(event.target.value); setLocalError(''); }}
                placeholder="ornek@firma.com"
                className="h-10 ps-9"
              />
            </div>
            <Button type="submit" disabled={isFetching || !draft.trim()}>
              {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              İncele
            </Button>
            {submitted && (
              <Button type="button" variant="outline" onClick={clearSearch}>
                <X className="size-4" /> Temizle
              </Button>
            )}
          </form>
          {localError && <p className="mt-2 text-xs text-destructive">{localError}</p>}
        </CardContent>
      </Card>

      {!submitted && (
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard icon={UserRound} label="Kimlik" value="Kullanıcı mı, harici adres mi?" detail="Abone kaydı olmasa da aranır" />
          <MetricCard icon={ListFilter} label="Kitle bağlantıları" value="Liste ve kampanyalar" detail="Aktif, çıkmış ve tarihsel ilişkiler" />
          <MetricCard icon={History} label="Gönderim kanıtı" value="Mail ve etkileşim geçmişi" detail="Başarı, hata, açılma ve tıklama" />
        </div>
      )}

      {submitted && (isLoading || (isFetching && !data)) && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24" />)}
          </div>
          <Skeleton className="h-52" />
          <Skeleton className="h-64" />
        </div>
      )}

      {submitted && error && (
        <Alert variant="destructive">
          <AlertTitle>İnceleme yapılamadı</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}</span>
            <Button size="sm" variant="outline" onClick={refetch}><RefreshCw className="size-4" /> Tekrar dene</Button>
          </AlertDescription>
        </Alert>
      )}

      {submitted && !isLoading && !error && data && !data.found && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <CircleAlert className="size-8 text-muted-foreground" />
            <p className="font-semibold">Bu adres için Tinten kaydı bulunamadı</p>
            <p className="max-w-xl text-sm text-muted-foreground">
              Kullanıcı, abone, kara liste ve gönderim geçmişi kaynaklarının hiçbirinde <span className="font-mono">{data.email}</span> yok.
            </p>
          </CardContent>
        </Card>
      )}

      {submitted && !error && data?.found && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={DeliveryIcon}
              label="Toplu mail durumu"
              value={deliveryMeta.label}
              detail={`${formatCount(data.deliverability?.activeMembershipCount)} aktif liste`}
              tone={data.deliverability?.state === 'blocked' ? 'destructive' : data.deliverability?.state === 'sendable' ? 'success' : 'warning'}
            />
            <MetricCard
              icon={UserRound}
              label="Adres türü"
              value={IDENTITY_LABELS[data.identity?.kind] || data.identity?.kind}
              detail={displayName !== '—' ? displayName : data.email}
            />
            <MetricCard
              icon={ListFilter}
              label="Liste ilişkisi"
              value={`${formatCount(data.lists?.length)} liste`}
              detail={`${formatCount(data.campaigns?.length)} kampanyada geçmiş`}
            />
            <MetricCard
              icon={Send}
              label="Gönderim geçmişi"
              value={`${formatCount(summary.sent)} gönderildi`}
              detail={`${formatCount(summary.total)} toplam kayıt · ${formatCount(summary.openedMessages)} açıldı`}
            />
          </div>

          <Alert variant={data.deliverability?.state === 'blocked' ? 'destructive' : 'info'}>
            <AlertTitle>{deliveryMeta.label}</AlertTitle>
            <AlertDescription>
              {data.deliverability?.message} <span className="opacity-75">{data.deliverability?.note}</span>
            </AlertDescription>
          </Alert>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Kimlik ve abone kaydı</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><div className="text-xs text-muted-foreground">E-posta</div><div className="mt-1 break-all font-mono text-xs">{data.email}</div></div>
                  <div><div className="text-xs text-muted-foreground">İsim</div><div className="mt-1 font-medium">{displayName}</div></div>
                  <div><div className="text-xs text-muted-foreground">Kimlik türü</div><div className="mt-1">{IDENTITY_LABELS[data.identity?.kind] || data.identity?.kind}</div></div>
                  <div><div className="text-xs text-muted-foreground">E-posta doğrulaması</div><div className="mt-1">{user ? (user.emailVerified ? 'Doğrulanmış' : 'Doğrulanmamış') : 'Kullanıcı hesabı yok'}</div></div>
                  <div><div className="text-xs text-muted-foreground">Abone üst durumu</div><div className="mt-1"><Badge variant={subscriber?.status === 'active' ? 'success' : subscriber ? 'destructive' : 'muted'}>{subscriber?.status || 'Abone kaydı yok'}</Badge></div></div>
                  <div><div className="text-xs text-muted-foreground">Kaynak / dil</div><div className="mt-1">{subscriber?.source || '—'} · {subscriber?.locale || user?.locale || '—'}</div></div>
                  <div><div className="text-xs text-muted-foreground">İlk kayıt</div><div className="mt-1">{formatDateTime(subscriber?.createdAt || user?.createdAt)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Son aktivite</div><div className="mt-1">{formatDateTime(subscriber?.lastActivityAt || summary.lastActivityAt)}</div></div>
                </div>
                {subscriber?.tags?.length > 0 && (
                  <div><div className="mb-2 text-xs text-muted-foreground">Etiketler</div><div className="flex flex-wrap gap-1">{subscriber.tags.map((tag) => <Badge key={tag} variant="muted">{tag}</Badge>)}</div></div>
                )}
                {subscriber?.acquisition?.campaign && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">İlk kazanım kampanyası</div>
                    <CampaignLink campaign={subscriber.acquisition.campaign} className="mt-1 block font-medium" />
                    <div className="mt-1 text-xs text-muted-foreground">Atıf: {formatDateTime(subscriber.acquisition.attributedAt)}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Suppression / gönderim engeli</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                {data.suppression ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={data.suppression.active ? 'destructive' : 'success'}>{data.suppression.active ? 'Aktif engel' : 'Serbest bırakılmış'}</Badge>
                      {data.suppression.storage === 'mail_suppressions' && <Badge variant="warning">Eski kayıt</Badge>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><div className="text-xs text-muted-foreground">Sebep</div><div className="mt-1 font-medium">{REASON_LABELS[data.suppression.reason] || data.suppression.reason || 'Bilinmiyor'}</div></div>
                      <div><div className="text-xs text-muted-foreground">Kaynak</div><div className="mt-1">{data.suppression.source || '—'}</div></div>
                      <div><div className="text-xs text-muted-foreground">Engellenme tarihi</div><div className="mt-1">{formatDateTime(data.suppression.suppressedAt)}</div></div>
                      <div><div className="text-xs text-muted-foreground">Serbest bırakılma</div><div className="mt-1">{formatDateTime(data.suppression.releasedAt)}</div></div>
                    </div>
                    {data.suppression.campaign && (
                      <div><div className="text-xs text-muted-foreground">İlişkili kampanya</div><CampaignLink campaign={data.suppression.campaign} className="mt-1 block font-medium" /></div>
                    )}
                    <Link className={buttonVariants({ size: 'sm', variant: 'outline' })} href="/cms/email/lists?tab=blacklist"><ShieldBan className="size-4" /> Kara Listeyi Aç</Link>
                  </>
                ) : (
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                    <div><div className="font-medium">Global suppression kaydı yok</div><p className="mt-1 text-xs text-muted-foreground">Adres kara liste koleksiyonunda engelli görünmüyor. Abone üst durumu ayrıca değerlendirilmiştir.</p></div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-center">
                  <div><div className="font-semibold">{formatCount(summary.failed)}</div><div className="text-[11px] text-muted-foreground">Başarısız</div></div>
                  <div><div className="font-semibold">{formatCount(summary.skipped)}</div><div className="text-[11px] text-muted-foreground">Atlandı</div></div>
                  <div><div className="font-semibold">{formatCount(summary.humanClickedMessages)}</div><div className="text-[11px] text-muted-foreground">İnsan tıklaması</div></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Liste ilişkileri</CardTitle>
              <CardToolbar><Badge variant="muted">{formatCount(data.lists?.length)} kayıt</Badge></CardToolbar>
            </CardHeader>
            <CardContent className="p-0">
              {!data.lists?.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Adres hiçbir mevcut veya tarihsel listeyle ilişkilendirilemedi.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Liste</TableHead><TableHead>Üyelik</TableHead><TableHead>Liste durumu</TableHead><TableHead>Geçmiş kullanım</TableHead><TableHead>Tarih / sebep</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.lists.map((list) => (
                        <TableRow key={list.key}>
                          <TableCell><div className="font-medium">{list.title}</div><div className="font-mono text-[11px] text-muted-foreground">{list.key}</div></TableCell>
                          <TableCell>
                            <Badge variant={list.membershipStatus === 'subscribed' ? 'success' : list.membershipStatus === 'unsubscribed' ? 'warning' : 'muted'}>
                              {list.membershipStatus === 'subscribed' ? 'Abone' : list.membershipStatus === 'unsubscribed' ? 'Çıkmış' : 'Yalnız geçmişte'}
                            </Badge>
                          </TableCell>
                          <TableCell><Badge variant={list.missing ? 'destructive' : list.listStatus === 'active' ? 'outline' : 'muted'}>{list.missing ? 'Liste silinmiş' : list.listStatus === 'active' ? 'Aktif' : 'Arşiv'}</Badge></TableCell>
                          <TableCell className="text-xs">{formatCount(list.campaignCount)} kampanya · {formatCount(list.deliveryCount)} mail</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div>{formatDateTime(list.unsubscribedAt || list.subscribedAt)}</div>
                            {(list.reason || list.capturedAtSuppression) && <div className="mt-1">{REASON_LABELS[list.reason] || list.reason || 'Engel anında üyeydi'}</div>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kampanya geçmişi</CardTitle>
              <CardToolbar><Badge variant="muted">{formatCount(data.campaigns?.length)} kampanya</Badge></CardToolbar>
            </CardHeader>
            <CardContent className="p-0">
              {!data.campaigns?.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Bu adrese bağlı kampanya gönderimi bulunamadı.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Kampanya</TableHead><TableHead>Liste</TableHead><TableHead>Sonuç</TableHead><TableHead>Etkileşim</TableHead><TableHead>Son işlem</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.campaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell><CampaignLink campaign={campaign} className="font-medium" /><div className="mt-1 max-w-sm truncate text-xs text-muted-foreground">{campaign.subject || 'Konu yok'}</div></TableCell>
                          <TableCell><div>{listByKey.get(campaign.channelKey)?.title || campaign.channelKey || '—'}</div><div className="font-mono text-[11px] text-muted-foreground">{campaign.channelKey || ''}</div></TableCell>
                          <TableCell><Badge variant={campaign.failedCount > 0 ? 'warning' : campaign.sentCount > 0 ? 'success' : 'muted'}>{formatCount(campaign.sentCount)} gönderildi</Badge><div className="mt-1 text-[11px] text-muted-foreground">{CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status || 'Silinmiş'} · {formatCount(campaign.deliveryCount)} kayıt</div></TableCell>
                          <TableCell className="text-xs"><div className="flex items-center gap-1"><Eye className="size-3.5" /> {formatCount(campaign.openedCount)} açılma</div><div className="mt-1 flex items-center gap-1"><MousePointerClick className="size-3.5" /> {formatCount(campaign.humanClickedCount)} insan tıklaması</div></TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(campaign.lastDeliveryAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mail geçmişi</CardTitle>
              <CardToolbar className="gap-2">
                <Badge variant="muted">{formatCount(summary.total)} kayıt</Badge>
                {history?.truncated && <Badge variant="warning">Son {formatCount(history.limit)} gösteriliyor</Badge>}
              </CardToolbar>
            </CardHeader>
            <CardContent className="p-0">
              {!history?.items?.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Bu adrese ait gönderim kaydı yok.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Konu</TableHead><TableHead>Kampanya / liste</TableHead><TableHead>Durum</TableHead><TableHead>Etkileşim</TableHead><TableHead>Tarih</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {history.items.map((mail) => (
                        <TableRow key={mail.id}>
                          <TableCell>
                            <button className="max-w-sm truncate text-left text-sm font-medium hover:text-primary hover:underline" onClick={() => setDetailId(mail.id)}>{mail.subject}</button>
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground">{mail.emailType || '—'} · {mail.from}</div>
                          </TableCell>
                          <TableCell className="max-w-xs text-xs"><CampaignLink campaign={mail.campaign} className="block truncate" /><div className="mt-1 truncate text-muted-foreground">{listByKey.get(mail.channelKey)?.title || mail.channelKey || 'Liste dışı gönderim'}</div></TableCell>
                          <TableCell><MailStatusBadge status={mail.status} />{mail.bounceRecordedAt && <Badge className="ms-1" variant="destructive">Bounce</Badge>}{mail.error && <div className="mt-1 max-w-48 truncate text-[11px] text-destructive">{mail.error}</div>}</TableCell>
                          <TableCell className="text-xs"><div className="flex items-center gap-1"><Eye className="size-3.5" /> {mail.openCount ? `${formatCount(mail.openCount)}× açıldı` : 'Açılmadı'}</div><div className="mt-1 flex items-center gap-1"><MousePointerClick className="size-3.5" /> {mail.humanClickCount ? `${formatCount(mail.humanClickCount)} insan` : `${formatCount(mail.confirmedClickCount)} doğrulanmış`}</div></TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatDateTime(mail.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <MailDetailModal id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
