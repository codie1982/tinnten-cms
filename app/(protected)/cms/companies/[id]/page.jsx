'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Building2, MapPin, Phone, Share2, Landmark, Users, Package,
  Globe, Mail, CalendarDays, Hash, BadgeCheck, ExternalLink,
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
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useGetCompanyQuery } from '@/redux/services';
import { statusMeta, companyTypeMeta, businessModeMeta } from '../_data';

/* ─── sol alt-menü ─── */
const SECTIONS = [
  { key: 'genel', label: 'Genel', icon: Building2 },
  { key: 'adresler', label: 'Adresler', icon: MapPin },
  { key: 'telefonlar', label: 'Telefonlar', icon: Phone },
  { key: 'sosyal', label: 'Sosyal Medya', icon: Share2 },
  { key: 'banka', label: 'Banka Hesapları', icon: Landmark },
  { key: 'calisanlar', label: 'Çalışanlar', icon: Users },
  { key: 'paketler', label: 'Hesap & Paketler', icon: Package },
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

  const COUNT = {
    adresler: addresses.length,
    telefonlar: phones.length,
    sosyal: socials.length,
    banka: banks.length,
    calisanlar: employees.length,
    paketler: packages.length,
  };

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
              <CardContent className="p-4">
                {packages.length === 0 ? (
                  <EmptyCard icon={<Package className="size-5" />} message="Bu firmaya bağlı paket yok." />
                ) : (
                  <div className="space-y-2">
                    {packages.map((p, i) => {
                      const pkg = p.packageid;
                      const name = (pkg && typeof pkg === 'object') ? (pkg.title || pkg.name) : '—';
                      const category = (pkg && typeof pkg === 'object') ? pkg.category : null;
                      return (
                        <div key={p._id || i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">{name}</p>
                            {category && <p className="text-xs text-muted-foreground capitalize">{category}</p>}
                          </div>
                          {p.expireDate && (
                            <span className="font-mono text-xs text-muted-foreground">Bitiş: {formatTrDate(p.expireDate)}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
