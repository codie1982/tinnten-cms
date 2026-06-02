'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Building2, MapPin, Phone, Share2, Landmark, Users, Package,
  Globe, Mail, CalendarDays, Hash, BadgeCheck, ExternalLink, Gauge,
  SlidersHorizontal, Loader2, Ban, ShieldCheck,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/page-shell';
import {
  Card, CardContent, CardHeader, CardTitle, CardToolbar,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetCompanyQuery,
  useUpdateCompanyLimitsMutation,
  useUpdateCompanyUsageMutation,
  useResetCompanyUsageMutation,
  useSetCompanyAdminActiveMutation,
} from '@/redux/services';
import { statusMeta, companyTypeMeta, businessModeMeta } from '../_data';
import { AccountSummary, PackagesTable, LimitsPanel, UsagePanel } from '@/components/cms/account-panels';

/* ─── sol alt-menü ─── */
const SECTIONS = [
  { key: 'genel', label: 'Genel', icon: Building2 },
  { key: 'adresler', label: 'Adresler', icon: MapPin },
  { key: 'telefonlar', label: 'Telefonlar', icon: Phone },
  { key: 'sosyal', label: 'Sosyal Medya', icon: Share2 },
  { key: 'banka', label: 'Banka Hesapları', icon: Landmark },
  { key: 'calisanlar', label: 'Çalışanlar', icon: Users },
  { key: 'paketler', label: 'Hesap & Paketler', icon: Package },
  { key: 'limitler', label: 'Limitler', icon: SlidersHorizontal },
  { key: 'kullanim', label: 'Kullanım', icon: Gauge },
];

function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function countOf(c, key) {
  const v = c?.[key];
  return Array.isArray(v) ? v.length : 0;
}

/* ─── küçük yardımcı: bilgi satırı ─── */
function InfoRow({ icon: Icon, label, value, href }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {value || '—'} <ExternalLink className="size-3" />
          </a>
        ) : (
          <p className="text-sm font-medium text-foreground break-words">{value || '—'}</p>
        )}
      </div>
    </div>
  );
}

/* ─── boş durum kartı ─── */
function EmptyCard({ icon, message }) {
  return (
    <EmptyState icon={icon} title="Kayıt yok" description={message} className="py-10" />
  );
}

export default function CmsCompanyDetailPage({ params }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const [section, setSection] = useState('genel');

  const { data: company, isLoading, error } = useGetCompanyQuery(id, { skip: !authorized });
  const [updateLimits, { isLoading: savingLimits }] = useUpdateCompanyLimitsMutation();
  const [updateUsage, { isLoading: savingUsage }] = useUpdateCompanyUsageMutation();
  const [resetUsage, { isLoading: resettingUsage }] = useResetCompanyUsageMutation();
  const [setAdminActive, { isLoading: savingAdminActive }] = useSetCompanyAdminActiveMutation();

  // Engelleme state'i
  const [blockOpen, setBlockOpen] = useState(false); // gerekçe formu açık mı
  const [blockReason, setBlockReason] = useState('');
  const [blockNotice, setBlockNotice] = useState(null); // { type, text }

  if (isLoading) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
        <PageHeader breadcrumb={[{ label: 'Firmalar', href: '/cms/companies/list' }, { label: '…' }]} title="Yükleniyor…" />
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </RoleGuard>
    );
  }

  if (error || !company) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
        <PageHeader breadcrumb={[{ label: 'Firmalar', href: '/cms/companies/list' }, { label: 'Bulunamadı' }]} title="Firma Bulunamadı" />
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {error ? (error?.data?.message || 'Yükleme hatası.') : 'Bu firma bulunamadı.'}{' '}
            <Link href="/cms/companies/list" className="text-primary hover:underline">Listeye dön</Link>
          </CardContent>
        </Card>
      </RoleGuard>
    );
  }

  const s = statusMeta[company.status];
  const mode = businessModeMeta[company.businessMode];
  const type = companyTypeMeta[company.companyType];
  const addresses = company.address ?? [];
  const phones = company.phone ?? [];
  const socials = company.social ?? [];
  const banks = company.bankAccounts ?? [];
  const employees = company.employees ?? [];
  const packages = company.account?.packages ?? [];
  const limitUsage = company.limitUsage ?? null;
  const metrics = limitUsage?.metrics ?? [];

  // Paketleri ortak PackagesTable şemasına normalize et
  const normalizedPackages = packages.map((p) => ({
    id: p._id || p.id || null,
    name: (p.packageid && typeof p.packageid === 'object' ? p.packageid.title : null) || p.packageName || '—',
    category: (p.packageid && typeof p.packageid === 'object' ? p.packageid.category : null) || p.category || null,
    isActive: p.isActive ?? true,
    forCompany: Boolean(p.forCompany),
    expiredAt: p.expiredAt || null,
  }));

  const COUNT = {
    adresler: addresses.length,
    telefonlar: phones.length,
    sosyal: socials.length,
    banka: banks.length,
    calisanlar: employees.length,
    paketler: packages.length,
    limitler: metrics.length,
    kullanim: metrics.length,
  };

  // ─── Engelle / Engeli kaldır ───
  const handleBlock = async () => {
    if (!blockReason.trim()) {
      setBlockNotice({ type: 'error', text: 'Engelleme için gerekçe zorunludur.' });
      return;
    }
    try {
      await setAdminActive({ id, active: false, reason: blockReason.trim() }).unwrap();
      setBlockNotice({ type: 'success', text: 'Firma engellendi.' });
      setBlockOpen(false);
      setBlockReason('');
    } catch (e) {
      setBlockNotice({ type: 'error', text: e?.data?.message || 'Firma engellenemedi.' });
    }
  };

  const handleUnblock = async () => {
    try {
      await setAdminActive({ id, active: true }).unwrap();
      setBlockNotice({ type: 'success', text: 'Firma engeli kaldırıldı.' });
    } catch (e) {
      setBlockNotice({ type: 'error', text: e?.data?.message || 'Engel kaldırılamadı.' });
    }
  };

  const isBlocked = company.adminActive === false;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        breadcrumb={[{ label: 'Firmalar', href: '/cms/companies/list' }, { label: company.companyName }]}
        title={company.companyName}
      />

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        {/* Sol alt-menü */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            {/* Firma özeti */}
            <div className="flex flex-col items-center gap-2 border-b border-border p-4 text-center">
              <Avatar name={company.companyName} src={company.companyImage?.url || undefined} size="lg" />
              <div>
                <p className="text-sm font-semibold text-foreground">{company.companyName}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{company.slug}</p>
              </div>
              {s && <Badge variant={s.variant}>{s.label}</Badge>}
            </div>
            {/* Sub-menu */}
            <nav className="space-y-0.5 p-2">
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const active = section === sec.key;
                const count = COUNT[sec.key];
                return (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() => setSection(sec.key)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 text-left">{sec.label}</span>
                    {count != null && count > 0 && (
                      <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        {/* Sağ içerik */}
        <div className="space-y-5">
          {/* Engelleme kontrolü — her sekmede görünür */}
          <Card className={cn(isBlocked && 'border-destructive/40')}>
            <CardContent className="space-y-3 p-4">
              {blockNotice && (
                <Alert variant={blockNotice.type === 'error' ? 'destructive' : 'info'}>
                  <AlertDescription>{blockNotice.text}</AlertDescription>
                </Alert>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {isBlocked ? <Ban className="size-5 text-destructive" /> : <ShieldCheck className="size-5 text-green-600" />}
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {isBlocked ? 'Firma engellendi' : 'Firma aktif'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {company.adminActiveReason || 'Standart Giriş'}
                      {company.adminActiveAt ? ` · ${formatTrDate(company.adminActiveAt)}` : ''}
                    </p>
                  </div>
                </div>

                {isBlocked ? (
                  <Button size="sm" variant="outline" onClick={handleUnblock} disabled={savingAdminActive}>
                    {savingAdminActive ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                    Engeli Kaldır
                  </Button>
                ) : !blockOpen ? (
                  <Button size="sm" variant="destructive" onClick={() => { setBlockNotice(null); setBlockOpen(true); }} disabled={savingAdminActive}>
                    <Ban className="size-4" />
                    Firmayı Engelle
                  </Button>
                ) : null}
              </div>

              {/* Engelleme gerekçe formu */}
              {!isBlocked && blockOpen && (
                <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <label className="text-xs font-medium text-foreground">Engelleme Gerekçesi *</label>
                  <textarea
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    rows={2}
                    placeholder="Örn: Şüpheli aktivite, sözleşme ihlali…"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={handleBlock} disabled={savingAdminActive || !blockReason.trim()}>
                      {savingAdminActive ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
                      Engelle
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setBlockOpen(false); setBlockReason(''); }} disabled={savingAdminActive}>
                      Vazgeç
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {section === 'genel' && (
            <Card>
              <CardHeader><CardTitle>Genel Bilgiler</CardTitle></CardHeader>
              <CardContent className="grid gap-x-8 gap-y-1 p-6 sm:grid-cols-2">
                <InfoRow icon={Building2} label="Firma Adı" value={company.companyName} />
                <InfoRow icon={Hash} label="Slug" value={company.slug} />
                <InfoRow icon={Mail} label="E-posta" value={company.email} />
                <InfoRow icon={Globe} label="Web Sitesi" value={company.website} href={company.website || undefined} />
                <InfoRow icon={BadgeCheck} label="Firma Tipi" value={type?.label ?? company.companyType} />
                <InfoRow icon={BadgeCheck} label="İş Modu" value={mode?.label ?? company.businessMode} />
                <InfoRow icon={CalendarDays} label="Kuruluş" value={formatTrDate(company.foundedDate)} />
                <InfoRow icon={CalendarDays} label="Kayıt Tarihi" value={formatTrDate(company.createdAt)} />
                <InfoRow icon={isBlocked ? Ban : ShieldCheck} label="Admin Durumu" value={isBlocked ? 'Engelli' : 'Aktif'} />
                <InfoRow icon={CalendarDays} label="Admin Durum Tarihi" value={formatTrDate(company.adminActiveAt)} />
                <div className="sm:col-span-2">
                  <InfoRow label="Admin Durum Gerekçesi" value={company.adminActiveReason} />
                </div>
                <div className="sm:col-span-2">
                  <InfoRow label="Açıklama" value={company.description} />
                </div>
                {Array.isArray(company.industry) && company.industry.length > 0 && (
                  <div className="sm:col-span-2 py-2">
                    <p className="mb-1.5 text-xs text-muted-foreground">Sektörler</p>
                    <div className="flex flex-wrap gap-1.5">
                      {company.industry.filter(Boolean).map((ind, i) => (
                        <Badge key={i} variant="muted">{ind}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'adresler' && (
            <Card>
              <CardHeader>
                <CardTitle>Adresler</CardTitle>
                <CardToolbar><Badge variant="muted">{addresses.length} adres</Badge></CardToolbar>
              </CardHeader>
              <CardContent className="p-4">
                {addresses.length === 0 ? (
                  <EmptyCard icon={<MapPin className="size-5" />} message="Bu firmaya ait adres kaydı yok." />
                ) : (
                  <div className="space-y-3">
                    {addresses.map((a, i) => (
                      <div key={a._id || i} className="rounded-lg border border-border p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{a.label || a.title || a.type || `Adres ${i + 1}`}</span>
                          {a.isDefault && <Badge variant="primary">Varsayılan</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {[a.fullAddress || a.addressLine || a.street, a.neighborhood, a.district, a.city || a.province, a.postalCode || a.zip, a.country]
                            .filter(Boolean).join(', ') || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'telefonlar' && (
            <Card>
              <CardHeader>
                <CardTitle>Telefonlar</CardTitle>
                <CardToolbar><Badge variant="muted">{phones.length} numara</Badge></CardToolbar>
              </CardHeader>
              <CardContent className="px-0 py-0">
                {phones.length === 0 ? (
                  <div className="p-4"><EmptyCard icon={<Phone className="size-5" />} message="Telefon kaydı yok." /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numara</TableHead>
                        <TableHead>Tip</TableHead>
                        <TableHead>Etiket</TableHead>
                        <TableHead>Doğrulama</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phones.map((p, i) => (
                        <TableRow key={p._id || i}>
                          <TableCell className="font-medium">
                            {p.number}
                            {p.isPrimary && <Badge variant="primary" className="ml-2">Birincil</Badge>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.type || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{p.label || '—'}</TableCell>
                          <TableCell>
                            {p.aprove ? <Badge variant="success">Doğrulandı</Badge> : <Badge variant="muted">Bekliyor</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'sosyal' && (
            <Card>
              <CardHeader>
                <CardTitle>Sosyal Medya</CardTitle>
                <CardToolbar><Badge variant="muted">{socials.length} hesap</Badge></CardToolbar>
              </CardHeader>
              <CardContent className="p-4">
                {socials.length === 0 ? (
                  <EmptyCard icon={<Share2 className="size-5" />} message="Sosyal medya hesabı yok." />
                ) : (
                  <div className="space-y-2">
                    {socials.map((soc, i) => (
                      <div key={soc._id || i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-foreground capitalize">{soc.platform}</p>
                          {soc.handle && <p className="text-xs text-muted-foreground">{soc.handle}</p>}
                        </div>
                        {soc.link && (
                          <a href={soc.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                            Aç <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'banka' && (
            <Card>
              <CardHeader>
                <CardTitle>Banka Hesapları</CardTitle>
                <CardToolbar><Badge variant="muted">{banks.length} hesap</Badge></CardToolbar>
              </CardHeader>
              <CardContent className="px-0 py-0">
                {banks.length === 0 ? (
                  <div className="p-4"><EmptyCard icon={<Landmark className="size-5" />} message="Banka hesabı kaydı yok." /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Banka</TableHead>
                        <TableHead>Hesap Sahibi</TableHead>
                        <TableHead>IBAN</TableHead>
                        <TableHead>Para Birimi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {banks.map((b, i) => (
                        <TableRow key={b._id || i}>
                          <TableCell className="font-medium">
                            {b.bankName}
                            {b.isPrimary && <Badge variant="primary" className="ml-2">Birincil</Badge>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{b.accountHolder || '—'}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{b.iban}</TableCell>
                          <TableCell className="text-muted-foreground">{b.currency || 'TRY'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'calisanlar' && (
            <Card>
              <CardHeader>
                <CardTitle>Çalışanlar</CardTitle>
                <CardToolbar><Badge variant="muted">{employees.length} kişi</Badge></CardToolbar>
              </CardHeader>
              <CardContent className="p-4">
                {employees.length === 0 ? (
                  <EmptyCard icon={<Users className="size-5" />} message="Kayıtlı çalışan yok." />
                ) : (
                  <div className="space-y-2">
                    {employees.map((e, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                        <Avatar name={String(e.userid || '?')} size="sm" />
                        <span className="font-mono text-xs text-muted-foreground">{e.userid}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'paketler' && (
            <Card>
              <CardHeader>
                <CardTitle>Hesap & Paketler</CardTitle>
                <CardToolbar><Badge variant="muted">{packages.length} paket</Badge></CardToolbar>
              </CardHeader>
              <CardContent className="space-y-5 p-4">
                <AccountSummary
                  accountId={company.account?._id ? String(company.account._id) : null}
                  balance={company.account?.balance}
                  packageCount={packages.length}
                />
                <div className="border-t border-border pt-4">
                  <PackagesTable packages={normalizedPackages} />
                </div>
              </CardContent>
            </Card>
          )}

          {section === 'kullanim' && (
            <UsagePanel
              metrics={metrics}
              packageName={limitUsage?.packageName}
              onSaveUsage={(usage) => updateUsage({ id, usage }).unwrap()}
              onResetUsage={() => resetUsage({ id }).unwrap()}
              savingUsage={savingUsage}
              resetting={resettingUsage}
            />
          )}

          {section === 'limitler' && (
            <LimitsPanel
              metrics={metrics}
              packageName={limitUsage?.packageName}
              onSave={(limits) => updateLimits({ id, limits }).unwrap()}
              saving={savingLimits}
            />
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
