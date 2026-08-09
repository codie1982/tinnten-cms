'use client';

import { Suspense, use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Building2, MapPin, Phone, Share2, Landmark, Users, Package, Boxes,
  Globe, Mail, CalendarDays, Hash, BadgeCheck, ExternalLink, Gauge,
  SlidersHorizontal, Loader2, Ban, ShieldCheck, ChevronLeft, ChevronRight,
  Database, RefreshCw, UserCog, User, Search, Check, X, Plus, Pencil, Trash2,
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetCompanyQuery,
  useUpdateCompanyLimitsMutation,
  useUpdateCompanyUsageMutation,
  useResetCompanyUsageMutation,
  useSetCompanyAdminActiveMutation,
  useSetCompanyPocMutation,
  useTransferCompanyOwnerMutation,
  useAssignCompanyPackageMutation,
  useGetUsersQuery,
  useGetCmsProductsQuery,
  useUpdateCmsProductMutation,
  useDeleteCmsProductMutation,
  useGetFetcherSubscriptionsQuery,
  useGetCmsPackagesQuery,
} from '@/redux/services';
import { mutationMessage } from '../../products/_form/productFormModel';
import { statusMeta, companyTypeMeta, businessModeMeta } from '../_data';
import {
  typeMeta as productTypeMeta,
  statusMeta as productStatusMeta,
  pricetypeMeta as productPricetypeMeta,
  sortOptions as productSortOptions,
  formatPrice,
} from '../../products/_data';
import { AccountSummary, PackagesTable, LimitsPanel, UsagePanel } from '@/components/cms/account-panels';

/* ─── sol alt-menü ─── */
const SECTIONS = [
  { key: 'genel', label: 'Genel', icon: Building2 },
  { key: 'adresler', label: 'Adresler', icon: MapPin },
  { key: 'telefonlar', label: 'Telefonlar', icon: Phone },
  { key: 'sosyal', label: 'Sosyal Medya', icon: Share2 },
  { key: 'banka', label: 'Banka Hesapları', icon: Landmark },
  { key: 'calisanlar', label: 'Çalışanlar', icon: Users },
  { key: 'urunler', label: 'Ürünler / Hizmetler', icon: Boxes },
  { key: 'bilgi', label: 'Bilgi Tabanı', icon: Database },
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

/* ─── paket seçici için yardımcılar (paket ekleme paneli) ─── */
const PKG_INTERVAL_LABEL = { month: 'Aylık', year: 'Yıllık', lifetime: 'Ömür Boyu' };
const PKG_CATEGORY_BADGE = { free: 'muted', basic: 'primary', premium: 'secondary', enterprise: 'warning' };
function pkgTitle(p) {
  const i = p?.i18n || {};
  return i.tr?.title || i.en?.title || Object.values(i)[0]?.title || p?.name || '—';
}
function pkgPricingLabel(entry) {
  if (!entry) return 'Ücretsiz / süresiz';
  return `${PKG_INTERVAL_LABEL[entry.interval] || entry.interval}: ${entry.amount} ${entry.currency || ''}`.trim();
}

/* Bilgi tabanı (fetcher abonelik) durum → Türkçe etiket + rozet tonu. */
const KB_STATE = {
  live: { label: 'Aktif', variant: 'success' },
  paused: { label: 'Duraklatıldı', variant: 'muted' },
  backfilling: { label: 'İndeksleniyor', variant: 'warning' },
  indexing: { label: 'İndeksleniyor', variant: 'warning' },
  pending: { label: 'Beklemede', variant: 'warning' },
  removing: { label: 'Kaldırılıyor', variant: 'destructive' },
  removed: { label: 'Kaldırıldı', variant: 'destructive' },
};
const kbState = (s) => KB_STATE[s] || { label: s || '—', variant: 'muted' };

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

function CmsCompanyDetailView({ id }) {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  // Sekme URL'e bağlı: ?tab=urunler ile derin link verilebilsin ve oluşturma
  // sayfasından geri dönüşte doğru sekme açılsın. Bilinmeyen değer 'genel'e düşer.
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const section = SECTIONS.some((s) => s.key === tabParam)
    ? tabParam
    : 'genel';
  const setSection = (next) => {
    const query = new URLSearchParams(searchParams.toString());
    if (next === 'genel') query.delete('tab');
    else query.set('tab', next);
    const qs = query.toString();
    router.replace(`/cms/companies/${id}${qs ? `?${qs}` : ''}`, {
      scroll: false,
    });
  };

  const { data: company, isLoading, error } = useGetCompanyQuery(id, { skip: !authorized });
  const [updateLimits, { isLoading: savingLimits }] = useUpdateCompanyLimitsMutation();
  const [updateUsage, { isLoading: savingUsage }] = useUpdateCompanyUsageMutation();
  const [resetUsage, { isLoading: resettingUsage }] = useResetCompanyUsageMutation();
  const [setAdminActive, { isLoading: savingAdminActive }] = useSetCompanyAdminActiveMutation();
  const [setPoc, { isLoading: savingPoc }] = useSetCompanyPocMutation();
  const [transferOwner, { isLoading: transferring }] = useTransferCompanyOwnerMutation();
  const [assignPackage, { isLoading: assigningPackage }] = useAssignCompanyPackageMutation();

  // Ürünler / Hizmetler sekmesi — yalnız aktifken (lazy) çekilir; firma ucu değişmez.
  const [prodSort, setProdSort] = useState('createdAt:desc');
  const [prodPage, setProdPage] = useState(1);
  const [prodSortField, prodSortOrder] = prodSort.split(':');
  const {
    data: productsData,
    isLoading: productsLoading,
    isFetching: productsFetching,
    error: productsError,
  } = useGetCmsProductsQuery(
    { companyid: id, sort: prodSortField, order: prodSortOrder, page: prodPage, limit: 10 },
    { skip: !authorized || section !== 'urunler' },
  );
  const products = productsData?.items ?? [];
  const productsTotal = productsData?.total ?? 0;
  const productsTotalPages = productsData?.totalPages ?? 1;

  // Devre dışı bırakma (yumuşak silme).
  //
  // NEDEN KALICI SİLME DEĞİL: backend'deki deleteProduct yalnız ürün dokümanını
  // kaldırıyor — bağlı basePrice / gallery / images temizlenmiyor ve oluşturmada
  // artan kota sayacı hiçbir yerde azalmıyor. Yani hard delete yetim kayıt ve
  // kalıcı kota kaybı üretir. Kalıcı silme, cascade + kota iadesi ile birlikte
  // ayrı bir adımda gelecek.
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [productNotice, setProductNotice] = useState(null);
  const [updateCmsProduct, { isLoading: deactivating }] =
    useUpdateCmsProductMutation();

  // Kalıcı silme — geri alınamaz. Backend cascade ile bağlı basePrice/gallery/
  // images'ı temizler ve firmanın kota sayacını iade eder.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteCmsProduct, { isLoading: deletingProduct }] =
    useDeleteCmsProductMutation();
  const DELETE_CONFIRM_WORD = 'SİL';

  const closeDeactivate = () => {
    setDeactivateTarget(null);
    setDeactivateReason('');
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteConfirm('');
  };

  const handleDelete = async () => {
    try {
      const result = await deleteCmsProduct(deleteTarget.id).unwrap();
      const cleanup = result?.cleanup;
      const parts = [];
      if (cleanup?.prices) parts.push(`${cleanup.prices} fiyat planı`);
      if (cleanup?.images) parts.push(`${cleanup.images} görsel`);
      if (cleanup?.gallery) parts.push('galeri');
      if (cleanup?.usage && !cleanup.usage.skipped) parts.push('kota iadesi');

      setProductNotice({
        // Temizlik kısmen başarısızsa bunu başarı gibi göstermiyoruz.
        type: cleanup?.failures ? 'error' : 'success',
        text: cleanup?.failures
          ? `“${deleteTarget.title}” silindi ancak ${cleanup.failures} bağlı kayıt temizlenemedi — sunucu loglarına bakın.`
          : `“${deleteTarget.title}” kalıcı olarak silindi${
              parts.length ? ` (${parts.join(', ')} temizlendi)` : ''
            }.`,
      });
      closeDelete();
    } catch (err) {
      setProductNotice({
        type: 'error',
        text: mutationMessage(err, 'Kayıt silinemedi.'),
      });
    }
  };

  const handleDeactivate = async () => {
    const reason = deactivateReason.trim();
    if (!reason) {
      setProductNotice({
        type: 'error',
        text: 'Devre dışı bırakma nedeni zorunludur.',
      });
      return;
    }
    try {
      await updateCmsProduct({
        id: deactivateTarget.id,
        status: 'inactive',
        admin_aprove: false,
        reason,
        notifyOwner: true,
      }).unwrap();
      setProductNotice({
        type: 'success',
        text: `“${deactivateTarget.title}” devre dışı bırakıldı ve firma sahibine bildirildi.`,
      });
      closeDeactivate();
    } catch (err) {
      setProductNotice({
        type: 'error',
        text: mutationMessage(err, 'Kayıt devre dışı bırakılamadı.'),
      });
    }
  };

  // Bilgi Tabanı sekmesi — firmanın eklediği web siteleri (fetcher abonelikleri).
  // Yalnız sekme aktifken (lazy) çekilir; admin cross-company companyId ile listeler.
  const {
    data: kbData,
    isLoading: kbLoading,
    isFetching: kbFetching,
    error: kbError,
    refetch: kbRefetch,
  } = useGetFetcherSubscriptionsQuery(
    { companyId: id },
    { skip: !authorized || section !== 'bilgi' },
  );
  const knowledgeBase = kbData?.subscriptions ?? [];
  const knowledgeTotal = kbData?.total ?? knowledgeBase.length;

  // Engelleme state'i
  const [blockOpen, setBlockOpen] = useState(false); // gerekçe formu açık mı
  const [blockReason, setBlockReason] = useState('');
  const [blockNotice, setBlockNotice] = useState(null); // { type, text }

  // POC işareti state'i
  const [pocNotice, setPocNotice] = useState(null); // { type, text }

  // Sahiplik devri state'i
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerSearchDebounced, setOwnerSearchDebounced] = useState('');
  const [selectedNewOwner, setSelectedNewOwner] = useState(null); // { id, name, email }
  const [setAsActiveCompany, setSetAsActiveCompany] = useState(false);
  const [ownerNotice, setOwnerNotice] = useState(null); // { type, text }

  useEffect(() => {
    const t = setTimeout(() => setOwnerSearchDebounced(ownerSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [ownerSearch]);

  // Yeni sahip adayı arama — panel açık ve en az 2 karakter varken (lazy).
  const { data: ownerSearchData, isFetching: ownerSearching } = useGetUsersQuery(
    { query: ownerSearchDebounced || undefined, limit: 8 },
    { skip: !authorized || !ownerOpen || ownerSearchDebounced.length < 2 },
  );
  const ownerCandidates = ownerSearchData?.items ?? [];

  const resetOwnerForm = () => {
    setOwnerOpen(false);
    setSelectedNewOwner(null);
    setOwnerSearch('');
    setOwnerSearchDebounced('');
    setSetAsActiveCompany(false);
  };

  const handleTransferOwner = async () => {
    if (!selectedNewOwner?.id) {
      setOwnerNotice({ type: 'error', text: 'Lütfen yeni sahip için bir kullanıcı seçin.' });
      return;
    }
    try {
      await transferOwner({
        id,
        userId: selectedNewOwner.id,
        setActiveCompany: setAsActiveCompany,
      }).unwrap();
      setOwnerNotice({ type: 'success', text: 'Firma sahibi güncellendi.' });
      resetOwnerForm();
    } catch (e) {
      setOwnerNotice({ type: 'error', text: e?.data?.message || e?.normalizedMessage || 'Sahiplik devredilemedi.' });
    }
  };

  // Paket ekleme paneli — firmaya uygun (public + bu firmaya özel) paketleri listeler.
  const [pkgPanelOpen, setPkgPanelOpen] = useState(false);
  const [selectedPkgId, setSelectedPkgId] = useState(null);
  const [selectedPricingIdx, setSelectedPricingIdx] = useState(null);
  const [pkgNotice, setPkgNotice] = useState(null);

  const { data: eligiblePackages = [], isFetching: pkgFetching } = useGetCmsPackagesQuery(
    { status: 'active', forCompany: 'true', eligibleForCompanyId: id },
    { skip: !authorized || !pkgPanelOpen },
  );
  const selectedPkg = eligiblePackages.find((p) => p._id === selectedPkgId) || null;

  const resetPkgForm = () => {
    setPkgPanelOpen(false);
    setSelectedPkgId(null);
    setSelectedPricingIdx(null);
  };

  const handleAssignPackage = async () => {
    if (!selectedPkgId) {
      setPkgNotice({ type: 'error', text: 'Lütfen eklenecek bir paket seçin.' });
      return;
    }
    try {
      await assignPackage({
        id,
        packageId: selectedPkgId,
        ...(Number.isInteger(selectedPricingIdx) ? { pricingIndex: selectedPricingIdx } : {}),
      }).unwrap();
      setPkgNotice({ type: 'success', text: 'Paket firmaya eklendi.' });
      resetPkgForm();
    } catch (e) {
      setPkgNotice({ type: 'error', text: e?.data?.message || e?.normalizedMessage || 'Paket eklenemedi.' });
    }
  };

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
    urunler: productsTotal,
    bilgi: knowledgeTotal,
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
  const isPoc = company.poc === true;

  // ─── POC (demo/vitrin) işareti ───
  // Backend bayrağı firmanın asistanlarına da yayar (asistans.poc === company.poc).
  const handleTogglePoc = async (next) => {
    try {
      const res = await setPoc({ id, poc: next }).unwrap();
      setPocNotice({
        type: 'success',
        text: next
          ? `Firma POC olarak işaretlendi.${res?.assistantsUpdated ? ` ${res.assistantsUpdated} asistan güncellendi.` : ''}`
          : `POC işareti kaldırıldı.${res?.assistantsUpdated ? ` ${res.assistantsUpdated} asistan güncellendi.` : ''}`,
      });
    } catch (e) {
      setPocNotice({ type: 'error', text: e?.data?.message || 'POC işareti güncellenemedi.' });
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
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {s && <Badge variant={s.variant}>{s.label}</Badge>}
                {/* Her sekmede görünsün: POC firması müşteri raporlarına
                    karışmaması gereken demo kaydıdır. */}
                {isPoc && <Badge variant="warning">POC</Badge>}
              </div>
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
              <CardHeader>
                <CardTitle>Firma Sahibi</CardTitle>
                {!ownerOpen && (
                  <CardToolbar>
                    <Button size="sm" variant="outline" onClick={() => { setOwnerNotice(null); setOwnerOpen(true); }}>
                      <UserCog className="size-4" />
                      Sahibi Değiştir
                    </Button>
                  </CardToolbar>
                )}
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {ownerNotice && (
                  <Alert variant={ownerNotice.type === 'error' ? 'destructive' : 'info'}>
                    <AlertDescription>{ownerNotice.text}</AlertDescription>
                  </Alert>
                )}

                {/* Mevcut sahip */}
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <User className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{company.owner?.name || '—'}</p>
                    <p className="truncate text-xs text-muted-foreground">{company.owner?.email || 'Sahip bilgisi yok'}</p>
                  </div>
                </div>

                {/* Devir paneli */}
                {ownerOpen && (
                  <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                    <div>
                      <label className="text-xs font-medium text-foreground">Yeni sahip ara (ad veya e-posta)</label>
                      <div className="relative mt-1">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={ownerSearch}
                          onChange={(e) => { setOwnerSearch(e.target.value); setSelectedNewOwner(null); }}
                          placeholder="En az 2 karakter…"
                          className="pl-8"
                        />
                      </div>
                    </div>

                    {/* Sonuçlar */}
                    {ownerSearchDebounced.length >= 2 && (
                      <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                        {ownerSearching ? (
                          <div className="flex items-center justify-center py-6"><Loader2 className="size-5 animate-spin text-primary" /></div>
                        ) : ownerCandidates.length === 0 ? (
                          <p className="px-3 py-4 text-sm text-muted-foreground">Kullanıcı bulunamadı.</p>
                        ) : (
                          <div className="divide-y divide-border">
                            {ownerCandidates.map((u) => {
                              const isSelf = company.owner?.id && u.id === company.owner.id;
                              const selected = selectedNewOwner?.id === u.id;
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  disabled={isSelf}
                                  onClick={() => setSelectedNewOwner({ id: u.id, name: u.name, email: u.email })}
                                  className={cn(
                                    'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                                    selected ? 'bg-primary/10' : 'hover:bg-accent',
                                    isSelf && 'cursor-not-allowed opacity-50',
                                  )}
                                >
                                  <Avatar name={u.name || u.email || '?'} size="sm" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">{u.name || '—'}</p>
                                    <p className="truncate text-xs text-muted-foreground">{u.email || '—'}</p>
                                  </div>
                                  {isSelf ? (
                                    <Badge variant="muted">Mevcut sahip</Badge>
                                  ) : selected ? (
                                    <Check className="size-4 text-primary" />
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Seçili yeni sahip özeti */}
                    {selectedNewOwner && (
                      <div className="rounded-lg border border-border bg-background p-3 text-sm">
                        <p className="text-foreground">
                          Yeni sahip: <span className="font-medium">{selectedNewOwner.name || selectedNewOwner.email}</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Eski sahip firmadan çıkarılacak; firma yeni sahibin hesabında görünecek.
                        </p>
                      </div>
                    )}

                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={setAsActiveCompany}
                        onChange={(e) => setSetAsActiveCompany(e.target.checked)}
                        className="size-4 rounded border-input accent-primary"
                      />
                      Yeni sahibin aktif firması yap
                    </label>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleTransferOwner} disabled={transferring || !selectedNewOwner}>
                        {transferring ? <Loader2 className="size-4 animate-spin" /> : <UserCog className="size-4" />}
                        Devret
                      </Button>
                      <Button size="sm" variant="ghost" onClick={resetOwnerForm} disabled={transferring}>
                        <X className="size-4" />
                        Vazgeç
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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

                {/* POC işareti — demo/vitrin firmasını gerçek müşteriden ayıran
                    TEK kalıcı alan. Slug öneki ve ad ekleri müşteriye görünür
                    oldukları için kaldırıldı; bu yüzden buradan okunur/yazılır. */}
                <div className="sm:col-span-2 mt-2 space-y-2 rounded-lg border border-border p-3">
                  {pocNotice && (
                    <Alert variant={pocNotice.type === 'error' ? 'destructive' : 'info'}>
                      <AlertDescription>{pocNotice.text}</AlertDescription>
                    </Alert>
                  )}
                  <label className="flex items-start gap-2.5 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={isPoc}
                      disabled={savingPoc}
                      onChange={(e) => { setPocNotice(null); handleTogglePoc(e.target.checked); }}
                      className="mt-0.5 size-4 rounded border-input accent-primary disabled:opacity-50"
                    />
                    <span>
                      <span className="flex items-center gap-1.5 font-medium">
                        POC firması (demo / vitrin)
                        {savingPoc && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Gerçek müşteri firması değildir. İşaret, firmanın asistanlarına da yayılır.
                      </span>
                    </span>
                  </label>
                </div>
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
                <CardToolbar>
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">{packages.length} paket</Badge>
                    {!pkgPanelOpen && (
                      <Button size="sm" variant="outline" onClick={() => { setPkgNotice(null); setPkgPanelOpen(true); }}>
                        <Plus className="size-4" />
                        Paket Ekle
                      </Button>
                    )}
                  </div>
                </CardToolbar>
              </CardHeader>
              <CardContent className="space-y-5 p-4">
                {pkgNotice && (
                  <Alert variant={pkgNotice.type === 'error' ? 'destructive' : 'info'}>
                    <AlertDescription>{pkgNotice.text}</AlertDescription>
                  </Alert>
                )}

                <AccountSummary
                  accountId={company.account?._id ? String(company.account._id) : null}
                  balance={company.account?.balance}
                  packageCount={packages.length}
                />
                {!company.account?._id && (
                  <p className="text-xs text-muted-foreground">
                    Bu firmanın henüz hesabı yok — ilk paket eklendiğinde otomatik oluşturulacak.
                  </p>
                )}

                {/* Paket ekleme paneli — firmaya uygun (genel + bu firmaya özel) paketleri listeler */}
                {pkgPanelOpen && (
                  <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                    <p className="text-xs font-medium text-foreground">Firmaya uygun paketler</p>
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                      {pkgFetching ? (
                        <div className="flex items-center justify-center py-6"><Loader2 className="size-5 animate-spin text-primary" /></div>
                      ) : eligiblePackages.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-muted-foreground">Uygun paket bulunamadı.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {eligiblePackages.map((p) => {
                            const selected = selectedPkgId === p._id;
                            return (
                              <button
                                key={p._id}
                                type="button"
                                onClick={() => { setSelectedPkgId(p._id); setSelectedPricingIdx(null); }}
                                className={cn(
                                  'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                                  selected ? 'bg-primary/10' : 'hover:bg-accent',
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-sm font-medium text-foreground">{pkgTitle(p)}</span>
                                    {p.category && (
                                      <Badge variant={PKG_CATEGORY_BADGE[p.category] ?? 'muted'} className="capitalize">{p.category}</Badge>
                                    )}
                                    {p.visibility === 'private' && <Badge variant="warning">Firmaya Özel</Badge>}
                                  </div>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {Array.isArray(p.pricing) && p.pricing.length
                                      ? p.pricing.map((pr) => pkgPricingLabel(pr)).join(' · ')
                                      : 'Ücretsiz / süresiz'}
                                  </p>
                                </div>
                                {selected && <Check className="size-4 shrink-0 text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {selectedPkg && Array.isArray(selectedPkg.pricing) && selectedPkg.pricing.length > 1 && (
                      <div>
                        <label className="text-xs font-medium text-foreground">Fiyatlandırma dönemi</label>
                        <Select
                          value={selectedPricingIdx != null ? String(selectedPricingIdx) : undefined}
                          onValueChange={(v) => setSelectedPricingIdx(Number(v))}
                        >
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Varsayılan" /></SelectTrigger>
                          <SelectContent>
                            {selectedPkg.pricing.map((pr, i) => (
                              <SelectItem key={i} value={String(i)}>{pkgPricingLabel(pr)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedPkg && (
                      <div className="rounded-lg border border-border bg-background p-3 text-sm">
                        <p className="text-foreground">
                          Eklenecek paket: <span className="font-medium">{pkgTitle(selectedPkg)}</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Firmanın mevcut ücretli paketleri pasife alınacak (ücretsiz paket aktif kalır).
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAssignPackage} disabled={assigningPackage || !selectedPkgId}>
                        {assigningPackage ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                        Ekle
                      </Button>
                      <Button size="sm" variant="ghost" onClick={resetPkgForm} disabled={assigningPackage}>
                        <X className="size-4" />
                        Vazgeç
                      </Button>
                    </div>
                  </div>
                )}

                <div className="border-t border-border pt-4">
                  <PackagesTable packages={normalizedPackages} />
                </div>
              </CardContent>
            </Card>
          )}

          {section === 'urunler' && (
            <Card>
              <CardHeader>
                <CardTitle>Ürünler / Hizmetler</CardTitle>
                <CardToolbar>
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">{productsTotal} kayıt</Badge>
                    <div className="w-44">
                      <Select value={prodSort} onValueChange={(v) => { setProdSort(v); setProdPage(1); }}>
                        <SelectTrigger><SelectValue placeholder="Sırala" /></SelectTrigger>
                        <SelectContent>
                          {productSortOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Link
                      href={`/cms/products/new?companyId=${id}`}
                      className={buttonVariants({ size: 'sm' })}
                    >
                      <Plus className="size-4" />
                      Ürün / Hizmet Ekle
                    </Link>
                  </div>
                </CardToolbar>
              </CardHeader>
              <CardContent className="relative px-0 py-0">
                {productNotice && (
                  <div className="px-4 pt-4">
                    <Alert variant={productNotice.type === 'error' ? 'destructive' : 'info'}>
                      <AlertDescription>{productNotice.text}</AlertDescription>
                    </Alert>
                  </div>
                )}
                {productsFetching && !productsLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                    <Loader2 className="size-6 animate-spin text-primary" />
                  </div>
                )}
                {productsError ? (
                  <div className="p-4">
                    <Alert variant="destructive">
                      <AlertDescription>
                        {productsError?.data?.message || productsError?.normalizedMessage || 'Ürünler yüklenemedi.'}
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : productsLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="grid grid-cols-5 gap-4">
                        {Array.from({ length: 5 }).map((__, j) => <Skeleton key={j} className="h-5" />)}
                      </div>
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="p-4">
                    <EmptyCard icon={<Package className="size-5" />} message="Bu firmaya ait ürün/hizmet kaydı yok." />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ürün / Hizmet</TableHead>
                            <TableHead>Tür</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>Fiyat</TableHead>
                            <TableHead>Oluşturulma</TableHead>
                            <TableHead className="text-right">İşlem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((p) => {
                            const pt = productTypeMeta[p.type];
                            const ps = productStatusMeta[p.status];
                            const ppt = productPricetypeMeta[p.pricetype];
                            return (
                              <TableRow key={p.id}>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <Avatar name={p.title} src={p.coverImage || undefined} size="sm" />
                                    <div className="min-w-0">
                                      <Link href={`/cms/products/${p.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                                        {p.title}
                                      </Link>
                                      <p className="truncate font-mono text-xs text-muted-foreground">{p.sku}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>{pt ? <Badge variant={pt.variant}>{pt.label}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                                <TableCell><Badge variant={ps?.variant}>{ps?.label ?? p.status}</Badge></TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <span className="text-sm font-medium text-foreground">{formatPrice(p.priceAmount, p.currency)}</span>
                                  {ppt && <p className="text-xs text-muted-foreground">{ppt.label}</p>}
                                </TableCell>
                                <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTrDate(p.createdAt)}</TableCell>
                                <TableCell className="whitespace-nowrap text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Link
                                      href={`/cms/products/${p.id}`}
                                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                                      title="Düzenle"
                                    >
                                      <Pencil className="size-4" />
                                    </Link>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      title="Devre dışı bırak"
                                      disabled={p.status === 'inactive'}
                                      onClick={() => {
                                        setProductNotice(null);
                                        setDeactivateReason('');
                                        setDeactivateTarget(p);
                                      }}
                                    >
                                      <Ban className="size-4 text-destructive" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      title="Kalıcı olarak sil"
                                      onClick={() => {
                                        setProductNotice(null);
                                        setDeleteConfirm('');
                                        setDeleteTarget(p);
                                      }}
                                    >
                                      <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Sayfa <span className="font-medium text-foreground">{prodPage}</span> / {productsTotalPages}
                        {' · '}Toplam <span className="font-medium text-foreground">{productsTotal}</span> kayıt
                      </p>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" disabled={prodPage <= 1 || productsFetching} onClick={() => setProdPage((p) => Math.max(p - 1, 1))}>
                          <ChevronLeft className="size-4" />
                          Önceki
                        </Button>
                        <Button size="sm" variant="outline" disabled={prodPage >= productsTotalPages || productsFetching} onClick={() => setProdPage((p) => Math.min(p + 1, productsTotalPages))}>
                          Sonraki
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Dialog
            open={Boolean(deactivateTarget)}
            onOpenChange={(open) => {
              if (!open && !deactivating) closeDeactivate();
            }}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Devre Dışı Bırak</DialogTitle>
              </DialogHeader>
              <DialogBody className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {deactivateTarget?.title}
                  </span>{' '}
                  pasife alınacak ve admin onayı kaldırılacak. Kayıt silinmez —
                  public tarafta görünmez olur, firma sahibine bildirim gider.
                </p>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Neden (zorunlu)
                  </span>
                  <textarea
                    value={deactivateReason}
                    onChange={(e) => setDeactivateReason(e.target.value)}
                    rows={3}
                    disabled={deactivating}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                    placeholder="Firma sahibine iletilecek gerekçe…"
                  />
                </label>
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDeactivate}
                  disabled={deactivating}
                >
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeactivate}
                  disabled={deactivating || !deactivateReason.trim()}
                >
                  {deactivating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Ban className="size-4" />
                  )}
                  Devre dışı bırak
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={Boolean(deleteTarget)}
            onOpenChange={(open) => {
              if (!open && !deletingProduct) closeDelete();
            }}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Kalıcı Olarak Sil</DialogTitle>
              </DialogHeader>
              <DialogBody className="space-y-4">
                <Alert variant="destructive">
                  <AlertDescription>
                    <span className="font-medium">{deleteTarget?.title}</span> ve
                    ona bağlı fiyat planları, galeri ve görseller kalıcı olarak
                    silinecek. Bu işlem geri alınamaz. Firmanın ürün/hizmet
                    kotasından bir hak iade edilir.
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground">
                  Kaydı yalnızca gizlemek istiyorsanız bunun yerine{' '}
                  <span className="font-medium text-foreground">
                    devre dışı bırak
                  </span>{' '}
                  kullanın — kayıt korunur, public tarafta görünmez.
                </p>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Onaylamak için{' '}
                    <span className="font-mono font-semibold text-foreground">
                      {DELETE_CONFIRM_WORD}
                    </span>{' '}
                    yazın
                  </span>
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    disabled={deletingProduct}
                    autoComplete="off"
                  />
                </label>
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDelete}
                  disabled={deletingProduct}
                >
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={
                    deletingProduct ||
                    deleteConfirm.trim() !== DELETE_CONFIRM_WORD
                  }
                >
                  {deletingProduct ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Kalıcı olarak sil
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {section === 'bilgi' && (
            <Card>
              <CardHeader>
                <CardTitle>Bilgi Tabanı</CardTitle>
                <CardToolbar>
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">{knowledgeTotal} site</Badge>
                    <Button variant="ghost" size="icon" onClick={kbRefetch} disabled={kbFetching}>
                      <RefreshCw className={kbFetching ? 'size-4 animate-spin' : 'size-4'} />
                    </Button>
                  </div>
                </CardToolbar>
              </CardHeader>
              <CardContent className="relative px-0 py-0">
                {kbFetching && !kbLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                    <Loader2 className="size-6 animate-spin text-primary" />
                  </div>
                )}
                {kbError ? (
                  <div className="p-4">
                    <Alert variant="destructive">
                      <AlertDescription>
                        {kbError?.data?.message || 'Bilgi tabanı yüklenemedi. Fetcher servisine ulaşılamıyor olabilir.'}
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : kbLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="grid grid-cols-6 gap-4">
                        {Array.from({ length: 6 }).map((__, j) => <Skeleton key={j} className="h-5" />)}
                      </div>
                    ))}
                  </div>
                ) : knowledgeBase.length === 0 ? (
                  <div className="p-4">
                    <EmptyCard icon={<Database className="size-5" />} message="Bu firmanın eklediği bilgi tabanı (web sitesi) yok." />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Site</TableHead>
                          <TableHead>Durum</TableHead>
                          <TableHead>İndeks</TableHead>
                          <TableHead>Kapsam</TableHead>
                          <TableHead>Yeniden Tarama</TableHead>
                          <TableHead>Eklenme</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {knowledgeBase.map((w) => {
                          const st = kbState(w.state);
                          const chunks = w.embedding?.chunkCount;
                          const scope = w.contract?.scope;
                          const recrawl = w.contract?.recrawlIntervalDays;
                          return (
                            <TableRow key={w.id || w.domainName}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Globe className="size-4 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-foreground">{w.domainName || '—'}</span>
                                    {w.domainName && (
                                      <a href={`https://${w.domainName}`} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                        Aç <ExternalLink className="size-3" />
                                      </a>
                                    )}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {chunks != null && chunks > 0 ? (
                                  <span className="tabular-nums">{chunks.toLocaleString('tr-TR')} parça</span>
                                ) : w.embedding?.status ? (
                                  <Badge variant="muted">{w.embedding.status}</Badge>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {scope === 'single' ? 'Tek sayfa' : scope === 'domain' ? 'Tüm site' : (scope || '—')}
                              </TableCell>
                              <TableCell className="text-sm tabular-nums text-muted-foreground">
                                {recrawl != null ? `${recrawl} gün` : '—'}
                              </TableCell>
                              <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                                {formatTrDate(w.createdAt || w.updatedAt)}
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

/**
 * Sekme durumu ?tab= ile URL'de tutuluyor; useSearchParams bir Suspense
 * sınırı gerektirdiği için asıl görünüm ayrı bileşende.
 */
export default function CmsCompanyDetailPage({ params }) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <CmsCompanyDetailView id={id} />
    </Suspense>
  );
}
