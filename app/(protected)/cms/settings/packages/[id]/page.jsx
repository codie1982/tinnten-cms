'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Save, Plus, Trash2, Loader2, ChevronLeft, Check, Eye, EyeOff, AlertTriangle,
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
// Backend systemPackagesController.buildLimitPayload ile birebir uyumlu birimler
const SIZE_UNITS = ['kb', 'mb', 'gb', 'tb'];
const STREAM_UNITS = ['mb', 'gb', 'tb'];
// NOT: `regeneretetime` alanı backend'den tamamen kaldırıldı. Reset artık
// fatura döngüsü (satın alınan periyot) tarafından yönlendiriliyor; her periyot
// (month/year) kendi limit objesini tutuyor ve döngü başına bir kez sıfırlanıyor.

// Backend default değerleri ile birebir aynı (buildLimitPayload)
const DEFAULT_LIMITS = {
  product: { amount: 10 },
  services: { amount: 10 },
  file: { download: 512, upload: 512, maxfileupload: 20, maxfileDownload: 20, unit: 'mb', stream: 10, stream_unit: 'gb' },
  image: { download: 512, upload: 512, maxfileupload: 20, maxfileDownload: 20, unit: 'mb', stream: 10, stream_unit: 'gb' },
  video: { download: 1024, upload: 1024, maxfileupload: 100, maxfileDownload: 100, unit: 'mb', stream: 50, stream_unit: 'gb' },
  offer: { max: 10 },
  llm: { token: 1024, credit: 1000 },
  workflow: { count: 5, totalRun: 100 },
  // Backend system-packages.model.js limit.assistant ile birebir — 4 alan da
  // taşınmalı, aksi halde kaydetmede tools/libraryFiles/previewViewsPerMonth
  // backend default'larına (5/10/100) sıfırlanır.
  assistant: { published: 1, tools: 5, libraryFiles: 10, previewViewsPerMonth: 100 },
  // Firma oluşturma limiti — yalnız Kullanıcı Paketi (forCompany:false) için anlamlı.
  // Kayıtta kullanıcının account snapshot'ına kopyalanır. null/boş = sınırsız, 0 = kota yok.
  company: { count: 1 },
  // Aylık web araması (Brave) kotası. Hesap başına uygulanır; kayıtta account
  // snapshot'ına kopyalanır. null/boş = sınırsız, 0 = kota yok. Periyot backend'de
  // fatura döngüsüne bağlı; paket bazında ayrıca bir periyot alanı tutulmaz.
  web_search: { count: 100 },
  maxDevices: null,
};

const emptyI18n = () => {
  const o = {};
  for (const l of CONTENT_LOCALES) o[l.code] = { title: '', description: '', features: '' };
  return o;
};

// Unlisted ("özel/link ile") paketin paylaşım linki — storefront (tinnten-nextjs) /paket/[token]
// sayfasına gider. Base URL NEXT_PUBLIC_STOREFRONT_URL ile ayarlanır (fallback: prod domain).
const STOREFRONT_URL = (process.env.NEXT_PUBLIC_STOREFRONT_URL || 'https://tinnten.com').replace(/\/$/, '');
const shareUrl = (token) => `${STOREFRONT_URL}/paket/${token}`;

// Backend'den gelen kısmi limits'i default ile derinlemesine merge et — eksik
// alanlar default değer alır, böylece UI hep dolu render eder.
const mergeLimits = (incoming) => {
  const out = JSON.parse(JSON.stringify(DEFAULT_LIMITS));
  if (!incoming || typeof incoming !== 'object') return out;
  for (const [k, v] of Object.entries(incoming)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = { ...out[k], ...v };
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
};

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
  const [pricing, setPricing] = useState([{ interval: 'month', amount: '', currency: 'USD', isDefault: true, isRenewable: false, durationTime: 1, discount: 0, localPrices: {} }]);
  // Limitler artık PERİYOT BAZLI: her fatura periyodu (month/year) kendi limit
  // objesini tutar. Satın alınan periyodun limiti kullanıcıya aktarılır; reset
  // fatura döngüsüne bağlı (periyot başına bir kez sıfırlanır).
  const [limitsByInterval, setLimitsByInterval] = useState(() => ({
    month: JSON.parse(JSON.stringify(DEFAULT_LIMITS)),
    year: JSON.parse(JSON.stringify(DEFAULT_LIMITS)),
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
      loadedPricing.map((p) => ({
        interval: p.interval || 'month',
        amount: p.amount ?? '',
        currency: p.currency || 'USD',
        isDefault: Boolean(p.isDefault),
        isRenewable: Boolean(p.isRenewable),
        durationTime: p.durationTime ?? 1,
        discount: p.discount ?? 0,
        localPrices: p.localPrices ?? {},
      })),
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
  const addPriceRow = () => setPricing((rows) => [...rows, { interval: 'year', amount: '', currency: 'USD', isDefault: false, isRenewable: false, durationTime: 1, discount: 0, localPrices: {} }]);
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

  function buildLimitBody(limitsArg) {
    // Periyot bazlı: hangi periyodun limitini gövdeye çevireceğimizi çağıran verir.
    const limits = limitsArg || DEFAULT_LIMITS;
    // Sayısal alanları Number'a çevir; null/boş → 0 (maxDevices hariç)
    const num = (v, fallback = 0) => {
      if (v === '' || v === null || v === undefined) return fallback;
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    // Boş/null → null = SINIRSIZ (backend toLimit ile birebir; llm.credit /
    // maxDevices kalıbı). Bu alanlarda backend sözleşmesi null=sınırsız, 0=kota yok.
    // num()'la coerce edilseydi admin sınırsız için alanı temizleyemez, boş bırakılan
    // her sınırsız paket kayıtta sessizce fallback'e (ör. 0/kota-yok) düşerdi.
    const nullable = (v, fallback = 0) =>
      v === '' || v === null || v === undefined ? null : num(v, fallback);
    return {
      product: { amount: num(limits.product?.amount) },
      services: { amount: num(limits.services?.amount) },
      file: {
        download: num(limits.file?.download),
        upload: num(limits.file?.upload),
        maxfileupload: num(limits.file?.maxfileupload),
        maxfileDownload: num(limits.file?.maxfileDownload),
        unit: limits.file?.unit || 'mb',
        stream: num(limits.file?.stream),
        stream_unit: limits.file?.stream_unit || 'gb',
      },
      image: {
        download: num(limits.image?.download),
        upload: num(limits.image?.upload),
        maxfileupload: num(limits.image?.maxfileupload),
        maxfileDownload: num(limits.image?.maxfileDownload),
        unit: limits.image?.unit || 'mb',
        stream: num(limits.image?.stream),
        stream_unit: limits.image?.stream_unit || 'gb',
      },
      video: {
        download: num(limits.video?.download),
        upload: num(limits.video?.upload),
        maxfileupload: num(limits.video?.maxfileupload),
        maxfileDownload: num(limits.video?.maxfileDownload),
        unit: limits.video?.unit || 'mb',
        stream: num(limits.video?.stream),
        stream_unit: limits.video?.stream_unit || 'gb',
      },
      offer: {
        max: num(limits.offer?.max),
      },
      llm: {
        // Kota kredi bazlı (backend hasLLMCreditQuota → limit.llm.credit).
        // `token` analitik alanı korunur (gönderilmezse backend 1024'e sıfırlar).
        token: num(limits.llm?.token),
        // Boş/null → null = SINIRSIZ (backend toLimit ile birebir; maxDevices kalıbı).
        // num()'la 1000'e coerce edilseydi, credit=null tutan sınırsız paket admin
        // LLM alanına dokunmasa bile her kayıtta sessizce 1000'e düşerdi (backend'in
        // özellikle koruduğu "sessizce sınırsızlığı geri alma" tuzağı).
        credit:
          limits.llm?.credit === '' || limits.llm?.credit === null || limits.llm?.credit === undefined
            ? null
            : num(limits.llm?.credit, 1000),
      },
      // ai limitleri KALDIRILDI — AI üretim artık LLM kredi bütçesinden düşer (backend
      // buildLimitPayload da ai bloğunu üretmez).
      workflow: {
        count: num(limits.workflow?.count),
        totalRun: num(limits.workflow?.totalRun),
      },
      assistant: {
        // published: aynı anda yayında olabilecek asistan sayısı (publish quota enforce eder).
        // Boş → null = SINIRSIZ (backend toLimit ile birebir); 0 = kota yok (yayınlama bloke).
        published: nullable(limits.assistant?.published, 1),
        // Aşağıdakiler UI'da düzenlenmese de taşınır — yoksa backend buildLimitPayload
        // bunları default'a (5/10/100) sıfırlar. previewViewsPerMonth enforce edilir.
        tools: num(limits.assistant?.tools, 5),
        // Boş → null = SINIRSIZ (backend toLimit ile birebir); 0 = kota yok (dosya eklenemez).
        libraryFiles: nullable(limits.assistant?.libraryFiles, 10),
        previewViewsPerMonth: num(limits.assistant?.previewViewsPerMonth, 100),
      },
      // Firma oluşturma limiti — bireysel pakette anlamlı; backend buildLimitPayload
      // company.count'u whitelist eder, gönderilmezse default 1'e döner.
      // Boş → null = SINIRSIZ (backend toLimit ile birebir); 0 = kota yok (firma açılamaz).
      company: {
        count: nullable(limits.company?.count, 1),
      },
      // Web araması kotası — backend buildLimitPayload web_search'ü whitelist eder.
      // Yalnız `count` gönderilir; reset periyodu backend'de fatura döngüsüne bağlı.
      // Boş → null = SINIRSIZ (backend toLimit ile birebir); 0 = kota yok (arama bloke).
      web_search: {
        count: nullable(limits.web_search?.count, 100),
      },
      maxDevices:
        limits.maxDevices === '' || limits.maxDevices === null || limits.maxDevices === undefined
          ? null
          : num(limits.maxDevices, null),
    };
  }

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
        isRenewable: Boolean(p.isRenewable),
        durationTime: Number(p.durationTime) || 1,
        discount: Math.min(100, Math.max(0, Number(p.discount) || 0)),
        localPrices: {
          TRY: p.localPrices?.TRY != null && p.localPrices?.TRY !== '' ? Number(p.localPrices.TRY) : null,
          EUR: p.localPrices?.EUR != null && p.localPrices?.EUR !== '' ? Number(p.localPrices.EUR) : null,
          USD: p.localPrices?.USD != null && p.localPrices?.USD !== '' ? Number(p.localPrices.USD) : null,
        },
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

  // Aktif periyodun limit objesi — Limitler JSX'i (limits.file?.upload vs.) bunu okur.
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
        actions={
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
        }
      />

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
                    <Select value={p.interval} onValueChange={(v) => setPriceRow(i, 'interval', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INTERVALS.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28">
                    <label className="mb-1 block text-[11px] text-muted-foreground">Tutar</label>
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
                  <div className="w-24">
                    <label className="mb-1 block text-[11px] text-muted-foreground">İndirim %</label>
                    <Input type="number" min="0" max="100" value={p.discount ?? 0} onChange={(e) => setPriceRow(i, 'discount', e.target.value)} placeholder="0" />
                  </div>
                  {p.currency !== 'USD' && (
                    <div className="w-24">
                      <label className="mb-1 block text-[11px] text-muted-foreground">USD karşılığı</label>
                      <Input
                        type="number" min="0" placeholder="0"
                        value={p.localPrices?.USD ?? ''}
                        onChange={(e) => setPriceRow(i, 'localPrices', { ...(p.localPrices || {}), USD: e.target.value })}
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-1.5 pb-2 text-xs text-foreground">
                    <input type="checkbox" checked={p.isDefault} onChange={(e) => setPriceRow(i, 'isDefault', e.target.checked)} className="size-4" />
                    Varsayılan
                  </label>
                  <label className="flex items-center gap-1.5 pb-2 text-xs text-foreground">
                    <input type="checkbox" checked={p.isRenewable} onChange={(e) => setPriceRow(i, 'isRenewable', e.target.checked)} className="size-4" />
                    Yenilenebilir
                  </label>
                  <Button variant="ghost" size="icon" className="size-8 hover:text-destructive" onClick={() => removePriceRow(i)}>
                    <Trash2 className="size-4" />
                  </Button>
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
                      [activeLimitInterval]: JSON.parse(JSON.stringify(DEFAULT_LIMITS)),
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

              {/* Dosya / Görsel / Video kotaları */}
              {[
                { key: 'file', label: 'Dosya' },
                { key: 'image', label: 'Görsel' },
                { key: 'video', label: 'Video' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label} Kotası</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <LimitRowWithUnit
                      label="Aylık upload"
                      value={limits[key]?.upload}
                      unit={limits[key]?.unit}
                      unitOptions={SIZE_UNITS}
                      onChange={(v) => setLimitField(key, 'upload', v)}
                      onUnitChange={(u) => setLimitField(key, 'unit', u)}
                    />
                    <LimitRowWithUnit
                      label="Aylık download"
                      value={limits[key]?.download}
                      unit={limits[key]?.unit}
                      unitOptions={SIZE_UNITS}
                      onChange={(v) => setLimitField(key, 'download', v)}
                      onUnitChange={(u) => setLimitField(key, 'unit', u)}
                    />
                    <LimitRowWithUnit
                      label="Tek upload (maks.)"
                      value={limits[key]?.maxfileupload}
                      unit={limits[key]?.unit}
                      unitOptions={SIZE_UNITS}
                      onChange={(v) => setLimitField(key, 'maxfileupload', v)}
                      onUnitChange={(u) => setLimitField(key, 'unit', u)}
                    />
                    <LimitRowWithUnit
                      label="Tek download (maks.)"
                      value={limits[key]?.maxfileDownload}
                      unit={limits[key]?.unit}
                      unitOptions={SIZE_UNITS}
                      onChange={(v) => setLimitField(key, 'maxfileDownload', v)}
                      onUnitChange={(u) => setLimitField(key, 'unit', u)}
                    />
                    <LimitRowWithUnit
                      label="Aylık stream"
                      value={limits[key]?.stream}
                      unit={limits[key]?.stream_unit}
                      unitOptions={STREAM_UNITS}
                      onChange={(v) => setLimitField(key, 'stream', v)}
                      onUnitChange={(u) => setLimitField(key, 'stream_unit', u)}
                    />
                  </div>
                </div>
              ))}

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

              {/* Web arama limitleri — tüm paketlerde (bireysel + firma) anlamlı;
                  hesap başına Brave araması kotası. Reset fatura döngüsüne bağlı. */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Web Arama</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <LimitRow
                    label="Web arama limiti"
                    value={limits.web_search?.count}
                    unit="arama"
                    onChange={(v) => setLimitField('web_search', 'count', v)}
                    placeholder="sınırsız"
                    helper="Her web araması (Brave) çağrısı 1 hak harcar; fatura döngüsü başına sıfırlanır · boş = sınırsız · 0 = kota yok"
                  />
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Yenileme periyodu</label>
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                      Fatura döngüsü
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Reset periyodu satın alınan periyoda (fatura döngüsüne) bağlıdır.</p>
                  </div>
                </div>
              </div>

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
    </RoleGuard>
  );
}

// ── Limit input helpers ─────────────────────────────────────────────────────

function LimitRow({ label, value, unit, onChange, placeholder, helper }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
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

function LimitRowWithUnit({ label, value, unit, unitOptions, onChange, onUnitChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <div className="flex items-stretch gap-2">
        <Input
          type="number"
          min={0}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="flex-1"
        />
        <div className="w-24 shrink-0">
          <Select value={unit || unitOptions[0]} onValueChange={onUnitChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {unitOptions.map((u) => (
                <SelectItem key={u} value={u} className="uppercase">{u.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
