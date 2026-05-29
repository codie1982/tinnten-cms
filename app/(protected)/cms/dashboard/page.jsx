'use client';

import Link from 'next/link';
import {
  Users,
  Bot,
  FileText,
  Mail,
  ArrowUpRight,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardToolbar,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { CMS_ROLES } from '@/lib/roles';

/* ─── static data ─── */

const kpis = [
  {
    label: 'Toplam Kullanıcı',
    value: '12.480',
    delta: '+4.2%',
    icon: Users,
    tint: 'bg-blue-500/10 text-blue-600',
    progress: 72,
  },
  {
    label: 'Aktif Asistan',
    value: '328',
    delta: '+12',
    icon: Bot,
    tint: 'bg-violet-500/10 text-violet-600',
    progress: 58,
  },
  {
    label: 'Yayında İçerik',
    value: '1.204',
    delta: '+38',
    icon: FileText,
    tint: 'bg-amber-500/10 text-amber-600',
    progress: 45,
  },
  {
    label: 'Gönderilen Email',
    value: '86.300',
    delta: '+9.1%',
    icon: Mail,
    tint: 'bg-emerald-500/10 text-emerald-600',
    progress: 88,
  },
];

const quickActions = [
  {
    title: 'Yeni Asistan Oluştur',
    desc: 'AI asistan konfigüre et ve yayına al',
    icon: Bot,
    href: '/cms/assistants',
    tint: 'bg-violet-500/10 text-violet-600',
  },
  {
    title: 'İçerik Yayınla',
    desc: 'Yeni içerik, SSS veya akademi makalesi ekle',
    icon: FileText,
    href: '/cms/content',
    tint: 'bg-amber-500/10 text-amber-600',
  },
  {
    title: 'İş Akışı Oluştur',
    desc: 'Otomasyon senaryosu ve workflow tanımla',
    icon: Workflow,
    href: '/cms/workflows',
    tint: 'bg-blue-500/10 text-blue-600',
  },
];

const activity = [
  { who: 'Ayşe Demir', what: 'yeni içerik yayınladı', when: '5 dk önce' },
  { who: 'Mehmet Kaya', what: 'asistan ayarını güncelledi', when: '22 dk önce' },
  { who: 'Sistem', what: 'haftalık email kampanyası gönderdi', when: '1 saat önce' },
  { who: 'Zeynep Ak', what: 'profesyonel hesap onayladı', when: '3 saat önce' },
  { who: 'Kaan Arslan', what: 'yeni firma kaydı tamamlandı', when: '5 saat önce' },
];

const services = [
  { name: 'Fetcher Servisi', status: 'ok', uptime: '99.9%', href: '/cms/services/fetcher' },
  { name: 'Embedding Servisi', status: 'ok', uptime: '99.7%', href: '/cms/services/embedding' },
  { name: 'Cron Servisi', status: 'ok', uptime: '100%', href: '/cms/services/cron' },
  { name: 'Scraper', status: 'warning', uptime: '94.2%', href: '/cms/services/scraper' },
];

/* ─── page ─── */

export default function DashboardPage() {
  const { data: session } = useSession();
  const rawName = session?.user?.name || session?.user?.email || '';
  const firstName = rawName.split(' ')[0].split('@')[0] || 'Kullanıcı';
  const activeServices = services.filter((s) => s.status === 'ok').length;

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
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
              t
            </span>
            <div>
              <p className="font-semibold text-foreground">Merhaba, {firstName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Platform aktif · {activeServices}/{services.length} servis çalışıyor
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Badge variant="success" dot>Platform Aktif</Badge>
            <Badge variant="muted">v1.0</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI cards ── */}
      <div className="mb-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <span className={cn('flex size-11 items-center justify-center rounded-xl', k.tint)}>
                    <Icon className="size-5" />
                  </span>
                  <Badge variant="success">
                    <ArrowUpRight className="size-3" />
                    {k.delta}
                  </Badge>
                </div>
                <p className="mt-4 text-2xl font-bold tracking-tight text-foreground">
                  {k.value}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{k.label}</p>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/50"
                    style={{ width: `${k.progress}%` }}
                  />
                </div>
              </CardContent>
            </Card>
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
        {/* Activity feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Son Aktiviteler</CardTitle>
            <CardToolbar>
              <Badge variant="muted" dot>Canlı</Badge>
            </CardToolbar>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-0.5">
              {activity.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50"
                >
                  <Avatar name={a.who} size="sm" />
                  <p className="flex-1 text-sm">
                    <span className="font-medium text-foreground">{a.who}</span>{' '}
                    <span className="text-muted-foreground">{a.what}</span>
                  </p>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {a.when}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="justify-center border-t border-dashed border-border/60 py-3">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              Tüm aktiviteleri görüntüle
            </Button>
          </CardFooter>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Week stats */}
          <Card>
            <CardHeader>
              <CardTitle>Bu Hafta</CardTitle>
              <CardToolbar>
                <TrendingUp className="size-4 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-600">+18.4%</span>
              </CardToolbar>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Yeni kayıtlar', value: 72 },
                { label: 'Aktif oturumlar', value: 54 },
                { label: 'Dönüşüm', value: 38 },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold text-foreground">%{row.value}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${row.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Service status */}
          <Card>
            <CardHeader>
              <CardTitle>Servis Durumu</CardTitle>
              <CardToolbar>
                <Badge variant={activeServices === services.length ? 'success' : 'warning'}>
                  {activeServices}/{services.length} Aktif
                </Badge>
              </CardToolbar>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-0.5">
                {services.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        s.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500',
                      )}
                    />
                    <span className="flex-1 text-sm text-foreground">{s.name}</span>
                    <span
                      className={cn(
                        'text-xs font-medium tabular-nums',
                        s.status === 'ok' ? 'text-emerald-600' : 'text-amber-600',
                      )}
                    >
                      {s.uptime}
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
