'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  Pencil,
  Check,
  X,
  ShieldOff,
  ShieldCheck,
  MonitorSmartphone,
  Mail,
  Library,
  Clock,
  Users,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { SplitShell, EmptyState } from '@/components/layout/page-shell';
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
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CMS_ROLES } from '@/lib/roles';
import { usersMock, roleMeta, statusMeta, emailStatusMeta } from '../_data';

/* ─── page ─── */
export default function CmsUserDetailPage({ params }) {
  const { id } = use(params);
  const userData = usersMock.find((u) => u.id === id);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(userData?.name ?? '');
  const [activeStatus, setActiveStatus] = useState(userData?.status ?? 'active');
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [isBlocked, setIsBlocked] = useState(userData?.blocked ?? false);
  const [tab, setTab] = useState('genel');

  /* ─── not found ─── */
  if (!userData) {
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
            Bu ID ile eşleşen kullanıcı bulunamadı.{' '}
            <Link href="/cms/users/list" className="text-primary hover:underline">
              Listeye dön
            </Link>
          </CardContent>
        </Card>
      </RoleGuard>
    );
  }

  /* ─── aside ─── */
  const aside = (
    <>
      {/* Özet */}
      <Card>
        <CardHeader>
          <CardTitle>Özet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatRow icon={Clock} label="Son Giriş" value={userData.lastSession?.time ?? 'Henüz giriş yapılmadı'} />
          <StatRow icon={Mail} label="Email Sayısı" value={`${userData.emailCount} email`} />
          <StatRow icon={Library} label="Kütüphane" value={`${userData.libraries.length} kütüphane`} />
          <StatRow icon={Users} label="Üye Tarihi" value={userData.memberSince} />
        </CardContent>
      </Card>

      {/* Hesap Durumu */}
      <Card>
        <CardHeader>
          <CardTitle>Hesap Durumu</CardTitle>
          <CardToolbar>
            <Badge variant={statusMeta[activeStatus]?.variant ?? 'muted'}>
              {statusMeta[activeStatus]?.label ?? activeStatus}
            </Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Active / Passive toggle */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aktiflik
            </p>
            <button
              type="button"
              onClick={() =>
                setActiveStatus((s) => (s === 'active' ? 'passive' : 'active'))
              }
              className={cn(
                'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                activeStatus === 'active'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-border bg-muted/40 text-muted-foreground hover:bg-accent',
              )}
            >
              <span>{activeStatus === 'active' ? 'Aktif' : 'Pasif'}</span>
              <span
                className={cn(
                  'size-2.5 rounded-full transition-colors',
                  activeStatus === 'active' ? 'bg-green-500' : 'bg-muted-foreground/40',
                )}
              />
            </button>
          </div>

          <div className="h-px bg-border" />

          {/* Block */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Engelleme
            </p>

            {isBlocked ? (
              <div className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <div className="flex items-center gap-2">
                  <ShieldOff className="size-4 text-destructive" />
                  <p className="text-sm font-medium text-destructive">Hesap Engelli</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsBlocked(false)}
                >
                  <ShieldCheck className="size-3.5" />
                  Engeli Kaldır
                </Button>
              </div>
            ) : confirmBlock ? (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">Emin misiniz?</p>
                <p className="text-xs text-muted-foreground">
                  Bu kullanıcının CMS erişimi kaldırılacak.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setIsBlocked(true);
                      setConfirmBlock(false);
                    }}
                  >
                    Engelle
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmBlock(false)}
                  >
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
        </CardContent>
      </Card>
    </>
  );

  /* ─── render ─── */
  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        breadcrumb={[
          { label: 'Kullanıcılar', href: '/cms/users/list' },
          { label: nameValue },
        ]}
        title={nameValue}
      />

      <SplitShell aside={aside}>
        <Tabs value={tab} onValueChange={setTab} className="space-y-5">
          {/* Tab nav */}
          <div className="rounded-xl border border-border bg-card">
            <TabsList className="px-4">
              <TabsTrigger value="genel">Genel</TabsTrigger>
              <TabsTrigger value="oturumlar">Oturumlar</TabsTrigger>
              <TabsTrigger value="kutuphaneler">Kütüphaneler</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
            </TabsList>
          </div>

          {/* ── Genel ── */}
          <TabsContent value="genel" className="space-y-5">
            {/* Kullanıcı Bilgileri */}
            <Card>
              <CardHeader>
                <CardTitle>Kullanıcı Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                {/* Avatar + isim */}
                <div className="flex items-center gap-4">
                  <Avatar name={nameValue} size="lg" />
                  <div className="min-w-0 flex-1">
                    {editingName ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={nameValue}
                          onChange={(e) => setNameValue(e.target.value)}
                          className="max-w-xs"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setEditingName(false);
                            if (e.key === 'Escape') {
                              setNameValue(userData.name);
                              setEditingName(false);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setEditingName(false)}
                          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Check className="size-4 text-green-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNameValue(userData.name);
                            setEditingName(false);
                          }}
                          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-foreground">
                          {nameValue}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingName(true)}
                          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </div>
                    )}
                    <p className="mt-0.5 text-sm text-muted-foreground">{userData.email}</p>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Roller */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Roller
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {userData.roles.map((r) => (
                      <Badge key={r} variant={roleMeta[r]?.variant ?? 'muted'}>
                        {roleMeta[r]?.label ?? r}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Firma Bağlantısı */}
            <Card>
              <CardHeader>
                <CardTitle>Firma Bağlantısı</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {userData.company ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {userData.company.name}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {userData.company.id}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/cms/companies/${userData.company.id}`}
                      className="flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Firmaya Git
                      <ExternalLink className="size-3" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Bu kullanıcı herhangi bir firmaya bağlı değil.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Oturumlar ── */}
          <TabsContent value="oturumlar">
            <Card>
              <CardHeader>
                <CardTitle>Oturum Geçmişi</CardTitle>
                <CardToolbar>
                  <Badge variant="muted">{userData.sessions.length} oturum</Badge>
                </CardToolbar>
              </CardHeader>
              <CardContent className="px-0 py-0">
                {userData.sessions.length === 0 ? (
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
                        {userData.sessions.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <MonitorSmartphone className="size-4 shrink-0 text-muted-foreground" />
                                <span className="text-sm">{s.device}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {s.ip}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {s.location}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {s.time}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Kütüphaneler ── */}
          <TabsContent value="kutuphaneler">
            <Card>
              <CardHeader>
                <CardTitle>Bağlı Kütüphaneler</CardTitle>
                <CardToolbar>
                  <Badge variant="muted">{userData.libraries.length} kütüphane</Badge>
                </CardToolbar>
              </CardHeader>
              <CardContent className="p-2">
                {userData.libraries.length === 0 ? (
                  <EmptyState
                    icon={<Library className="size-5" />}
                    title="Bağlı kütüphane yok"
                    description="Bu kullanıcı henüz bir kütüphaneye bağlanmamış."
                    className="py-10"
                  />
                ) : (
                  <div className="space-y-0.5">
                    {userData.libraries.map((lib) => (
                      <div
                        key={lib.id}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50"
                      >
                        <Library className="size-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-sm text-foreground">{lib.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{lib.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Email ── */}
          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle>Alınan Emailler</CardTitle>
                <CardToolbar>
                  <Badge variant="muted">{userData.emails.length} email</Badge>
                </CardToolbar>
              </CardHeader>
              <CardContent className="px-0 py-0">
                {userData.emails.length === 0 ? (
                  <EmptyState
                    icon={<Mail className="size-5" />}
                    title="Email bulunamadı"
                    description="Bu kullanıcıya henüz email gönderilmemiş."
                    className="py-10"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Konu</TableHead>
                          <TableHead>Tarih</TableHead>
                          <TableHead>Durum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userData.emails.map((em) => {
                          const es = emailStatusMeta[em.status];
                          return (
                            <TableRow key={em.id}>
                              <TableCell className="text-sm font-medium text-foreground">
                                {em.subject}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {em.sentAt}
                              </TableCell>
                              <TableCell>
                                <Badge variant={es?.variant ?? 'muted'}>
                                  {es?.label ?? em.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SplitShell>
    </RoleGuard>
  );
}

/* ─── StatRow helper ─── */
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
