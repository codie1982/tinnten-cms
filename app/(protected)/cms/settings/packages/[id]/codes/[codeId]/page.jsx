'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Building2, CalendarClock, Check, Clipboard, Gauge, MousePointerClick, Users } from 'lucide-react';

import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetPackageCodeAttributionsQuery,
  useGetPackageCodeDashboardQuery,
  useGetPackageCodeRedemptionsQuery,
} from '@/redux/services';

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

const packageTitle = (pkg) => {
  const i18n = pkg?.i18n || {};
  return i18n.tr?.title || i18n.en?.title || Object.values(i18n)[0]?.title || pkg?.name || 'Paket';
};

const publisherLabel = (publisher) => {
  if (!publisher || publisher.type === 'none') return 'Sahipsiz';
  return publisher.name || publisher.email || '—';
};

const availabilityMeta = {
  available: { label: 'Kullanılabilir', variant: 'success' },
  inactive: { label: 'Pasif', variant: 'muted' },
  not_started: { label: 'Henüz başlamadı', variant: 'warning' },
  expired: { label: 'Son kullanım tarihi geçti', variant: 'muted' },
  exhausted: { label: 'Kota doldu', variant: 'warning' },
  package_unavailable: { label: 'Paket kullanılamıyor', variant: 'warning' },
};

const attributionStatus = {
  pending: 'Onboarding bekliyor',
  redeemed: 'Kullanıldı',
  superseded: 'Başka kodla değiştirildi',
  invalidated: 'Geçersizleşti',
};

const sourceLabel = {
  ref_link: 'Referans linki',
  manual: 'Manuel kod girişi',
  legacy: 'Eski akış',
};

function MetricCard({ icon: Icon, label, value, description }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-semibold text-foreground">{value}</p>
          {description ? <p className="mt-1 text-[11px] text-muted-foreground">{description}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PackageCodeDashboardPage({ params }) {
  const { id: packageId, codeId } = use(params);
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const [copied, setCopied] = useState(false);

  const { data: dashboard, isLoading, error } = useGetPackageCodeDashboardQuery(codeId, { skip: !authorized });
  const { data: redemptions = [], isLoading: redemptionsLoading } = useGetPackageCodeRedemptionsQuery(codeId, { skip: !authorized });
  const { data: attributions = [], isLoading: attributionsLoading } = useGetPackageCodeAttributionsQuery({ id: codeId }, { skip: !authorized });

  const code = dashboard?.code;
  const summary = dashboard?.summary || {};
  const actualPackageId = String(code?.packageId?._id || code?.packageId || '');
  const packageMismatch = Boolean(code && actualPackageId !== String(packageId));
  const reason = dashboard?.availability?.reason || 'available';
  const state = availabilityMeta[reason] || availabilityMeta.available;
  const remaining = code?.maxRedemptions == null
    ? 'Sınırsız'
    : Math.max(Number(code.maxRedemptions) - Number(code.redeemedCount || 0), 0);

  const copyLink = async () => {
    const base = String(process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://tinten.ai').replace(/\/+$/, '');
    await navigator.clipboard.writeText(`${base}/onboarding?ref=${encodeURIComponent(code.code)}&openWizard=1`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (isLoading) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
        <PageHeader title="Kod Dashboard" breadcrumb={[{ label: 'Paketler', href: '/cms/settings/packages' }, { label: 'Yükleniyor…' }]} />
        <Skeleton className="h-96 w-full" />
      </RoleGuard>
    );
  }

  if (error || !code || packageMismatch) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
        <PageHeader title="Kod bulunamadı" breadcrumb={[{ label: 'Paketler', href: '/cms/settings/packages' }, { label: 'Kod Dashboard' }]} />
        <Alert variant="destructive">
          <AlertTitle>Kod dashboard’u açılamadı</AlertTitle>
          <AlertDescription>{packageMismatch ? 'Bu kod URL’deki pakete ait değil.' : (error?.data?.message || 'Kod bulunamadı veya yüklenemedi.')}</AlertDescription>
        </Alert>
      </RoleGuard>
    );
  }

  const pkgName = packageTitle(code.packageId);

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        breadcrumb={[
          { label: 'Paketler', href: '/cms/settings/packages' },
          { label: pkgName, href: `/cms/settings/packages/${packageId}` },
          { label: 'Paket Kodları', href: `/cms/settings/packages/${packageId}?tab=codes` },
          { label: code.code },
        ]}
        title="Kod Dashboard"
        description="Kodun yayıncısını, kayıt kaynağını, kullanım zamanlarını ve verilen erişimleri izleyin."
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void copyLink()}>
              {copied ? <Check className="size-4 text-emerald-600" /> : <Clipboard className="size-4" />}
              {copied ? 'Kopyalandı' : 'Kayıt linkini kopyala'}
            </Button>
            <Link href={`/cms/settings/packages/${packageId}?tab=codes`} className={buttonVariants({ variant: 'outline' })}>
              <ArrowLeft className="size-4" /> Kodlara Dön
            </Link>
          </div>
        )}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Toplam kullanım" value={summary.redemptionCount || 0} description={`İlk: ${formatDate(summary.firstUsedAt)}`} />
        <MetricCard icon={Gauge} label="Aktif erişim" value={summary.activeAccessCount || 0} description={`${summary.expiredAccessCount || 0} erişimin süresi doldu`} />
        <MetricCard icon={MousePointerClick} label="Kayıt izi" value={summary.attributionCount || 0} description={`${summary.pendingAttributionCount || 0} onboarding bekliyor`} />
        <MetricCard icon={CalendarClock} label="Dönüşüm" value={`%${summary.conversionRate || 0}`} description={`Son kullanım: ${formatDate(summary.lastUsedAt)}`} />
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="font-mono">{code.code}</CardTitle>
          <CardToolbar><Badge variant={state.variant}>{state.label}</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Paket</p><p className="mt-1 font-medium">{pkgName}</p><p className="text-xs text-muted-foreground">{code.pricingInterval === 'year' ? 'Yıllık' : 'Aylık'} paket dönemi</p></div>
          <div><p className="text-xs text-muted-foreground">Yayıncı / sahip</p><p className="mt-1 font-medium">{publisherLabel(code.publisher)}</p><p className="text-xs text-muted-foreground">{[code.publisher?.email, code.publisher?.partnerCompanyId?.companyName].filter(Boolean).join(' · ') || 'E-posta veya firma bilgisi yok'}</p></div>
          <div><p className="text-xs text-muted-foreground">Dağıtım kotası</p><p className="mt-1 font-medium">{code.redeemedCount || 0} kullanıldı · {remaining} kaldı</p><p className="text-xs text-muted-foreground">Aynı kullanıcı bu kodu yalnız bir kez kullanabilir.</p></div>
          <div><p className="text-xs text-muted-foreground">Kullanım sonrası erişim</p><p className="mt-1 font-medium">{code.grantDuration?.count || 1} ay</p><p className="text-xs text-muted-foreground">Her kullanıcı için kodu kullandığı anda başlar.</p></div>
          <div className="md:col-span-2"><p className="text-xs text-muted-foreground">Kodun kullanılabileceği tarih aralığı</p><p className="mt-1 font-medium">{code.startsAt ? formatDate(code.startsAt) : 'Hemen'} — {code.expiresAt ? formatDate(code.expiresAt) : 'Son kullanım tarihi yok'}</p><p className="text-xs text-muted-foreground">Bu aralık yalnız yeni kod kullanımını sınırlar; verilmiş erişimleri kısaltmaz.</p></div>
          <div><p className="text-xs text-muted-foreground">Oluşturulma</p><p className="mt-1 font-medium">{formatDate(code.createdAt)}</p><p className="text-xs text-muted-foreground">{code.label || 'İç etiket yok'}</p></div>
          <div><p className="text-xs text-muted-foreground">Teknik kimlik</p><p className="mt-1 break-all font-mono text-xs">{code._id}</p></div>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader><CardTitle>Kodu Kullananlar</CardTitle><CardToolbar><Badge variant="muted">{redemptions.length} kullanım</Badge></CardToolbar></CardHeader>
        <CardContent className="px-0 py-0">
          {redemptionsLoading ? (
            <div className="space-y-2 p-4"><Skeleton className="h-9" /><Skeleton className="h-9" /></div>
          ) : !redemptions.length ? (
            <p className="p-5 text-sm text-muted-foreground">Kod henüz kullanılmadı.</p>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Kullanıcı</TableHead><TableHead>Firma</TableHead><TableHead>Kullanım zamanı</TableHead><TableHead>Erişim bitişi</TableHead><TableHead>Domainler</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
              <TableBody>{redemptions.map((item) => {
                const userName = [item.userId?.firstName, item.userId?.lastName].filter(Boolean).join(' ');
                return <TableRow key={item._id}>
                  <TableCell><p className="font-medium">{userName || item.userId?.email || item.userEmailSnapshot || '—'}</p><p className="text-xs text-muted-foreground">{item.userId?.email || item.userEmailSnapshot || '—'}</p></TableCell>
                  <TableCell>{item.companyId?._id ? <Link href={`/cms/companies/${item.companyId._id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><Building2 className="size-3.5" /> {item.companyId.companyName || item.companyId._id}</Link> : (item.companyId?.companyName || item.companyId || '—')}</TableCell>
                  <TableCell>{formatDate(item.redeemedAt)}</TableCell>
                  <TableCell>{formatDate(item.accessEndsAt)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground"><p>E-posta: {item.userEmailDomain || '—'}</p><p>Firma: {item.companyWebsiteDomain || '—'}</p></TableCell>
                  <TableCell><Badge variant={item.effectiveStatus === 'active' ? 'success' : 'muted'}>{item.effectiveStatus === 'active' ? 'Erişim aktif' : 'Erişim sona erdi'}</Badge></TableCell>
                </TableRow>;
              })}</TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Kayıt ve Referans İzleri</CardTitle><CardToolbar><Badge variant="muted">{attributions.length} kayıt</Badge></CardToolbar></CardHeader>
        <CardContent className="px-0 py-0">
          {attributionsLoading ? (
            <div className="space-y-2 p-4"><Skeleton className="h-9" /><Skeleton className="h-9" /></div>
          ) : !attributions.length ? (
            <p className="p-5 text-sm text-muted-foreground">Bu kod için kayıt veya yönlendirme izi yok.</p>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Kullanıcı</TableHead><TableHead>Kaynak</TableHead><TableHead>Domain / UTM</TableHead><TableHead>Kodu alma</TableHead><TableHead>Onboarding</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
              <TableBody>{attributions.map((item) => {
                const userName = [item.userId?.firstName, item.userId?.lastName].filter(Boolean).join(' ');
                return <TableRow key={item._id}>
                  <TableCell><p className="font-medium">{userName || item.userId?.emailNormalized || item.userId?.email || '—'}</p><p className="text-xs text-muted-foreground">{item.userId?.emailNormalized || item.userId?.email || '—'}</p></TableCell>
                  <TableCell>{sourceLabel[item.source] || item.source || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground"><p>{item.acquisition?.referrerDomain || 'Doğrudan / bilinmiyor'}</p><p>{[item.acquisition?.utmSource, item.acquisition?.utmMedium, item.acquisition?.utmCampaign].filter(Boolean).join(' / ') || 'UTM yok'}</p></TableCell>
                  <TableCell>{formatDate(item.claimedAt || item.createdAt)}</TableCell>
                  <TableCell>{formatDate(item.onboardingStartedAt)}</TableCell>
                  <TableCell><Badge variant={item.status === 'redeemed' ? 'success' : item.status === 'pending' ? 'warning' : 'muted'}>{attributionStatus[item.status] || item.status}</Badge>{item.invalidReason ? <p className="mt-1 text-[11px] text-muted-foreground">{item.invalidReason}</p> : null}</TableCell>
                </TableRow>;
              })}</TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
