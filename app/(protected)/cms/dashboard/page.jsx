'use client';

import Link from 'next/link';
import {
  Users, Bot, FileText, Building2, Workflow, CreditCard,
  Store, Wrench, Loader2,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import {
  Card, CardContent, CardHeader, CardTitle, CardToolbar, CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CMS_ROLES } from '@/lib/roles';
import { useGetDashboardStatsQuery } from '@/redux/services';

/* ─── yardımcılar ─── */
function fmtNumber(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('tr-TR').format(n);
}
function timeAgo(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} gün önce`;
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ─── statik hızlı aksiyonlar ─── */
const quickActions = [
  { title: 'Yeni Asistan Oluştur', desc: 'AI asistan konfigüre et ve yayına al', icon: Bot, href: '/cms/assistants', tint: 'bg-violet-500/10 text-violet-600' },
  { title: 'İçerik Yayınla', desc: 'Yeni içerik, SSS veya akademi makalesi ekle', icon: FileText, href: '/cms/content', tint: 'bg-amber-500/10 text-amber-600' },
  { title: 'İş Akışı Oluştur', desc: 'Otomasyon senaryosu ve workflow tanımla', icon: Workflow, href: '/cms/workflows', tint: 'bg-blue-500/10 text-blue-600' },
];

const COMPANY_STATUS_META = [
  { key: 'approved', label: 'Onaylı', bar: 'bg-emerald-500', text: 'text-emerald-600' },
  { key: 'pending', label: 'Beklemede', bar: 'bg-amber-500', text: 'text-amber-600' },
  { key: 'suspended', label: 'Askıda', bar: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
  { key: 'blocked', label: 'Engelli', bar: 'bg-destructive', text: 'text-destructive' },
];

/* ─── page ─── */
export default function DashboardPage() {
  const { data: session } = useSession();
  const rawName = session?.user?.name || session?.user?.email || '';
  const firstName = rawName.split(' ')[0].split('@')[0] || 'Kullanıcı';

  const { data: stats, isLoading, isFetching, error } = useGetDashboardStatsQuery();

  const kpis = [
    { label: 'Toplam Kullanıcı', value: stats?.users?.total, icon: Users, tint: 'bg-blue-500/10 text-blue-600', href: '/cms/users/list' },
    { label: 'Toplam Firma', value: stats?.companies?.total, icon: Building2, tint: 'bg-indigo-500/10 text-indigo-600', href: '/cms/companies/list' },
    { label: 'Aktif Asistan', value: stats?.assistants?.published, icon: Bot, tint: 'bg-violet-500/10 text-violet-600', href: '/cms/assistants' },
    { label: 'Yayında İçerik', value: stats?.content?.published, icon: FileText, tint: 'bg-amber-500/10 text-amber-600', href: '/cms/content' },
  ];

  const companies = stats?.companies;
  const recent = stats?.recentCompanies ?? [];

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ACCESS]}>
      <PageHeader
        section="CMS"
        title="Dashboard"
        description="Platform genel görünümü ve canlı metrikler"
      />

      {/* ── Welcome ── */}
      <Card className="mb-5">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">t</span>
            <div>
              <p className="font-semibold text-foreground">Merhaba, {firstName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {companies != null
                  ? `${fmtNumber(companies.total)} firma · ${fmtNumber(stats?.subscriptions?.active)} aktif abonelik`
                  : 'Platform genel görünümü'}
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <Badge variant="success" dot>Platform Aktif</Badge>
            <Badge variant="muted">v1.0</Badge>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>İstatistikler yüklenemedi</AlertTitle>
          <AlertDescription>{error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}</AlertDescription>
        </Alert>
      ) : null}

      {/* ── KPI cards ── */}
      <div className="mb-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href} className="group block">
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                <CardContent className="p-5">
                  <span className={cn('flex size-11 items-center justify-center rounded-xl', k.tint)}>
                    <Icon className="size-5" />
                  </span>
                  {isLoading ? (
                    <Skeleton className="mt-4 h-8 w-24" />
                  ) : (
                    <p className="mt-4 text-2xl font-bold tracking-tight text-foreground">{fmtNumber(k.value)}</p>
                  )}
                  <p className="mt-0.5 text-sm text-muted-foreground">{k.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ── Quick actions ── */}
      <div className="mb-5 grid gap-5 sm:grid-cols-3">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.href} href={a.href} className="group block">
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                <CardContent className="p-5">
                  <span className={cn('mb-3 inline-flex size-10 items-center justify-center rounded-xl', a.tint)}>
                    <Icon className="size-5" />
                  </span>
                  <p className="font-semibold text-foreground">{a.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ── Bottom grid ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Son kayıtlı firmalar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Son Kayıtlı Firmalar</CardTitle>
            <CardToolbar>
              <Link href="/cms/companies/list">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">Tümü</Button>
              </Link>
            </CardToolbar>
          </CardHeader>
          <CardContent className="p-2">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : recent.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">Henüz firma kaydı yok.</p>
            ) : (
              <div className="space-y-0.5">
                {recent.map((c) => (
                  <Link key={c.id} href={`/cms/companies/${c.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                      {c.businessMode && (
                        <span className="text-xs text-muted-foreground">{c.businessMode === 'service' ? 'Hizmet' : 'E-ticaret'}</span>
                      )}
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Firma durumları */}
          <Card>
            <CardHeader>
              <CardTitle>Firma Durumları</CardTitle>
              <CardToolbar>
                <Badge variant="muted">{fmtNumber(companies?.total)} toplam</Badge>
              </CardToolbar>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)
              ) : (
                COMPANY_STATUS_META.map((s) => {
                  const count = companies?.[s.key] ?? 0;
                  const total = companies?.total || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={s.key}>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className={cn('font-semibold', s.text)}>{fmtNumber(count)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className={cn('h-full rounded-full', s.bar)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* İş modu dağılımı */}
          <Card>
            <CardHeader>
              <CardTitle>İş Modu Dağılımı</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 p-4">
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wrench className="size-4" /><span className="text-xs">Hizmet</span>
                </div>
                <p className="mt-1 text-xl font-bold text-foreground">{isLoading ? '…' : fmtNumber(companies?.service)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Store className="size-4" /><span className="text-xs">E-ticaret</span>
                </div>
                <p className="mt-1 text-xl font-bold text-foreground">{isLoading ? '…' : fmtNumber(companies?.ecommerce)}</p>
              </div>
            </CardContent>
            <CardFooter className="justify-between border-t border-dashed border-border/60 py-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><CreditCard className="size-3.5" />Aktif abonelik</span>
              <span className="font-semibold text-foreground">{isLoading ? '…' : fmtNumber(stats?.subscriptions?.active)}</span>
            </CardFooter>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
