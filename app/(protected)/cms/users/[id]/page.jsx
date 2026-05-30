'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ShieldOff,
  ShieldCheck,
  MonitorSmartphone,
  Mail,
  Library,
  Users,
  Building2,
  ExternalLink,
  KeyRound,
  MapPin,
  Phone,
  Share2,
  CalendarDays,
  Globe,
  Clock3,
  User,
  Contact,
  Wallet,
  Package,
  Activity,
  MessagesSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/page-shell';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetUserQuery,
  useGetUserSessionsQuery,
  useGetUserAccountQuery,
  useGetUserConversationsQuery,
  useUpdateUserMutation,
  useResetUserPasswordMutation,
} from '@/redux/services';
import { roleMeta, statusMeta } from '../_data';

/* ─── sol alt-menü ─── */
const SECTIONS = [
  { key: 'genel', label: 'Genel', icon: User },
  { key: 'profil', label: 'Profil Bilgileri', icon: Contact },
  { key: 'firmalar', label: 'Firmalar', icon: Building2 },
  { key: 'konusmalar', label: 'Konuşmalar', icon: MessagesSquare },
  { key: 'oturumlar', label: 'Oturumlar', icon: MonitorSmartphone },
  { key: 'kutuphaneler', label: 'Kütüphaneler', icon: Library },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'hesap', label: 'Hesap', icon: Wallet },
  { key: 'paketler', label: 'Paketler', icon: Package },
  { key: 'kullanim', label: 'Kullanım', icon: Activity },
];
const ACCOUNT_SECTIONS = ['hesap', 'paketler', 'kullanim'];

/* ─── tr tarih / etiket yardımcıları ─── */
function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTrDateTime(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} · ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}
const GENDER_LABELS = {
  male: 'Erkek',
  female: 'Kadın',
  other: 'Diğer',
  prefer_not_to_say: 'Belirtilmedi',
};
function genderLabel(g) {
  return GENDER_LABELS[g] || '—';
}

/* ─── page ─── */
export default function CmsUserDetailPage({ params }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const [section, setSection] = useState('genel');
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Genel/Profil/Firmalar tek temel çağrıdan beslenir.
  const { data: user, isLoading, error } = useGetUserQuery(id, { skip: !authorized });
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [resetPassword, { isLoading: isResetting }] = useResetUserPasswordMutation();

  /* ─── loading ─── */
  if (isLoading) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
        <PageHeader
          breadcrumb={[{ label: 'Kullanıcılar', href: '/cms/users/list' }, { label: '…' }]}
          title="Yükleniyor…"
        />
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </RoleGuard>
    );
  }

  /* ─── not found / error ─── */
  if (error || !user) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
        <PageHeader
          breadcrumb={[
            { label: 'Kullanıcılar', href: '/cms/users/list' },
            { label: 'Kullanıcı Bulunamadı' },
          ]}
          title="Kullanıcı Bulunamadı"
        />
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {error
              ? error?.data?.message ||
                error?.normalizedMessage ||
                'Kullanıcı yüklenirken bir hata oluştu.'
              : 'Bu ID ile eşleşen kullanıcı bulunamadı.'}{' '}
            <Link href="/cms/users/list" className="text-primary hover:underline">
              Listeye dön
            </Link>
          </CardContent>
        </Card>
      </RoleGuard>
    );
  }

  const isBlocked = user.blocked === true;
  const cmsRoles = (user.roles ?? []).filter((r) => r.startsWith('cms:'));

  const handleBlock = async (blocked) => {
    try {
      await updateUser({ id, enabled: !blocked }).unwrap();
      setConfirmBlock(false);
    } catch {
      /* hata mutation cache'inde */
    }
  };
  const handleResetPassword = async () => {
    try {
      await resetPassword(id).unwrap();
      setConfirmReset(false);
      setResetDone(true);
    } catch {
      /* onay kutusu açık kalır */
    }
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        breadcrumb={[
          { label: 'Kullanıcılar', href: '/cms/users/list' },
          { label: user.name },
        ]}
        title={user.name}
      />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        {/* Sol alt-menü */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Avatar name={user.name} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                <Badge variant={statusMeta[user.status]?.variant ?? 'muted'}>
                  {statusMeta[user.status]?.label ?? user.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="mt-3">
            <nav className="space-y-0.5 p-2">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = section === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSection(s.key)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {s.label}
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        {/* Sağ içerik */}
        <div className="space-y-5">
          {section === 'genel' && (
            <GeneralSection
              user={user}
              cmsRoles={cmsRoles}
              isBlocked={isBlocked}
              isUpdating={isUpdating}
              isResetting={isResetting}
              confirmBlock={confirmBlock}
              setConfirmBlock={setConfirmBlock}
              confirmReset={confirmReset}
              setConfirmReset={setConfirmReset}
              resetDone={resetDone}
              onBlock={handleBlock}
              onResetPassword={handleResetPassword}
            />
          )}
          {section === 'profil' && <ProfileSection profile={user.profile} />}
          {section === 'firmalar' && <CompaniesSection companies={user.companies} />}
          {section === 'konusmalar' && <ConversationsSection userId={id} authorized={authorized} />}
          {section === 'oturumlar' && <SessionsSection userId={id} />}
          {section === 'kutuphaneler' && (
            <SimpleEmptyCard
              title="Bağlı Kütüphaneler"
              icon={<Library className="size-5" />}
              message="Kütüphane bağlantıları için backend entegrasyonu yakında eklenecek."
            />
          )}
          {section === 'email' && (
            <SimpleEmptyCard
              title="Alınan Emailler"
              icon={<Mail className="size-5" />}
              message="Email geçmişi için backend entegrasyonu yakında eklenecek."
            />
          )}
          {ACCOUNT_SECTIONS.includes(section) && (
            <AccountSections userId={id} view={section} authorized={authorized} />
          )}
        </div>
      </div>
    </RoleGuard>
  );
}

/* ─── Genel ─── */
function GeneralSection({
  user,
  cmsRoles,
  isBlocked,
  isUpdating,
  isResetting,
  confirmBlock,
  setConfirmBlock,
  confirmReset,
  setConfirmReset,
  resetDone,
  onBlock,
  onResetPassword,
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Kullanıcı Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size="lg" />
            <div className="min-w-0 flex-1">
              <span className="text-base font-semibold text-foreground">{user.name}</span>
              <p className="mt-0.5 text-sm text-muted-foreground">{user.email ?? '—'}</p>
              <p className="mt-0.5 max-w-full truncate font-mono text-[11px] text-muted-foreground" title={user.id}>
                {user.id}
              </p>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatRow icon={Mail} label="E-posta" value={user.email ?? '—'} />
            <StatRow icon={CalendarDays} label="Üye Tarihi" value={formatTrDate(user.memberSince)} />
            <StatRow icon={MonitorSmartphone} label="Oturum Sayısı" value={`${user.sessionCount ?? 0} oturum`} />
            <StatRow icon={Building2} label="Firma Sayısı" value={`${user.companies?.length ?? 0} firma`} />
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Roller</p>
            <div className="flex flex-wrap gap-1.5">
              {cmsRoles.length > 0 ? (
                cmsRoles.map((r) => (
                  <Badge key={r} variant={roleMeta[r]?.variant ?? 'muted'}>
                    {roleMeta[r]?.label ?? r}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">CMS rolü yok</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hesap Durumu / yönetim aksiyonları */}
      <Card>
        <CardHeader>
          <CardTitle>Hesap Durumu</CardTitle>
          <CardToolbar>
            <Badge variant={statusMeta[user.status]?.variant ?? 'muted'}>
              {statusMeta[user.status]?.label ?? user.status}
            </Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Erişim / Engelleme */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hesap Erişimi
            </p>
            {isBlocked ? (
              <div className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <div className="flex items-center gap-2">
                  <ShieldOff className="size-4 text-destructive" />
                  <p className="text-sm font-medium text-destructive">Hesap Engelli</p>
                </div>
                <Button size="sm" variant="outline" className="w-full" disabled={isUpdating} onClick={() => onBlock(false)}>
                  <ShieldCheck className="size-3.5" />
                  {isUpdating ? 'İşleniyor…' : 'Engeli Kaldır'}
                </Button>
              </div>
            ) : confirmBlock ? (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">Emin misiniz?</p>
                <p className="text-xs text-muted-foreground">Bu kullanıcının sisteme erişimi kaldırılacak.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" className="flex-1" disabled={isUpdating} onClick={() => onBlock(true)}>
                    {isUpdating ? 'İşleniyor…' : 'Engelle'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isUpdating} onClick={() => setConfirmBlock(false)}>
                    İptal
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/5"
                onClick={() => setConfirmBlock(true)}
              >
                <ShieldOff className="size-4" />
                Kullanıcıyı Engelle
              </Button>
            )}
          </div>

          <div className="h-px bg-border" />

          {/* Şifre yenileme */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Şifre</p>
            {resetDone ? (
              <div className="space-y-1 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/40 dark:bg-green-950/20">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-4 text-green-600" />
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Şifre yenileme istendi</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Kullanıcı bir sonraki girişinde şifresini yenileyip e-postasını onaylayacak.
                </p>
              </div>
            ) : confirmReset ? (
              <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Emin misiniz?</p>
                <p className="text-xs text-muted-foreground">
                  Sonraki girişte şifre yenileme ve e-posta onayı zorunlu kılınacak.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" disabled={isResetting} onClick={onResetPassword}>
                    {isResetting ? 'İşleniyor…' : 'Şifre Yenile'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isResetting} onClick={() => setConfirmReset(false)}>
                    İptal
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setConfirmReset(true)}>
                <KeyRound className="size-4" />
                Şifre Yenile
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

/* ─── Profil ─── */
function ProfileSection({ profile }) {
  if (!profile) {
    return (
      <SimpleEmptyCard
        title="Profil Bilgileri"
        icon={<Contact className="size-5" />}
        message="Bu kullanıcı için profil kaydı bulunamadı."
      />
    );
  }
  const [ptab, setPtab] = useState('adresler');

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Profil Detayları</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <StatRow icon={CalendarDays} label="Doğum Tarihi" value={profile.birthDate ? formatTrDate(profile.birthDate) : '—'} />
          <StatRow icon={Users} label="Cinsiyet" value={genderLabel(profile.gender)} />
          <StatRow icon={Globe} label="Dil" value={profile.language?.toUpperCase() || '—'} />
          <StatRow icon={Clock3} label="Saat Dilimi" value={profile.timeZone || '—'} />
        </CardContent>
      </Card>

      <Tabs value={ptab} onValueChange={setPtab} className="space-y-4">
        <div className="rounded-xl border border-border bg-card">
          <TabsList className="px-4">
            <TabsTrigger value="adresler">
              Adresler
              <Badge variant="muted" className="ms-2">{profile.addresses?.length ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="telefonlar">
              Telefonlar
              <Badge variant="muted" className="ms-2">{profile.phones?.length ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="sosyal">
              Sosyal Medya
              <Badge variant="muted" className="ms-2">{profile.socialAccounts?.length ?? 0}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Adresler */}
        <TabsContent value="adresler">
          <Card>
            <CardContent className="p-2">
              {(profile.addresses?.length ?? 0) > 0 ? (
                <div className="space-y-0.5">
                  {profile.addresses.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{a.label || 'Adres'}</p>
                          {a.isDefault && <Badge variant="primary">Varsayılan</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {[a.addressLine, a.neighborhood, a.district, a.province, a.postalCode, a.country]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<MapPin className="size-5" />}
                  title="Adres yok"
                  description="Bu kullanıcının kayıtlı adresi bulunmuyor."
                  className="py-10"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Telefonlar */}
        <TabsContent value="telefonlar">
          <Card>
            <CardContent className="p-2">
              {(profile.phones?.length ?? 0) > 0 ? (
                <div className="space-y-0.5">
                  {profile.phones.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
                      <Phone className="size-4 shrink-0 text-muted-foreground" />
                      <span className="font-mono text-sm text-foreground">{p.number || '—'}</span>
                      {p.label && <span className="text-xs text-muted-foreground">{p.label}</span>}
                      {p.isPrimary && <Badge variant="primary">Birincil</Badge>}
                      {p.verified ? <Badge variant="success">Doğrulandı</Badge> : <Badge variant="muted">Doğrulanmadı</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Phone className="size-5" />}
                  title="Telefon yok"
                  description="Bu kullanıcının kayıtlı telefonu bulunmuyor."
                  className="py-10"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sosyal Medya */}
        <TabsContent value="sosyal">
          <Card>
            <CardContent className="p-2">
              {(profile.socialAccounts?.length ?? 0) > 0 ? (
                <div className="space-y-0.5">
                  {profile.socialAccounts.map((sm) => (
                    <div key={sm.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
                      <div className="flex min-w-0 items-center gap-3">
                        <Share2 className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium capitalize text-foreground">{sm.platform || '—'}</p>
                          {sm.handle && <p className="truncate text-xs text-muted-foreground">{sm.handle}</p>}
                        </div>
                      </div>
                      {sm.link && (
                        <a href={sm.link} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 text-xs text-primary hover:underline">
                          Aç
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Share2 className="size-5" />}
                  title="Sosyal medya hesabı yok"
                  description="Bu kullanıcının kayıtlı sosyal medya hesabı bulunmuyor."
                  className="py-10"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ─── Firmalar ─── */
function CompaniesSection({ companies }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Firmalar</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{companies?.length ?? 0} firma</Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="p-2">
        {(companies?.length ?? 0) > 0 ? (
          <div className="space-y-0.5">
            {companies.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                      {c.isActive && <Badge variant="success">Aktif</Badge>}
                      <Badge variant="muted">{c.role === 'owner' ? 'Sahip' : 'Üye'}</Badge>
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">{c.slug ?? c.id}</p>
                  </div>
                </div>
                <Link href={`/cms/companies/${c.id}`} className="flex shrink-0 items-center gap-1 text-xs text-primary hover:underline">
                  Firmaya Git
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">Bu kullanıcı herhangi bir firmaya bağlı değil.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Hesap / Paketler / Kullanım (lazy account fetch) ─── */
function AccountSections({ userId, view, authorized }) {
  const { data, isLoading, error } = useGetUserAccountQuery(userId, { skip: !authorized });
  const account = data?.account ?? null;

  const title =
    view === 'paketler' ? 'Paketler' : view === 'kullanim' ? 'Kullanım' : 'Hesap';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6" />
          ))}
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Hesap bilgisi yüklenemedi</AlertTitle>
            <AlertDescription>
              {error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  if (!account) {
    return (
      <SimpleEmptyCard
        title={title}
        icon={<Wallet className="size-5" />}
        message="Bu kullanıcı için hesap kaydı bulunamadı."
      />
    );
  }

  if (view === 'paketler') return <PackagesView account={account} />;
  if (view === 'kullanim') return <UsageView usage={account.usage} />;
  return <AccountOverview account={account} />;
}

function AccountOverview({ account }) {
  const amount = account.balance?.amount;
  const currency = account.balance?.currency || '';
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hesap</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <StatRow icon={Wallet} label="Hesap ID" value={account.id} />
        <StatRow
          icon={Wallet}
          label="Bakiye"
          value={amount != null ? `${amount} ${currency}`.trim() : '—'}
        />
        <StatRow icon={Package} label="Paket Sayısı" value={`${account.packages?.length ?? 0} paket`} />
        <StatRow icon={CalendarDays} label="Oluşturulma" value={formatTrDate(account.createdAt)} />
      </CardContent>
    </Card>
  );
}

function PackagesView({ account }) {
  const packages = account.packages ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Paketler</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{packages.length} paket</Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {packages.length === 0 ? (
          <EmptyState
            icon={<Package className="size-5" />}
            title="Paket yok"
            description="Bu kullanıcıya ekli paket bulunmuyor."
            className="py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paket</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Bitiş</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((p) => (
                  <TableRow key={p.id ?? p.packageId ?? p.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                        {p.forCompany && <Badge variant="muted">Firma</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">{p.category ?? '—'}</TableCell>
                    <TableCell>
                      {p.isActive ? <Badge variant="success">Aktif</Badge> : <Badge variant="muted">Pasif</Badge>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.expiredAt ? formatTrDate(p.expiredAt) : '—'}
                    </TableCell>
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

function UsageView({ usage }) {
  // usage şekli serbest; primitive ve bir seviye iç içe nesneleri düzleştir.
  const flat = [];
  for (const [k, v] of Object.entries(usage || {})) {
    if (v == null) continue;
    if (typeof v === 'object') {
      for (const [k2, v2] of Object.entries(v)) {
        if (v2 != null && typeof v2 !== 'object') flat.push([`${k}.${k2}`, v2]);
      }
    } else {
      flat.push([k, v]);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kullanım</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{flat.length} metrik</Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="p-2">
        {flat.length === 0 ? (
          <EmptyState
            icon={<Activity className="size-5" />}
            title="Kullanım verisi yok"
            description="Bu hesap için kullanım metriği bulunmuyor."
            className="py-10"
          />
        ) : (
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border sm:grid-cols-2">
            {flat.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between bg-card px-3 py-2.5">
                <span className="font-mono text-xs text-muted-foreground">{k}</span>
                <span className="text-sm font-medium text-foreground">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Konuşmalar (lazy, sayfalı) ─── */
const CONV_STATUS = {
  active: { label: 'Aktif', variant: 'primary' },
  completed: { label: 'Tamamlandı', variant: 'success' },
};
function ConversationsSection({ userId, authorized }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error } = useGetUserConversationsQuery(
    { id: userId, page, limit: 10 },
    { skip: !authorized },
  );
  const conversations = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Konuşmalar</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{total} konuşma</Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="relative px-0 py-0">
        {isFetching && !isLoading && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
        {error ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertTitle>Konuşmalar yüklenemedi</AlertTitle>
              <AlertDescription>
                {error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}
              </AlertDescription>
            </Alert>
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare className="size-5" />}
            title="Konuşma yok"
            description="Bu kullanıcının kayıtlı konuşması bulunmuyor."
            className="py-10"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Başlık</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">Mesaj</TableHead>
                    <TableHead className="text-right">Token</TableHead>
                    <TableHead className="text-right">Maliyet</TableHead>
                    <TableHead>Güncellenme</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversations.map((c) => {
                    const st = CONV_STATUS[c.status] ?? { label: c.status, variant: 'muted' };
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground" title={c.title}>
                              {c.title}
                            </p>
                            {c.conversationId && (
                              <p className="truncate font-mono text-[11px] text-muted-foreground" title={c.conversationId}>
                                {c.conversationId}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-foreground">
                          {c.messageCount}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-foreground">
                          {(c.totalTokens ?? 0).toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {c.totalCost ? `$${Number(c.totalCost).toFixed(4)}` : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {formatTrDateTime(c.updatedAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Sayfa <span className="font-medium text-foreground">{page}</span> / {totalPages}
                {' · '}
                Toplam <span className="font-medium text-foreground">{total}</span> konuşma
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
                  <ChevronLeft className="size-4" />
                  Önceki
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => Math.min(p + 1, totalPages))}>
                  Sonraki
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Oturumlar (lazy) ─── */
function SessionsSection({ userId }) {
  const { data, isLoading, error } = useGetUserSessionsQuery(userId);
  const sessions = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Oturum Geçmişi</CardTitle>
        <CardToolbar>
          <Badge variant="muted">{sessions.length} oturum</Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {error ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertTitle>Oturumlar yüklenemedi</AlertTitle>
              <AlertDescription>
                {error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}
              </AlertDescription>
            </Alert>
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-5" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<MonitorSmartphone className="size-5" />}
            title="Oturum kaydı yok"
            description="Bu kullanıcı henüz giriş yapmamış."
            className="py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cihaz</TableHead>
                  <TableHead>IP Adresi</TableHead>
                  <TableHead>Konum</TableHead>
                  <TableHead>Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MonitorSmartphone className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm">{s.device}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.ip}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.location}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatTrDateTime(s.time)}
                    </TableCell>
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

/* ─── helpers ─── */
function SimpleEmptyCard({ title, icon, message }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <EmptyState icon={icon} title="Veri kaynağı henüz mevcut değil" description={message} className="py-10" />
      </CardContent>
    </Card>
  );
}

function StatRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
