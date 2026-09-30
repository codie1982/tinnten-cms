'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Save, Plus, Trash2, Loader2, ChevronLeft, Check, Eye, EyeOff, AlertTriangle, Ticket,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { CONTENT_LOCALES } from '@/config/api';
import {
  useGetCmsPackageQuery,
  useGetCreditConfigQuery,
  useCreatePackageMutation,
  useUpdatePackageMutation,
  useDeletePackageMutation,
  useAssignPrivatePackageMutation,
} from '@/redux/services';
import CompanySearchSelect from './CompanySearchSelect';
import PackageProfitAnalysis from './PackageProfitAnalysis';
import PackageCodesPage from '../codes/page';
import {
  buildLimitBody,
  bytesToGiBDisplay,
  cloneDefaultLimits,
  createDefaultStorageCostRates,
  decimalUnitToBytes,
  DEFAULT_LIMITS,
  DEFAULT_STORAGE_USD_PER_BYTE_MONTH,
  DEFAULT_STORAGE_USD_PER_GIB_MONTH,
  mergeLimits,
  normalizeNonNegativeDecimal,
  PAYMENT_PLAN_TYPES,
  resolvePaymentPlanType,
  usdPerByteMonthToUsdPerGiBMonth,
  usdPerGiBMonthToUsdPerByteMonth,
} from './quota-utils.mjs';

const CATEGORIES = ['free', 'basic', 'premium', 'enterprise'];
const CONTENT_TYPES = ['standart', 'multisubscribe', 'student'];
const STATUSES = [
  { value: 'active', label: 'Yayında' },
  { value: 'inactive', label: 'Pasif' },
  { value: 'archived', label: 'Arşivli' },
];
const INTERVALS = [
  { value: 'month', label: 'Aylık' },
  { value: 'year', label: 'Yıllık' },
  { value: 'lifetime', label: 'Ömür Boyu' },
];
const CURRENCIES = ['USD', 'TRY', 'EUR'];
const PAYMENT_PLAN_OPTIONS = [
  { value: PAYMENT_PLAN_TYPES.FIXED_TERM, label: 'Tek dönem — yenileme yok' },
  { value: PAYMENT_PLAN_TYPES.RECURRING, label: 'Otomatik yenilenen' },
  { value: PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING, label: 'Başlangıç fiyatlı abonelik' },
];
const MCP_PLAN_DEFAULTS = {
  free: { requestsPerMinute: 60, maxConcurrent: 4 },
  basic: { requestsPerMinute: 300, maxConcurrent: 10 },
  premium: { requestsPerMinute: 600, maxConcurrent: 20 },
  enterprise: { requestsPerMinute: 3000, maxConcurrent: 100 },
};
// NOT: `regeneretetime` alanı backend'den tamamen kaldırıldı. Reset artık
// fatura döngüsü (satın alınan periyot) tarafından yönlendiriliyor; her periyot
// (month/year) kendi limit objesini tutuyor ve döngü başına bir kez sıfırlanıyor.

const emptyI18n = () => {
  const o = {};
  for (const l of CONTENT_LOCALES) o[l.code] = { title: '', description: '', features: '' };
  return o;
};

// Unlisted ("özel/link ile") paketin paylaşım linki — storefront (tinnten-nextjs) /paket/[token]
// sayfasına gider. Base URL NEXT_PUBLIC_STOREFRONT_URL ile ayarlanır (fallback: prod domain).
const STOREFRONT_URL = (process.env.NEXT_PUBLIC_STOREFRONT_URL || 'https://tinnten.com').replace(/\/$/, '');
const shareUrl = (token) => `${STOREFRONT_URL}/paket/${token}`;

const emptyStorageCostRates = createDefaultStorageCostRates;

export default function PackageEditorPage({ params }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const { data: pkg, isLoading, error } = useGetCmsPackageQuery(id, { skip: isNew || !authorized });
  // Kredi maliyet tabanı backend'den (Cost.creditPerUsd) — kâr/zarar analizi hardcode etmez.
  const { data: creditConfig } = useGetCreditConfigQuery(undefined, { skip: !authorized });
  const [createPackage, { isLoading: creating }] = useCreatePackageMutation();
  const [updatePackage, { isLoading: updating }] = useUpdatePackageMutation();
  const [deletePackage, { isLoading: deleting }] = useDeletePackageMutation();
  const [assignPrivatePackage, { isLoading: assigning }] = useAssignPrivatePackageMutation();
  const saving = creating || updating;

  const [form, setForm] = useState({
    name: '',
    forCompany: false,
    category: 'free',
    package_content_type: 'standart',
    status: 'active',
    default_package: false,
    visibility: 'public',
    targetCompanyId: '',
    targetDescription: '',
  });
  const [i18n, setI18n] = useState(emptyI18n);
  const [pricing, setPricing] = useState([{
    interval: 'month', amount: '', currency: 'USD', isDefault: true, isRenewable: true,
    paymentPlanType: PAYMENT_PLAN_TYPES.RECURRING,
    durationTime: 1, discount: 0, localPrices: {}, introductoryAmount: '',
    introductoryBillingCycles: '', introductoryLocalPrices: {}, costRates: emptyStorageCostRates(),
  }]);
  // Limitler artık PERİYOT BAZLI: her fatura periyodu (month/year) kendi limit
  // objesini tutar. Satın alınan periyodun limiti kullanıcıya aktarılır; reset
  // fatura döngüsüne bağlı (periyot başına bir kez sıfırlanır).
  const [limitsByInterval, setLimitsByInterval] = useState(() => ({
    month: cloneDefaultLimits(),
    year: cloneDefaultLimits(),
  }));
  const [activeLimitInterval, setActiveLimitInterval] = useState('month');
  const [activeLocale, setActiveLocale] = useState('tr');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // "Bu pakete sahip herkese de uygula" — limit değişikliğini mevcut hesapların
  // account.packages[].limits snapshot'ına da taşır (backend migratePackageLimits).
  const [migrateToAccounts, setMigrateToAccounts] = useState(false);
  const [migrateIncludeExpired, setMigrateIncludeExpired] = useState(false);
  const [confirmMigrate, setConfirmMigrate] = useState(false);
  const [activeSection, setActiveSection] = useState('details');

  useEffect(() => {
    if (isNew) return;
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (requestedTab === 'codes') setActiveSection('codes');
  }, [isNew]);

  useEffect(() => {
    if (activeSection === 'codes' && (isNew || !pkg?.forCompany)) {
      setActiveSection('details');
    }
  }, [activeSection, isNew, pkg?.forCompany]);

  useEffect(() => {
    if (isNew || !pkg) return;
    setForm({
      name: pkg.name || '',
      forCompany: Boolean(pkg.forCompany),
      category: pkg.category || 'free',
      package_content_type: pkg.package_content_type || 'standart',
      status: pkg.status || 'active',
      default_package: Boolean(pkg.default_package),
      visibility: ['private', 'unlisted'].includes(pkg.visibility) ? pkg.visibility : 'public',
      targetCompanyId: pkg.targetCompanyId ? String(pkg.targetCompanyId) : '',
      targetDescription: pkg.targetDescription || '',
    });
    const merged = emptyI18n();
    for (const [loc, c] of Object.entries(pkg.i18n || {})) {
      merged[loc] = {
        title: c?.title || '',
        description: c?.description || '',
        features: Array.isArray(c?.features) ? c.features.map((f) => f?.item ?? f).filter(Boolean).join('\n') : '',
      };
    }
    setI18n(merged);
    const loadedPricing = (pkg.pricing?.length ? pkg.pricing : [{ interval: 'month', amount: '', currency: 'USD', isDefault: true }]);
    setPricing(
      loadedPricing.map((p) => {
        const row = {
          interval: p.interval || 'month',
          amount: p.amount ?? '',
          currency: p.currency || 'USD',
          isDefault: Boolean(p.isDefault),
          isRenewable: Boolean(p.isRenewable),
          durationTime: p.durationTime ?? 1,
          discount: p.discount ?? 0,
          localPrices: p.localPrices ?? {},
          introductoryAmount: p.introductoryPrice?.amount ?? '',
          introductoryBillingCycles: p.introductoryPrice?.billingCycles ?? '',
          introductoryLocalPrices: p.introductoryPrice?.localPrices ?? {},
          costRates: {
            storage: {
              usdPerByteMonth: normalizeNonNegativeDecimal(
                p.costRates?.storage?.usdPerByteMonth,
                DEFAULT_STORAGE_USD_PER_BYTE_MONTH,
              ),
            },
          },
        };
        return { ...row, paymentPlanType: resolvePaymentPlanType({ ...p, ...row }) };
      }),
    );
    // PERİYOT BAZLI limit yükleme: her pricing satırının kendi `.limit` objesi var.
    // Top-level `limit` (tekil) / eski kayıtlarda `limits` (çoğul), per-entry limiti
    // olmayan periyotlar için fallback. month & year anahtarları her zaman dolu olur.
    const topLevel = mergeLimits(pkg.limit ?? pkg.limits);
    const next = { month: topLevel, year: JSON.parse(JSON.stringify(topLevel)) };
    for (const p of loadedPricing) {
      const iv = p.interval || 'month';
      if ((iv === 'month' || iv === 'year') && p.limit) {
        next[iv] = mergeLimits(p.limit);
      }
    }
    setLimitsByInterval(next);
    // Aktif sekmeyi mevcut periyoda göre ayarla (month yoksa year'a düş).
    setActiveLimitInterval(
      loadedPricing.some((p) => (p.interval || 'month') === 'month') ? 'month' : 'year',
    );
  }, [pkg, isNew]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setLocaleField = (loc, k, v) => setI18n((s) => ({ ...s, [loc]: { ...s[loc], [k]: v } }));
  const setPriceRow = (i, k, v) => setPricing((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const setPriceInterval = (i, interval) => setPricing((rows) => rows.map((r, idx) => (
    idx === i
      ? {
          ...r,
          interval,
          isRenewable: interval !== 'lifetime',
          paymentPlanType:
            interval === 'lifetime'
              ? PAYMENT_PLAN_TYPES.NO_PAYMENT
              : interval === 'year'
                ? PAYMENT_PLAN_TYPES.RECURRING
                : resolvePaymentPlanType(r) === PAYMENT_PLAN_TYPES.NO_PAYMENT
                  ? PAYMENT_PLAN_TYPES.RECURRING
                  : resolvePaymentPlanType(r),
          ...(interval !== 'month'
            ? { introductoryAmount: '', introductoryBillingCycles: '', introductoryLocalPrices: {} }
            : {}),
        }
      : r
  )));
  const setPaymentPlanType = (i, paymentPlanType) => setPricing((rows) => rows.map((row, idx) => {
    if (idx !== i) return row;
    const isIntro = paymentPlanType === PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING;
    return {
      ...row,
      paymentPlanType,
      isRenewable:
        paymentPlanType === PAYMENT_PLAN_TYPES.RECURRING || isIntro,
      ...(!isIntro
        ? { introductoryAmount: '', introductoryBillingCycles: '', introductoryLocalPrices: {} }
        : {}),
    };
  }));
  const addPriceRow = () => setPricing((rows) => [...rows, {
    interval: 'year', amount: '', currency: 'USD', isDefault: false, isRenewable: true,
    paymentPlanType: PAYMENT_PLAN_TYPES.RECURRING,
    durationTime: 1, discount: 0, localPrices: {}, introductoryAmount: '',
    introductoryBillingCycles: '', introductoryLocalPrices: {}, costRates: emptyStorageCostRates(),
  }]);
  const removePriceRow = (i) => setPricing((rows) => rows.filter((_, idx) => idx !== i));

  // Nested limit alanlarını güncelleme: setLimitField('file', 'upload', 1024)
  // Yalnız AKTİF periyodun limit objesini immutably günceller.
  const setLimitField = (group, key, v) => {
    setLimitsByInterval((s) => {
      const cur = s[activeLimitInterval] || DEFAULT_LIMITS;
      return {
        ...s,
        [activeLimitInterval]: { ...cur, [group]: { ...(cur[group] || {}), [key]: v } },
      };
    });
  };
  const setLimitRoot = (key, v) => {
    setLimitsByInterval((s) => {
      const cur = s[activeLimitInterval] || DEFAULT_LIMITS;
      return { ...s, [activeLimitInterval]: { ...cur, [key]: v } };
    });
  };

  function buildBody() {
    // Sadece başlığı olan diller gönderilir
    const i18nOut = {};
    for (const [loc, c] of Object.entries(i18n)) {
      if (c.title?.trim()) {
        i18nOut[loc] = {
          title: c.title.trim(),
          description: c.description || '',
          features: (c.features || '').split('\n').map((s) => s.trim()).filter(Boolean),
        };
      }
    }
    const pricingOut = pricing
      .filter((p) => p.amount !== '' && p.amount != null)
      .map((p) => ({
        interval: p.interval,
        amount: Number(p.amount),
        currency: p.currency,
        isDefault: Boolean(p.isDefault),
        isRenewable: [
          PAYMENT_PLAN_TYPES.RECURRING,
          PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING,
        ].includes(resolvePaymentPlanType(p)),
        durationTime: Number(p.durationTime) || 1,
        discount: Math.min(100, Math.max(0, Number(p.discount) || 0)),
        localPrices: {
          TRY: p.localPrices?.TRY != null && p.localPrices?.TRY !== '' ? Number(p.localPrices.TRY) : null,
          EUR: p.localPrices?.EUR != null && p.localPrices?.EUR !== '' ? Number(p.localPrices.EUR) : null,
          USD: p.localPrices?.USD != null && p.localPrices?.USD !== '' ? Number(p.localPrices.USD) : null,
        },
        // Tarife limitten ayrıdır: byte başına aylık gerçek maliyet ondalık string
        // olarak saklanır; böylece çok küçük oranlar Number yuvarlamasına uğramaz.
        costRates: {
          storage: {
            usdPerByteMonth: normalizeNonNegativeDecimal(
              p.costRates?.storage?.usdPerByteMonth,
              DEFAULT_STORAGE_USD_PER_BYTE_MONTH,
            ),
          },
        },
        introductoryPrice:
          resolvePaymentPlanType(p) === PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING &&
          p.interval === 'month' && p.introductoryAmount !== '' && p.introductoryAmount != null
            ? {
                amount: Number(p.introductoryAmount),
                billingCycles: Number(p.introductoryBillingCycles),
                localPrices: {
                  TRY: p.introductoryLocalPrices?.TRY != null && p.introductoryLocalPrices?.TRY !== '' ? Number(p.introductoryLocalPrices.TRY) : null,
                  EUR: p.introductoryLocalPrices?.EUR != null && p.introductoryLocalPrices?.EUR !== '' ? Number(p.introductoryLocalPrices.EUR) : null,
                  USD: p.introductoryLocalPrices?.USD != null && p.introductoryLocalPrices?.USD !== '' ? Number(p.introductoryLocalPrices.USD) : null,
                },
              }
            : null,
        // PERİYOT BAZLI limit: month/year satırları kendi limit objesini taşır;
        // lifetime satırının limiti yok (reset fatura döngüsüne bağlı, ömür boyunun
        // döngüsü yok).
        limit:
          p.interval === 'month' || p.interval === 'year'
            ? buildLimitBody(limitsByInterval[p.interval])
            : null,
      }));
    return {
      name: form.name.trim(),
      forCompany: form.forCompany,
      category: form.category,
      package_content_type: form.package_content_type,
      status: form.status,
      default_package: form.default_package,
      i18n: i18nOut,
      pricing: pricingOut,
      // Top-level `limit` fallback — backend'i top-level'ı pricing'den türetiyor
      // ama geriye dönük uyum için month (yoksa year) limitini yine de gönderiyoruz.
      limit: buildLimitBody(limitsByInterval.month || limitsByInterval.year),
      // Görünürlük alanları — backend create/update whitelist'inde normalize edilir.
      // unlisted → backend shareToken üretir; targetCompanyId yalnız private'te.
      visibility: ['private', 'unlisted'].includes(form.visibility) ? form.visibility : 'public',
      targetCompanyId: form.visibility === 'private' && form.targetCompanyId ? form.targetCompanyId : null,
      targetDescription: (form.targetDescription || '').trim(),
    };
  }

  async function handleSave({ migrate = false } = {}) {
    setNotice('');
    const body = buildBody();
    if (!body.name) { setNotice('Paket adı (name) zorunludur.'); return; }
    if (!Object.keys(body.i18n).length) { setNotice('En az bir dilde başlık girin.'); return; }
    // Periyot bazlı limit modeli: her periyottan en fazla bir satır olmalı ki
    // hangi limit objesinin geçerli olduğu belirsiz kalmasın.
    const pricedRows = pricing.filter((p) => p.amount !== '' && p.amount != null);
    if (pricedRows.filter((p) => p.interval === 'month').length > 1) {
      setNotice('Birden fazla aylık (month) fiyat satırı olamaz.'); return;
    }
    if (pricedRows.filter((p) => p.interval === 'year').length > 1) {
      setNotice('Birden fazla yıllık (year) fiyat satırı olamaz.'); return;
    }
    if (pricedRows.filter((p) => p.isDefault).length > 1) {
      setNotice('Yalnız bir fiyat satırı varsayılan (isDefault) olabilir.'); return;
    }
    if (pricedRows.some((p) => p.interval === 'lifetime' && Number(p.amount) > 0)) {
      setNotice('Ömür boyu paket ücretli olamaz.'); return;
    }
    const invalidIntroInterval = pricedRows.find(
      (p) => resolvePaymentPlanType(p) === PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING && p.interval !== 'month',
    );
    if (invalidIntroInterval) {
      setNotice('Başlangıç fiyatlı ödeme planı yalnız aylık paketlerde kullanılabilir.'); return;
    }
    const invalidIntroAmount = pricedRows.find(
      (p) => resolvePaymentPlanType(p) === PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING && (
        p.introductoryAmount === '' ||
        p.introductoryAmount == null ||
        Number(p.introductoryAmount) <= 0 ||
        Number(p.introductoryAmount) >= Number(p.amount) * (1 - (Number(p.discount) || 0) / 100)
      ),
    );
    if (invalidIntroAmount) {
      setNotice('Başlangıç fiyatı sıfırdan büyük ve indirim sonrası standart fiyattan düşük olmalıdır.'); return;
    }
    const invalidIntroCycles = pricedRows.find((p) => {
      if (resolvePaymentPlanType(p) !== PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING) return false;
      const cycles = Number(p.introductoryBillingCycles);
      return !Number.isInteger(cycles) || cycles < 1 || cycles > 36;
    });
    if (invalidIntroCycles) {
      setNotice('Başlangıç fazı 1 ile 36 ay arasında tam sayı olmalıdır.'); return;
    }
    if (isNew) {
      const r = await createPackage(body).unwrap().catch((e) => { setNotice(e?.data?.message || 'Oluşturulamadı.'); return null; });
      const newId = r?._id ?? r?.id;
      if (newId) router.push(`/cms/settings/packages/${newId}`);
      else if (r) router.push('/cms/settings/packages');
    } else {
      // migrate seçiliyse backend'e bayrağı gönder; migration yalnız apply:true çalışır.
      const payload = migrate
        ? { id, ...body, migrateToAccounts: true, migrateIncludeExpired }
        : { id, ...body };
      const r = await updatePackage(payload).unwrap().catch((e) => { setNotice(e?.data?.message || 'Güncellenemedi.'); return null; });
      if (r) {
        const m = r?.migration;
        if (m) {
          setNotice(
            `Paket kaydedildi. Limit migrasyonu uygulandı — ${m.changedAccounts} hesap, ` +
            `${m.changedPackages} paket kaydı güncellendi (taranan: ${m.scannedAccounts}` +
            `${m.includeExpired ? ', süresi dolmuşlar dahil' : ''}).`,
          );
          // Yanlışlıkla tekrar migrasyonu önle — bir sonraki kaydetme yine şablonu
          // günceller ama kutular kasıtlı olarak sıfırlanır.
          setMigrateToAccounts(false);
          setMigrateIncludeExpired(false);
        } else {
          setNotice('Paket kaydedildi.');
        }
      }
    }
  }

  // Kaydet: migrate seçiliyse önce onay diyaloğu (geniş etkili işlem), yoksa direkt kaydet.
  function handleSaveClick() {
    if (!isNew && migrateToAccounts) setConfirmMigrate(true);
    else handleSave();
  }

  // Status toggle — list sayfasındaki togglePublish davranışıyla birebir
  async function handleToggleStatus() {
    if (isNew) return;
    setNotice('');
    const next = form.status === 'active' ? 'inactive' : 'active';
    const r = await updatePackage({ id, status: next })
      .unwrap()
      .catch((e) => {
        setNotice(e?.data?.message || 'Durum güncellenemedi.');
        return null;
      });
    if (r) {
      setField('status', next);
      setNotice(next === 'active' ? 'Paket yayına alındı.' : 'Paket pasifleştirildi.');
    }
  }

  async function handleDelete() {
    if (isNew) return;
    setNotice('');
    const r = await deletePackage(id)
      .unwrap()
      .catch((e) => {
        setNotice(e?.data?.message || 'Silinemedi.');
        return null;
      });
    if (r !== null) {
      setConfirmDelete(false);
      router.push('/cms/settings/packages');
    }
  }

  async function handleAssignToCompany() {
    if (isNew || form.visibility !== 'private' || !form.targetCompanyId) return;
    setNotice('');
    const r = await assignPrivatePackage({ id, companyId: form.targetCompanyId })
      .unwrap()
      .catch((e) => {
        setNotice(e?.data?.message || 'Şirkete atama başarısız.');
        return null;
      });
    if (r) setNotice('Paket şirkete atandı.');
  }

  function handleSectionChange(value) {
    setActiveSection(value);
    if (!isNew) {
      router.replace(
        `/cms/settings/packages/${id}${value === 'codes' ? '?tab=codes' : ''}`,
        { scroll: false },
      );
    }
  }

  if (!isNew && isLoading) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
        <PageHeader breadcrumb={[{ label: 'Paketler', href: '/cms/settings/packages' }, { label: '…' }]} title="Yükleniyor…" />
        <Skeleton className="h-96 w-full" />
      </RoleGuard>
    );
  }
  if (!isNew && (error || !pkg)) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
        <PageHeader breadcrumb={[{ label: 'Paketler', href: '/cms/settings/packages' }, { label: 'Bulunamadı' }]} title="Paket Bulunamadı" />
        <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">
          {error ? (error?.data?.message || 'Yükleme hatası.') : 'Paket bulunamadı.'}{' '}
          <Link href="/cms/settings/packages" className="text-primary hover:underline">Listeye dön</Link>
        </CardContent></Card>
      </RoleGuard>
    );
  }

  const lc = i18n[activeLocale] || { title: '', description: '', features: '' };

  // Aktif periyodun limit objesi — ekrandaki stok ve dönemsel limitler bunu okur.
  const limits = limitsByInterval[activeLimitInterval] || limitsByInterval.month;
  // Limit sekmesi için mevcut pricing'deki month/year periyotları (lifetime hariç,
  // tekrarsız ve month/year sırasında).
  const limitIntervals = ['month', 'year'].filter((iv) =>
    pricing.some((p) => p.interval === iv),
  );

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        breadcrumb={[{ label: 'Paketler', href: '/cms/settings/packages' }, { label: isNew ? 'Yeni' : form.name || 'Düzenle' }]}
        title={isNew ? 'Yeni Paket' : form.name || 'Paketi Düzenle'}
        actions={activeSection === 'details' ? (
          <div className="flex flex-wrap items-center gap-2">
            {!isNew && (
              <>
                <Button
                  variant="outline"
                  onClick={handleToggleStatus}
                  disabled={updating || deleting}
                  title={form.status === 'active' ? 'Yayından kaldır' : 'Yayına al'}
                >
                  {form.status === 'active' ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  {form.status === 'active' ? 'Pasif Yap' : 'Aktif Et'}
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleting}
                >
                  <Trash2 className="size-4" />
                  Sil
                </Button>
              </>
            )}
            <Button onClick={handleSaveClick} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Kaydet
            </Button>
          </div>
        ) : null}
      />

      <Tabs value={activeSection} onValueChange={handleSectionChange}>
        <TabsList className="mb-5">
          <TabsTrigger value="details">Paket Ayarları</TabsTrigger>
          {!isNew && pkg?.forCompany && (
            <TabsTrigger value="codes">
              <span className="inline-flex items-center gap-2"><Ticket className="size-4" /> Paket Kodları</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details">
          {notice && <Alert variant="info" className="mb-4"><AlertDescription>{notice}</AlertDescription></Alert>}

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Çok dilli içerik */}
          <Card>
            <CardHeader>
              <CardTitle>İçerik (Çok Dilli)</CardTitle>
              <CardToolbar>
                <Badge variant="muted">{Object.values(i18n).filter((c) => c.title?.trim()).length}/{CONTENT_LOCALES.length} dil</Badge>
              </CardToolbar>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap gap-1">
                {CONTENT_LOCALES.map((l) => {
                  const filled = i18n[l.code]?.title?.trim();
                  const active = activeLocale === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setActiveLocale(l.code)}
                      className={cn(
                        'flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                      title={l.name}
                    >
                      <span className="uppercase">{l.code}</span>
                      {filled && <Check className={cn('size-3', active ? 'text-primary-foreground' : 'text-green-600')} />}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Başlık ({activeLocale.toUpperCase()})</label>
                <Input value={lc.title} onChange={(e) => setLocaleField(activeLocale, 'title', e.target.value)} placeholder="Paket başlığı" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Açıklama</label>
                <textarea
                  value={lc.description}
                  onChange={(e) => setLocaleField(activeLocale, 'description', e.target.value)}
                  rows={3}
                  placeholder="Kısa açıklama (maks. 500)"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Özellikler (her satır bir madde)</label>
                <textarea
                  value={lc.features}
                  onChange={(e) => setLocaleField(activeLocale, 'features', e.target.value)}
                  rows={5}
                  placeholder={'Sınırsız ürün\n10 GB depolama\nÖncelikli destek'}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-y"
                />
              </div>
            </CardContent>
          </Card>

          {/* Fiyatlandırma */}
          <Card>
            <CardHeader>
              <CardTitle>Fiyatlandırma</CardTitle>
              <CardToolbar>
                <Button size="sm" variant="outline" onClick={addPriceRow}><Plus className="size-4" /> Fiyat Ekle</Button>
              </CardToolbar>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {pricing.length === 0 && <p className="text-sm text-muted-foreground">Henüz fiyat eklenmedi.</p>}
              {pricing.map((p, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
                  <div className="w-32">
                    <label className="mb-1 block text-[11px] text-muted-foreground">Periyot</label>
                    <Select value={p.interval} onValueChange={(v) => setPriceInterval(i, v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INTERVALS.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28">
                    <label className="mb-1 block text-[11px] text-muted-foreground">Normal fiyat</label>
                    <Input type="number" value={p.amount} onChange={(e) => setPriceRow(i, 'amount', e.target.value)} placeholder="0" />
                  </div>
                  <div className="w-24">
                    <label className="mb-1 block text-[11px] text-muted-foreground">Para Birimi</label>
                    <Select value={p.currency} onValueChange={(v) => setPriceRow(i, 'currency', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-56">
                    <label className="mb-1 block text-[11px] text-muted-foreground">Ödeme planı</label>
                    <Select
                      value={resolvePaymentPlanType(p)}
                      onValueChange={(value) => setPaymentPlanType(i, value)}
                      disabled={p.interval === 'lifetime'}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(p.interval === 'year'
                          ? PAYMENT_PLAN_OPTIONS.filter((option) => option.value === PAYMENT_PLAN_TYPES.RECURRING)
                          : p.interval === 'lifetime'
                            ? [{ value: PAYMENT_PLAN_TYPES.NO_PAYMENT, label: 'Ücretsiz — ödeme yok' }]
                            : PAYMENT_PLAN_OPTIONS
                        ).map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {resolvePaymentPlanType(p) === PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING && (
                    <>
                      <div className="w-32">
                        <label className="mb-1 block text-[11px] text-muted-foreground">Başlangıç fiyatı</label>
                        <Input
                          type="number"
                          min="0.01"
                          value={p.introductoryAmount ?? ''}
                          onChange={(e) => setPriceRow(i, 'introductoryAmount', e.target.value)}
                          placeholder="Örn. 1"
                        />
                      </div>
                      <div className="w-28">
                        <label className="mb-1 block text-[11px] text-muted-foreground">İlk kaç ay</label>
                        <Input
                          type="number"
                          min="1"
                          max="36"
                          step="1"
                          value={p.introductoryBillingCycles ?? ''}
                          onChange={(e) => setPriceRow(i, 'introductoryBillingCycles', e.target.value)}
                          placeholder="Örn. 3"
                        />
                      </div>
                    </>
                  )}
                  <div className="w-24">
                    <label className="mb-1 block text-[11px] text-muted-foreground">İndirim %</label>
                    <Input type="number" min="0" max="100" value={p.discount ?? 0} onChange={(e) => setPriceRow(i, 'discount', e.target.value)} placeholder="0" />
                  </div>
                  <div className="w-32">
                    <label className="mb-1 block text-[11px] text-muted-foreground">Kota yenileme</label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={p.durationTime ?? 1}
                      onChange={(e) => setPriceRow(i, 'durationTime', e.target.value)}
                      placeholder="1"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Her {p.durationTime || 1} {p.interval === 'year' ? 'yıl' : p.interval === 'lifetime' ? 'dönem' : 'ay'}
                    </p>
                  </div>
                  <StorageRateInput
                    valuePerByte={p.costRates?.storage?.usdPerByteMonth}
                    onChange={(usdPerByteMonth) => setPriceRow(i, 'costRates', {
                      ...(p.costRates || {}),
                      storage: {
                        ...(p.costRates?.storage || {}),
                        usdPerByteMonth,
                      },
                    })}
                  />
                  {p.currency !== 'USD' && (
                    <>
                      <div className="w-24">
                        <label className="mb-1 block text-[11px] text-muted-foreground">USD karşılığı</label>
                        <Input
                          type="number" min="0" placeholder="0"
                          value={p.localPrices?.USD ?? ''}
                          onChange={(e) => setPriceRow(i, 'localPrices', { ...(p.localPrices || {}), USD: e.target.value })}
                        />
                      </div>
                      {resolvePaymentPlanType(p) === PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING && (
                        <div className="w-28">
                          <label className="mb-1 block text-[11px] text-muted-foreground">Başlangıç USD</label>
                          <Input
                            type="number" min="0" placeholder="0"
                            value={p.introductoryLocalPrices?.USD ?? ''}
                            onChange={(e) => setPriceRow(i, 'introductoryLocalPrices', { ...(p.introductoryLocalPrices || {}), USD: e.target.value })}
                          />
                        </div>
                      )}
                    </>
                  )}
                  <label className="flex items-center gap-1.5 pb-2 text-xs text-foreground">
                    <input type="checkbox" checked={p.isDefault} onChange={(e) => setPriceRow(i, 'isDefault', e.target.checked)} className="size-4" />
                    Varsayılan
                  </label>
                  <Button variant="ghost" size="icon" className="size-8 hover:text-destructive" onClick={() => removePriceRow(i)}>
                    <Trash2 className="size-4" />
                  </Button>
                  <PaymentPlanSummary pricing={p} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Kâr / Zarar Analizi — kredi maliyet tabanı ($0.01/kredi) üzerinden canlı.
              Her satır kendi periyodunun (limitsByInterval[interval]) kredisini kullanır. */}
          <PackageProfitAnalysis
            pricing={pricing}
            limitsByInterval={limitsByInterval}
            credits={limits.llm?.credit}
            creditUsdCost={creditConfig?.creditUsdCost}
          />

          {/* Limitler */}
          <Card>
            <CardHeader>
              <CardTitle>Limitler</CardTitle>
              <CardToolbar>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setLimitsByInterval((s) => ({
                      ...s,
                      [activeLimitInterval]: cloneDefaultLimits(),
                    }))
                  }
                  title="Bu periyodun limitlerini varsayılana sıfırla"
                >
                  Varsayılana sıfırla
                </Button>
              </CardToolbar>
            </CardHeader>
            <CardContent className="space-y-5 p-4">
              {/* Periyot sekmesi — her fatura periyodu (month/year) için ayrı limit seti */}
              {limitIntervals.length > 0 && (
                <div>
                  <div className="flex flex-wrap gap-1">
                    {limitIntervals.map((iv) => {
                      const active = activeLimitInterval === iv;
                      return (
                        <button
                          key={iv}
                          type="button"
                          onClick={() => setActiveLimitInterval(iv)}
                          className={cn(
                            'flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                            active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          {INTERVALS.find((x) => x.value === iv)?.label || iv}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Her periyot için ayrı limitler; satın alınan periyodun limiti kullanıcıya aktarılır.
                  </p>
                </div>
              )}

              {/* Genel sayım limitleri */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Genel</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <LimitRow label="Ürün adedi" value={limits.product?.amount} unit="adet" onChange={(v) => setLimitField('product', 'amount', v)} />
                  <LimitRow label="Servis adedi" value={limits.services?.amount} unit="adet" onChange={(v) => setLimitField('services', 'amount', v)} />
                  <LimitRow
                    label="Maks. cihaz"
                    value={limits.maxDevices ?? ''}
                    unit="cihaz"
                    placeholder="sınırsız"
                    onChange={(v) => setLimitRoot('maxDevices', v === '' ? null : v)}
                    helper="boş bırakılırsa sınırsız"
                  />
                </div>
              </div>

              {/* Birleşik depolama: tüm müşteri dosyaları aynı byte stok kotasını tüketir. */}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Depolama Kotası</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Dosya, görsel ve video aynı toplam kotayı kullanır. Arayüz GB gösterir; API&apos;ye tam sayı byte kaydedilir.
                    Boş alan sınırsız, 0 ise yüklemeye kapalıdır. Aylık stream/download kotası uygulanmaz.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ByteLimitRow
                    label="Toplam depolama"
                    valueBytes={limits.storage?.maxBytes}
                    onChange={(v) => setLimitField('storage', 'maxBytes', v)}
                    helper="Paketin tüm müşteri dosyaları için ortak stok kapasitesi"
                  />
                  <ByteLimitRow
                    label="Tek dosya yükleme (maks.)"
                    valueBytes={limits.uploads?.fileMaxBytes}
                    onChange={(v) => setLimitField('uploads', 'fileMaxBytes', v)}
                  />
                  <ByteLimitRow
                    label="Tek görsel yükleme (maks.)"
                    valueBytes={limits.uploads?.imageMaxBytes}
                    onChange={(v) => setLimitField('uploads', 'imageMaxBytes', v)}
                  />
                  <ByteLimitRow
                    label="Tek video yükleme (maks.)"
                    valueBytes={limits.uploads?.videoMaxBytes}
                    onChange={(v) => setLimitField('uploads', 'videoMaxBytes', v)}
                  />
                </div>
              </div>

              {/* Teklif limiti */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teklif</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <LimitRow
                    label="Maks. teklif"
                    value={limits.offer?.max}
                    unit="adet"
                    onChange={(v) => setLimitField('offer', 'max', v)}
                  />
                </div>
              </div>

              {/* LLM kredi limiti (kota kredi bazlı; token analitik alanı korunur) */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">LLM</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <LimitRow
                    label="Kredi"
                    value={limits.llm?.credit}
                    unit="kredi"
                    onChange={(v) => setLimitField('llm', 'credit', v)}
                    helper="Satın alınan periyodun kredisi; fatura döngüsü başına sıfırlanır"
                  />
                </div>
              </div>

              {/* AI Üretim limitleri KALDIRILDI: görsel/enrich/video artık ayrı adet kotasıyla
                  değil LLM kredi bütçesiyle sınırlanır (her üretim krediden düşer). Ayrı limit alanı yok. */}

              {/* Workflow limitleri */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflow</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <LimitRow
                    label="Workflow adedi"
                    value={limits.workflow?.count}
                    unit="adet"
                    onChange={(v) => setLimitField('workflow', 'count', v)}
                    helper="Kullanıcının oluşturabileceği toplam workflow sayısı"
                  />
                  <LimitRow
                    label="Toplam çalıştırma"
                    value={limits.workflow?.totalRun}
                    unit="run"
                    onChange={(v) => setLimitField('workflow', 'totalRun', v)}
                    helper="Tüm workflow'ların toplam çalışma hakkı"
                  />
                </div>
              </div>

              {form.forCompany && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ekip & Bilgi Tabanı</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Bu stok limitleri fatura döneminde sıfırlanmaz; hesapta o anda bulunan aktif kaynakları sınırlar.
                      Boş = sınırsız, 0 = kapalı.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <LimitRow
                      label="Ekip koltuğu"
                      value={limits.team?.seats}
                      unit="kişi"
                      onChange={(v) => setLimitField('team', 'seats', v === '' ? null : v)}
                      placeholder="sınırsız"
                      helper="Firma sahibi, aktif üyeler ve bekleyen davetler birlikte sayılır"
                    />
                    <LimitRow
                      label="Domain limiti"
                      value={limits.website?.count}
                      unit="domain"
                      onChange={(v) => setLimitField('website', 'count', v === '' ? null : v)}
                      placeholder="sınırsız"
                    />
                    <LimitRow
                      label="Taranan aktif sayfa"
                      value={limits.crawl?.pages}
                      unit="sayfa"
                      onChange={(v) => setLimitField('crawl', 'pages', v === '' ? null : v)}
                      placeholder="sınırsız"
                      helper="Firma toplamındaki aktif crawl sayfası"
                    />
                    <LimitRow
                      label="İndeks dokümanı"
                      value={limits.index?.documents}
                      unit="doküman"
                      onChange={(v) => setLimitField('index', 'documents', v === '' ? null : v)}
                      placeholder="sınırsız"
                    />
                    <ByteLimitRow
                      label="İndeks büyüklüğü"
                      valueBytes={limits.index?.vectorBytes}
                      onChange={(v) => setLimitField('index', 'vectorBytes', v)}
                      helper="Aktif vektörlerin mantıksal byte toplamı"
                    />
                  </div>
                </div>
              )}

              {/* Hosted MCP limitleri — yalnız Business paketlerinde anlamlıdır. */}
              {form.forCompany && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">MCP Server</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      İstek ve eşzamanlılık alanlarını boş bırakırsanız <strong className="capitalize">{form.category}</strong>{' '}
                      planı varsayılanı kullanılır: {MCP_PLAN_DEFAULTS[form.category]?.requestsPerMinute ?? 60}/dk ve{' '}
                      {MCP_PLAN_DEFAULTS[form.category]?.maxConcurrent ?? 4} eşzamanlı istek.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <LimitRow
                      label="Server adedi"
                      value={limits.mcp?.server}
                      unit="server"
                      onChange={(v) => setLimitField('mcp', 'server', v)}
                      helper="Firma başına oluşturulabilecek MCP server sayısı · boş = sınırsız · 0 = kota yok"
                    />
                    <LimitRow
                      label="İstek / dakika override"
                      value={limits.mcp?.requestsPerMinute}
                      unit="istek/dk"
                      min={1}
                      max={100000}
                      placeholder={String(MCP_PLAN_DEFAULTS[form.category]?.requestsPerMinute ?? 60)}
                      onChange={(v) => setLimitField('mcp', 'requestsPerMinute', v === '' ? null : v)}
                      helper="Boş bırakılırsa paket kategorisinin varsayılanı uygulanır"
                    />
                    <LimitRow
                      label="Eşzamanlı istek override"
                      value={limits.mcp?.maxConcurrent}
                      unit="istek"
                      min={1}
                      max={1000}
                      placeholder={String(MCP_PLAN_DEFAULTS[form.category]?.maxConcurrent ?? 4)}
                      onChange={(v) => setLimitField('mcp', 'maxConcurrent', v === '' ? null : v)}
                      helper="Boş bırakılırsa paket kategorisinin varsayılanı uygulanır"
                    />
                  </div>
                </div>
              )}

              {/* Asistan limitleri */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Asistan</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <LimitRow
                    label="Yayında asistan limiti"
                    value={limits.assistant?.published}
                    unit="adet"
                    onChange={(v) => setLimitField('assistant', 'published', v)}
                    placeholder="sınırsız"
                    helper="Aynı anda yayında (published) olabilecek asistan sayısı — asistan yayınlama kotası bunu uygular · boş = sınırsız · 0 = kota yok"
                  />
                  <LimitRow
                    label="Bilgi tabanı dosya limiti"
                    value={limits.assistant?.libraryFiles}
                    unit="dosya"
                    onChange={(v) => setLimitField('assistant', 'libraryFiles', v)}
                    placeholder="sınırsız"
                    helper="Bir asistanın bilgi tabanına (library + file) eklenebilecek max dosya · boş = sınırsız · 0 = kota yok"
                  />
                </div>
              </div>

              {/* Web Arama limitleri KALDIRILDI: her web araması LLM kredi bütçesinden düşülür
                  (ayrı adet kotası yok; AI üretimiyle aynı model). */}

              {/* Firma limitleri — yalnız Kullanıcı Paketi (forCompany:false).
                  Business paketlerde firma oluşturma limiti kavramı yok. */}
              {!form.forCompany && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Firma</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <LimitRow
                      label="Firma oluşturma limiti"
                      value={limits.company?.count}
                      unit="firma"
                      onChange={(v) => setLimitField('company', 'count', v)}
                      placeholder="sınırsız"
                      helper="Kullanıcının oluşturabileceği toplam firma sayısı · boş = sınırsız · 0 = kota yok"
                    />
                  </div>
                </div>
              )}

              {/* Mevcut hesaplara migrasyon — yalnız kayıtlı paket için anlamlı.
                  Varsayılan davranış: limit düzenlemesi yalnız ŞABLONU günceller,
                  mevcut satın almaların account snapshot'ı DONMUŞ kalır. Bu seçenek
                  kaydederken snapshot'ları yeni limitlerle eşitler. */}
              {!isNew && (
                <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={migrateToAccounts}
                      onChange={(e) => setMigrateToAccounts(e.target.checked)}
                      className="mt-0.5 size-4 shrink-0"
                    />
                    <span>
                      <span className="font-medium">Bu pakete sahip tüm hesaplara da uygula</span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                        Normalde limit değişikliği yalnız paket şablonunu günceller; mevcut kullanıcıların
                        hesabına aktarılmış (donmuş) limitler değişmez. Bu kutu işaretliyse, kaydederken bu
                        pakete sahip <strong>aktif</strong> hesapların limit miktarları da yeni değerlerle
                        güncellenir (migrasyon).
                      </span>
                    </span>
                  </label>
                  {migrateToAccounts && (
                    <label className="mt-2.5 flex cursor-pointer items-center gap-2 pl-6 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={migrateIncludeExpired}
                        onChange={(e) => setMigrateIncludeExpired(e.target.checked)}
                        className="size-3.5 shrink-0"
                      />
                      Süresi dolmuş / pasif paket kayıtlarını da güncelle
                    </label>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Yan ayarlar */}
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Ayarlar</CardTitle></CardHeader>
            <CardContent className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Paket Adı (benzersiz)</label>
                <Input value={form.name} onChange={(e) => setField('name', e.target.value)} readOnly={!isNew} placeholder="pro-monthly" className={cn('font-mono text-xs', !isNew && 'opacity-70')} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Hedef</label>
                <Select value={form.forCompany ? 'business' : 'user'} onValueChange={(v) => setField('forCompany', v === 'business')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Kullanıcı Paketi</SelectItem>
                    <SelectItem value="business">Business Paketi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Kategori</label>
                <Select value={form.category} onValueChange={(v) => setField('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">İçerik Tipi</label>
                <Select value={form.package_content_type} onValueChange={(v) => setField('package_content_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Durum</label>
                <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm text-foreground">
                Varsayılan Paket
                <input type="checkbox" checked={form.default_package} onChange={(e) => setField('default_package', e.target.checked)} className="size-4" />
              </label>

              {/* Görünürlük — genel / firmaya özel / özel (link ile) */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Görünürlük</label>
                <Select value={form.visibility} onValueChange={(v) => setField('visibility', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Genel (herkes)</SelectItem>
                    <SelectItem value="private">Firmaya Özel</SelectItem>
                    <SelectItem value="unlisted">Özel (link ile)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {form.visibility === 'unlisted'
                    ? 'Özel paketler hiçbir listede görünmez; yalnız aşağıdaki link ile erişilir. Linke sahip herkes satın alabilir.'
                    : 'Firmaya özel paketler genel listelerde (pricing, upgrade) görünmez; sadece hedef firma satın alabilir/atanabilir.'}
                </p>
              </div>

              {/* Özel (unlisted) paketin paylaşım linki — token backend'de kaydetmede üretilir */}
              {form.visibility === 'unlisted' && (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Paylaşım Linki</label>
                  {pkg?.shareToken ? (
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={shareUrl(pkg.shareToken)}
                        className="font-mono text-[11px]"
                        onFocus={(e) => e.target.select()}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { navigator.clipboard?.writeText(shareUrl(pkg.shareToken)); setNotice('Link kopyalandı.'); }}
                      >
                        Kopyala
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Link, paketi kaydettikten sonra oluşturulur.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Hedef Açıklaması</label>
                <textarea
                  value={form.targetDescription}
                  onChange={(e) => setField('targetDescription', e.target.value)}
                  rows={3}
                  placeholder="Bu paketin kim için / neden oluşturulduğuna dair iç not"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                />
              </div>

              {form.visibility === 'private' && (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Hedef Firma</label>
                  <CompanySearchSelect
                    value={form.targetCompanyId}
                    onChange={(cid) => setField('targetCompanyId', cid ? String(cid) : '')}
                  />
                  {form.targetCompanyId && (
                    <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                      Seçili firma: {form.targetCompanyId}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={handleAssignToCompany}
                    disabled={isNew || !form.targetCompanyId || assigning}
                    title={isNew ? 'Önce paketi kaydedin' : 'Paketi seçili firmaya ata'}
                  >
                    {assigning ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Şirkete Ata
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Link href="/cms/settings/packages" className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
            <ChevronLeft className="size-4" /> Listeye Dön
          </Link>
        </div>
          </div>

          {/* Silme onay diyaloğu */}
          <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Paketi sil
            </DialogTitle>
            <DialogDescription>
              <strong>{form.name || 'Bu paket'}</strong> kalıcı olarak silinecek.
              Bu pakete bağlı abonelikler/snapshotlar etkilenmez ama yeni satışlarda
              kullanılamaz. Devam etmek istiyor musunuz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Evet, sil
            </Button>
          </DialogFooter>
        </DialogContent>
          </Dialog>

          {/* Migrasyon onay diyaloğu — geniş etkili işlem: mevcut hesap snapshot'larını ezer */}
          <Dialog open={confirmMigrate} onOpenChange={setConfirmMigrate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Limitleri mevcut hesaplara uygula
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <strong>{form.name || 'Bu paket'}</strong> paketine sahip{' '}
                  {migrateIncludeExpired ? 'tüm (süresi dolmuşlar dahil)' : 'aktif'} hesapların
                  limit miktarları, kaydettiğiniz yeni değerlerle güncellenecek.
                </p>
                <p className="text-amber-600 dark:text-amber-400">
                  Bu işlem, bu paket için tekil hesap bazında yapılmış manuel limit
                  düzenlemelerini (override) de yeni şablona sıfırlar ve geri alınamaz.
                </p>
                <p>Devam etmek istiyor musunuz?</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmMigrate(false)} disabled={saving}>
              İptal
            </Button>
            <Button
              onClick={() => { setConfirmMigrate(false); handleSave({ migrate: true }); }}
              disabled={saving}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Evet, uygula
            </Button>
          </DialogFooter>
        </DialogContent>
          </Dialog>
        </TabsContent>

        {!isNew && pkg?.forCompany && (
          <TabsContent value="codes">
            <PackageCodesPage packageId={id} packageData={pkg} />
          </TabsContent>
        )}
      </Tabs>
    </RoleGuard>
  );
}

// ── Limit input helpers ─────────────────────────────────────────────────────

function LimitRow({ label, value, unit, onChange, placeholder, helper, min = 0, max }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '0'}
          className="flex-1"
        />
        {unit && (
          <span className="rounded-md border border-border bg-muted px-2.5 py-2 text-xs font-medium text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {helper && <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>}
    </div>
  );
}

function ByteLimitRow({ label, valueBytes, onChange, helper }) {
  const editing = useRef(false);
  const dirty = useRef(false);
  const [displayValue, setDisplayValue] = useState(() => bytesToGiBDisplay(valueBytes));

  useEffect(() => {
    if (!editing.current) setDisplayValue(bytesToGiBDisplay(valueBytes));
  }, [valueBytes]);

  const update = (raw) => {
    dirty.current = true;
    setDisplayValue(raw);
    if (raw === '') {
      onChange(null);
      return;
    }
    const bytes = decimalUnitToBytes(raw);
    if (bytes !== null) onChange(bytes);
  };

  const normalizeOnBlur = () => {
    editing.current = false;
    if (!dirty.current) {
      setDisplayValue(bytesToGiBDisplay(valueBytes));
      return;
    }
    if (displayValue === '') {
      onChange(null);
      return;
    }
    const bytes = decimalUnitToBytes(displayValue);
    if (bytes === null) {
      setDisplayValue(bytesToGiBDisplay(valueBytes));
      return;
    }
    onChange(bytes);
    setDisplayValue(bytesToGiBDisplay(bytes));
  };

  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <div className="flex items-stretch gap-2">
        <Input
          type="number"
          min={0}
          step="any"
          value={displayValue}
          onFocus={() => { editing.current = true; dirty.current = false; }}
          onBlur={normalizeOnBlur}
          onChange={(e) => update(e.target.value)}
          placeholder="sınırsız"
          className="flex-1"
        />
        <span className="rounded-md border border-border bg-muted px-2.5 py-2 text-xs font-medium text-muted-foreground">
          GB (1024³ B)
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {helper ? `${helper} · ` : ''}
        {valueBytes === null || valueBytes === undefined || valueBytes === ''
          ? 'sınırsız'
          : `${Number(valueBytes).toLocaleString('tr-TR')} byte`}
      </p>
    </div>
  );
}

function PaymentPlanSummary({ pricing }) {
  const planType = resolvePaymentPlanType(pricing);
  const currency = pricing.currency || 'USD';
  const discount = Math.min(100, Math.max(0, Number(pricing.discount) || 0));
  const regular = Number(pricing.amount || 0) * (1 - discount / 100);
  const format = (value) => Number(value || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  let text = 'Ücretsiz; ödeme alınmaz.';
  if (planType === PAYMENT_PLAN_TYPES.FIXED_TERM) {
    text = `Bir kez ${format(regular)} ${currency}; dönem sonunda otomatik yenilenmez.`;
  } else if (planType === PAYMENT_PLAN_TYPES.RECURRING) {
    text = `${pricing.interval === 'year' ? 'Her yıl' : 'Her ay'} ${format(regular)} ${currency}; otomatik yenilenir.`;
  } else if (planType === PAYMENT_PLAN_TYPES.INTRODUCTORY_RECURRING) {
    text = `İlk ${pricing.introductoryBillingCycles || '?'} ay ${format(pricing.introductoryAmount)} ${currency}; ardından her ay ${format(regular)} ${currency}.`;
  }

  return (
    <p className="w-full rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
      <b className="text-foreground">Plan özeti:</b> {text}
      {discount > 0 && planType !== PAYMENT_PLAN_TYPES.NO_PAYMENT
        ? ` Standart faza %${discount} kalıcı indirim uygulanır.`
        : ''}
    </p>
  );
}

function StorageRateInput({ valuePerByte, onChange }) {
  const editing = useRef(false);
  const dirty = useRef(false);
  const [displayValue, setDisplayValue] = useState(() =>
    usdPerByteMonthToUsdPerGiBMonth(valuePerByte),
  );

  useEffect(() => {
    if (!editing.current) {
      setDisplayValue(usdPerByteMonthToUsdPerGiBMonth(valuePerByte));
    }
  }, [valuePerByte]);

  const update = (raw) => {
    dirty.current = true;
    setDisplayValue(raw);
    const perByte = usdPerGiBMonthToUsdPerByteMonth(raw);
    if (perByte !== null) onChange(perByte);
  };

  const normalizeOnBlur = () => {
    editing.current = false;
    if (!dirty.current) {
      setDisplayValue(usdPerByteMonthToUsdPerGiBMonth(valuePerByte));
      return;
    }
    const perByte = usdPerGiBMonthToUsdPerByteMonth(displayValue);
    if (perByte === null) {
      setDisplayValue(usdPerByteMonthToUsdPerGiBMonth(valuePerByte));
      return;
    }
    onChange(perByte);
    setDisplayValue(usdPerByteMonthToUsdPerGiBMonth(perByte));
  };

  const useAwsDefault = () => {
    dirty.current = false;
    onChange(DEFAULT_STORAGE_USD_PER_BYTE_MONTH);
    setDisplayValue(DEFAULT_STORAGE_USD_PER_GIB_MONTH);
  };

  return (
    <div className="w-64">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-[11px] text-muted-foreground">Depolama gideri</label>
        <button
          type="button"
          onClick={useAwsDefault}
          className="text-[10px] font-medium text-primary hover:underline"
        >
          AWS varsayılanı
        </button>
      </div>
      <div className="flex items-stretch gap-2">
        <Input
          type="number"
          min="0"
          step="any"
          value={displayValue}
          onFocus={() => { editing.current = true; dirty.current = false; }}
          onBlur={normalizeOnBlur}
          onChange={(e) => update(e.target.value)}
          placeholder={DEFAULT_STORAGE_USD_PER_GIB_MONTH}
        />
        <span className="whitespace-nowrap rounded-md border border-border bg-muted px-2 py-2 text-[10px] font-medium text-muted-foreground">
          USD / GiB-ay
        </span>
      </div>
      <p className="mt-1 break-all text-[10px] text-muted-foreground">
        {normalizeNonNegativeDecimal(valuePerByte, DEFAULT_STORAGE_USD_PER_BYTE_MONTH)} USD / byte-ay
      </p>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
        Varsayılan: AWS S3 Standard Frankfurt, $0.0245/GiB-ay. İstek, retrieval ve internet çıkışı hariçtir.
      </p>
    </div>
  );
}
