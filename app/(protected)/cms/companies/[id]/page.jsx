'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Building2, MapPin, Phone, Share2, Landmark, Users, Package,
  Globe, Mail, CalendarDays, Hash, BadgeCheck, ExternalLink, Gauge,
  SlidersHorizontal, Save, RotateCcw, Loader2, AlertTriangle, ArrowRight,
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetCompanyQuery,
  useUpdateCompanyLimitsMutation,
  useUpdateCompanyUsageMutation,
  useResetCompanyUsageMutation,
} from '@/redux/services';
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
  { key: 'limitler', label: 'Limitler', icon: SlidersHorizontal },
  { key: 'kullanim', label: 'Kullanım', icon: Gauge },
];

/** Flat key ("ai.images") + değer → nested obje ({ ai: { images: değer } }). */
function keyToNested(key, value) {
  const parts = key.split('.');
  const root = {};
  let cur = root;
  parts.forEach((p, i) => {
    if (i === parts.length - 1) cur[p] = value;
    else { cur[p] = {}; cur = cur[p]; }
  });
  return root;
}

/** Birden çok nested objeyi yıkıcı olmadan birleştirir. */
function mergeNested(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = mergeNested(target[k] || {}, v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

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

  const metrics = company?.limitUsage?.metrics ?? [];
  // Değerlerin imzası — kaydedince (refetch) değişir → draft'lar yeniden tohumlanır.
  const limitsSig = metrics.map((m) => `${m.key}:${m.limit}`).join('|');
  const usageSig = metrics.map((m) => `${m.key}:${m.used}`).join('|');

  // Limit düzenleme state'i
  const [limitDraft, setLimitDraft] = useState({}); // { [key]: number }
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState(null); // { type, text }

  // Kullanım düzenleme state'i
  const [usageDraft, setUsageDraft] = useState({}); // { [key]: number }
  const [usageEditing, setUsageEditing] = useState(false);
  const [usageReviewing, setUsageReviewing] = useState(false);
  const [usageNotice, setUsageNotice] = useState(null); // { type, text }
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!metrics.length) return;
    const seed = {};
    for (const m of metrics) seed[m.key] = m.limit;
    setLimitDraft(seed);
    setReviewing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?._id, limitsSig]);

  useEffect(() => {
    if (!metrics.length) return;
    const seed = {};
    for (const m of metrics) seed[m.key] = m.used;
    setUsageDraft(seed);
    setUsageEditing(false);
    setUsageReviewing(false);
    setConfirmReset(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?._id, usageSig]);

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

  // Değişen limit metrikleri (kontrol/diff için)
  const dirtyMetrics = metrics.filter(
    (m) => Number(limitDraft[m.key] ?? m.limit) !== Number(m.limit),
  );

  const resetLimitDraft = () => {
    const seed = {};
    for (const m of metrics) seed[m.key] = m.limit;
    setLimitDraft(seed);
    setReviewing(false);
    setNotice(null);
  };

  const handleSaveLimits = async () => {
    const payload = {};
    for (const m of metrics) {
      const v = Number(limitDraft[m.key]);
      if (Number.isFinite(v) && v >= 0) mergeNested(payload, keyToNested(m.key, v));
    }
    try {
      await updateLimits({ id, limits: payload }).unwrap();
      setNotice({ type: 'success', text: 'Limitler güncellendi.' });
      setReviewing(false);
    } catch (e) {
      setNotice({ type: 'error', text: e?.data?.message || 'Limitler güncellenemedi.' });
    }
  };

  // ─── Kullanım düzenleme/sıfırlama ───
  const dirtyUsage = metrics.filter(
    (m) => Number(usageDraft[m.key] ?? m.used) !== Number(m.used),
  );

  const cancelUsageEdit = () => {
    const seed = {};
    for (const m of metrics) seed[m.key] = m.used;
    setUsageDraft(seed);
    setUsageEditing(false);
    setUsageReviewing(false);
    setUsageNotice(null);
  };

  const handleSaveUsage = async () => {
    const payload = {};
    for (const m of metrics) {
      const v = Number(usageDraft[m.key]);
      if (Number.isFinite(v) && v >= 0) mergeNested(payload, keyToNested(m.key, v));
    }
    try {
      await updateUsage({ id, usage: payload }).unwrap();
      setUsageNotice({ type: 'success', text: 'Kullanım güncellendi.' });
      setUsageEditing(false);
      setUsageReviewing(false);
    } catch (e) {
      setUsageNotice({ type: 'error', text: e?.data?.message || 'Kullanım güncellenemedi.' });
    }
  };

  const handleResetUsage = async () => {
    try {
      await resetUsage({ id }).unwrap();
      setUsageNotice({ type: 'success', text: 'Kullanım sıfırlandı.' });
      setConfirmReset(false);
    } catch (e) {
      setUsageNotice({ type: 'error', text: e?.data?.message || 'Kullanım sıfırlanamadı.' });
    }
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

          {section === 'kullanim' && (
            <Card>
              <CardHeader>
                <CardTitle>Kullanım</CardTitle>
                <CardToolbar>
                  {limitUsage?.packageName
                    ? <Badge variant="primary">{limitUsage.packageName}</Badge>
                    : <Badge variant="muted">Paket yok</Badge>}
                </CardToolbar>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {metrics.length === 0 ? (
                  <EmptyCard icon={<Gauge className="size-5" />} message="Bu firmanın hesabına bağlı kullanım verisi yok." />
                ) : (
                  <>
                    {usageNotice && (
                      <Alert variant={usageNotice.type === 'error' ? 'destructive' : 'info'}>
                        <AlertDescription>{usageNotice.text}</AlertDescription>
                      </Alert>
                    )}

                    {/* Üst aksiyon çubuğu */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {usageEditing ? 'Kullanım miktarlarını düzenliyorsunuz' : 'Mevcut kullanım / limit oranları'}
                      </span>
                      {!usageEditing && !confirmReset && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => { setUsageNotice(null); setConfirmReset(true); }} disabled={resettingUsage || savingUsage}>
                            <RotateCcw className="size-4" />
                            Kullanımı Sıfırla
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setUsageNotice(null); setUsageEditing(true); }} disabled={resettingUsage || savingUsage}>
                            <SlidersHorizontal className="size-4" />
                            Miktarı Ayarla
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Sıfırlama onayı */}
                    {confirmReset && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                        <p className="flex items-center gap-1.5 text-sm text-foreground">
                          <AlertTriangle className="size-4 text-destructive" />
                          Tüm kullanım sayaçları <span className="font-semibold">0</span>'a sıfırlanacak. Emin misiniz?
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" onClick={handleResetUsage} disabled={resettingUsage}>
                            {resettingUsage ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                            Evet, Sıfırla
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)} disabled={resettingUsage}>
                            Vazgeç
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* DÜZENLEME MODU — kullanım miktarı input'ları */}
                    {usageEditing ? (
                      <>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <AlertTriangle className="size-3.5" />
                          Kullanım sayaçlarını manuel ayarlıyorsunuz. Bu, faturalandırma/kota davranışını etkiler.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {metrics.map((m) => {
                            const val = usageDraft[m.key] ?? m.used;
                            const changed = Number(val) !== Number(m.used);
                            return (
                              <div key={m.key} className={cn('rounded-lg border p-3', changed ? 'border-primary/50 bg-primary/5' : 'border-border')}>
                                <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{m.label}</span>
                                  <span className="font-mono">limit: {m.unlimited ? '∞' : m.limit}</span>
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={val}
                                  disabled={savingUsage}
                                  onChange={(e) => {
                                    setUsageNotice(null);
                                    setUsageReviewing(false);
                                    setUsageDraft((d) => ({ ...d, [m.key]: e.target.value === '' ? '' : Number(e.target.value) }));
                                  }}
                                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Kontrol (diff) paneli */}
                        {usageReviewing && dirtyUsage.length > 0 && (
                          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
                            <p className="mb-2 text-sm font-semibold text-foreground">Değişiklikleri Onayla</p>
                            <ul className="space-y-1.5">
                              {dirtyUsage.map((m) => (
                                <li key={m.key} className="flex items-center gap-2 text-sm">
                                  <span className="min-w-[140px] text-muted-foreground">{m.label}</span>
                                  <span className="font-mono text-muted-foreground">{m.used}</span>
                                  <ArrowRight className="size-3.5 text-primary" />
                                  <span className="font-mono font-semibold text-primary">{Number(usageDraft[m.key])}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" onClick={handleSaveUsage} disabled={savingUsage}>
                                {savingUsage ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                Güncelle
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setUsageReviewing(false)} disabled={savingUsage}>
                                Vazgeç
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Düzenleme aksiyonları */}
                        {!usageReviewing && (
                          <div className="flex items-center justify-between border-t border-border pt-4">
                            <span className="text-xs text-muted-foreground">
                              {dirtyUsage.length > 0 ? `${dirtyUsage.length} değişiklik bekliyor` : 'Değişiklik yok'}
                            </span>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" onClick={cancelUsageEdit} disabled={savingUsage}>
                                İptal
                              </Button>
                              <Button size="sm" onClick={() => setUsageReviewing(true)} disabled={dirtyUsage.length === 0 || savingUsage}>
                                <SlidersHorizontal className="size-4" />
                                Değişiklikleri Kontrol Et
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      /* SALT-OKUNUR — progress bar'lar */
                      <div className="space-y-3">
                        {metrics.map((m, i) => {
                          const pct = m.unlimited || m.limit === 0
                            ? 0
                            : Math.min(Math.round((m.used / m.limit) * 100), 100);
                          const over = !m.unlimited && m.used > m.limit;
                          return (
                            <div key={i} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-foreground">{m.label}</span>
                                <span className={cn('font-mono text-xs', over ? 'text-destructive' : 'text-muted-foreground')}>
                                  {m.used}{' / '}{m.unlimited ? '∞' : m.limit}
                                  {!m.unlimited && ` · %${pct}`}
                                </span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                {m.unlimited ? (
                                  <div className="h-full w-full bg-gradient-to-r from-primary/30 to-primary/10" />
                                ) : (
                                  <div
                                    className={cn('h-full rounded-full transition-all', over ? 'bg-destructive' : pct >= 80 ? 'bg-amber-500' : 'bg-primary')}
                                    style={{ width: `${Math.max(pct, 2)}%` }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'limitler' && (
            <Card>
              <CardHeader>
                <CardTitle>Limitler</CardTitle>
                <CardToolbar>
                  {limitUsage?.packageName
                    ? <Badge variant="primary">{limitUsage.packageName}</Badge>
                    : <Badge variant="muted">Paket yok</Badge>}
                </CardToolbar>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {metrics.length === 0 ? (
                  <EmptyCard icon={<SlidersHorizontal className="size-5" />} message="Bu firmanın hesabına bağlı paket/limit yok." />
                ) : (
                  <>
                    {notice && (
                      <Alert variant={notice.type === 'error' ? 'destructive' : 'info'}>
                        <AlertDescription>{notice.text}</AlertDescription>
                      </Alert>
                    )}

                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <AlertTriangle className="size-3.5" />
                      Değer <span className="font-mono">0</span> = sınırsız. Değişiklikler bu firmanın aktif paketine özel uygulanır.
                    </p>

                    {/* Düzenlenebilir limit alanları */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {metrics.map((m) => {
                        const val = limitDraft[m.key] ?? m.limit;
                        const changed = Number(val) !== Number(m.limit);
                        return (
                          <div key={m.key} className={cn('rounded-lg border p-3', changed ? 'border-primary/50 bg-primary/5' : 'border-border')}>
                            <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{m.label}</span>
                              <span className="font-mono">kullanım: {m.used}</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={val}
                              disabled={savingLimits}
                              onChange={(e) => {
                                setNotice(null);
                                setReviewing(false);
                                setLimitDraft((d) => ({ ...d, [m.key]: e.target.value === '' ? '' : Number(e.target.value) }));
                              }}
                              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Kontrol (diff) paneli */}
                    {reviewing && dirtyMetrics.length > 0 && (
                      <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
                        <p className="mb-2 text-sm font-semibold text-foreground">Değişiklikleri Onayla</p>
                        <ul className="space-y-1.5">
                          {dirtyMetrics.map((m) => {
                            const next = Number(limitDraft[m.key]);
                            return (
                              <li key={m.key} className="flex items-center gap-2 text-sm">
                                <span className="min-w-[140px] text-muted-foreground">{m.label}</span>
                                <span className="font-mono text-muted-foreground">{m.unlimited ? '∞' : m.limit}</span>
                                <ArrowRight className="size-3.5 text-primary" />
                                <span className="font-mono font-semibold text-primary">{next === 0 ? '∞' : next}</span>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={handleSaveLimits} disabled={savingLimits}>
                            {savingLimits ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                            Güncelle
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setReviewing(false)} disabled={savingLimits}>
                            Vazgeç
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Aksiyonlar */}
                    {!reviewing && (
                      <div className="flex items-center justify-between border-t border-border pt-4">
                        <span className="text-xs text-muted-foreground">
                          {dirtyMetrics.length > 0
                            ? `${dirtyMetrics.length} değişiklik bekliyor`
                            : 'Değişiklik yok'}
                        </span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={resetLimitDraft} disabled={dirtyMetrics.length === 0 || savingLimits}>
                            <RotateCcw className="size-4" />
                            Sıfırla
                          </Button>
                          <Button size="sm" onClick={() => setReviewing(true)} disabled={dirtyMetrics.length === 0 || savingLimits}>
                            <SlidersHorizontal className="size-4" />
                            Değişiklikleri Kontrol Et
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
