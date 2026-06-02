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
  useCreatePackageMutation,
  useUpdatePackageMutation,
  useDeletePackageMutation,
} from '@/redux/services';

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
const REGEN_PERIODS = [
  { value: 'Hourly', label: 'Saatlik' },
  { value: 'Daily', label: 'Günlük' },
  { value: 'Weekly', label: 'Haftalık' },
  { value: 'Monthly', label: 'Aylık' },
];

// Backend default değerleri ile birebir aynı (buildLimitPayload)
const DEFAULT_LIMITS = {
  product: { amount: 10 },
  services: { amount: 10 },
  file: { download: 512, upload: 512, maxfileupload: 20, maxfileDownload: 20, unit: 'mb', stream: 10, stream_unit: 'gb' },
  image: { download: 512, upload: 512, maxfileupload: 20, maxfileDownload: 20, unit: 'mb', stream: 10, stream_unit: 'gb' },
  video: { download: 1024, upload: 1024, maxfileupload: 100, maxfileDownload: 100, unit: 'mb', stream: 50, stream_unit: 'gb' },
  offer: { max: 10, regeneretetime: 'Daily' },
  llm: { token: 1024, regeneretetime: 'Daily' },
  ai: { images: 20, enrich: 50, video: 5 },
  workflow: { count: 5, totalRun: 100 },
  maxDevices: null,
};

const emptyI18n = () => {
  const o = {};
  for (const l of CONTENT_LOCALES) o[l.code] = { title: '', description: '', features: '' };
  return o;
};

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
  const [createPackage, { isLoading: creating }] = useCreatePackageMutation();
  const [updatePackage, { isLoading: updating }] = useUpdatePackageMutation();
  const [deletePackage, { isLoading: deleting }] = useDeletePackageMutation();
  const saving = creating || updating;

  const [form, setForm] = useState({
    name: '',
    forCompany: false,
    category: 'free',
    package_content_type: 'standart',
    status: 'active',
    default_package: false,
  });
  const [i18n, setI18n] = useState(emptyI18n);
  const [pricing, setPricing] = useState([{ interval: 'month', amount: '', currency: 'USD', isDefault: true, isRenewable: false, durationTime: 1 }]);
  const [limits, setLimits] = useState(() => JSON.parse(JSON.stringify(DEFAULT_LIMITS)));
  const [activeLocale, setActiveLocale] = useState('tr');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isNew || !pkg) return;
    setForm({
      name: pkg.name || '',
      forCompany: Boolean(pkg.forCompany),
      category: pkg.category || 'free',
      package_content_type: pkg.package_content_type || 'standart',
      status: pkg.status || 'active',
      default_package: Boolean(pkg.default_package),
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
    setPricing(
      (pkg.pricing?.length ? pkg.pricing : [{ interval: 'month', amount: '', currency: 'USD', isDefault: true }]).map((p) => ({
        interval: p.interval || 'month',
        amount: p.amount ?? '',
        currency: p.currency || 'USD',
        isDefault: Boolean(p.isDefault),
        isRenewable: Boolean(p.isRenewable),
        durationTime: p.durationTime ?? 1,
      })),
    );
    // Backend `limit` (tekil) ya da eski kayıtlarda `limits` (çoğul) tutabilir
    setLimits(mergeLimits(pkg.limit ?? pkg.limits));
  }, [pkg, isNew]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setLocaleField = (loc, k, v) => setI18n((s) => ({ ...s, [loc]: { ...s[loc], [k]: v } }));
  const setPriceRow = (i, k, v) => setPricing((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addPriceRow = () => setPricing((rows) => [...rows, { interval: 'year', amount: '', currency: 'USD', isDefault: false, isRenewable: false, durationTime: 1 }]);
  const removePriceRow = (i) => setPricing((rows) => rows.filter((_, idx) => idx !== i));

  // Nested limit alanlarını güncelleme: setLimitField('file', 'upload', 1024)
  const setLimitField = (group, key, v) => {
    setLimits((s) => ({ ...s, [group]: { ...(s[group] || {}), [key]: v } }));
  };
  const setLimitRoot = (key, v) => setLimits((s) => ({ ...s, [key]: v }));

  function buildLimitBody() {
    // Sayısal alanları Number'a çevir; null/boş → 0 (maxDevices hariç)
    const num = (v, fallback = 0) => {
      if (v === '' || v === null || v === undefined) return fallback;
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
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
        regeneretetime: limits.offer?.regeneretetime || 'Daily',
      },
      llm: {
        token: num(limits.llm?.token),
        regeneretetime: limits.llm?.regeneretetime || 'Daily',
      },
      ai: {
        images: num(limits.ai?.images),
        enrich: num(limits.ai?.enrich),
        video: num(limits.ai?.video),
      },
      workflow: {
        count: num(limits.workflow?.count),
        totalRun: num(limits.workflow?.totalRun),
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
      // Backend hem `limit` (tekil) hem `limits` (çoğul) kabul ediyor;
      // canonical olan `limit`'i gönderiyoruz.
      limit: buildLimitBody(),
    };
  }

  async function handleSave() {
    setNotice('');
    const body = buildBody();
    if (!body.name) { setNotice('Paket adı (name) zorunludur.'); return; }
    if (!Object.keys(body.i18n).length) { setNotice('En az bir dilde başlık girin.'); return; }
    if (isNew) {
      const r = await createPackage(body).unwrap().catch((e) => { setNotice(e?.data?.message || 'Oluşturulamadı.'); return null; });
      const newId = r?._id ?? r?.id;
      if (newId) router.push(`/cms/settings/packages/${newId}`);
      else if (r) router.push('/cms/settings/packages');
    } else {
      const r = await updatePackage({ id, ...body }).unwrap().catch((e) => { setNotice(e?.data?.message || 'Güncellenemedi.'); return null; });
      if (r) setNotice('Paket kaydedildi.');
    }
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
            <Button onClick={handleSave} disabled={saving}>
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

          {/* Limitler */}
          <Card>
            <CardHeader>
              <CardTitle>Limitler</CardTitle>
              <CardToolbar>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setLimits(JSON.parse(JSON.stringify(DEFAULT_LIMITS)))}
                  title="Tüm limitleri varsayılana sıfırla"
                >
                  Varsayılana sıfırla
                </Button>
              </CardToolbar>
            </CardHeader>
            <CardContent className="space-y-5 p-4">
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
                  <LimitPeriodRow
                    label="Yenileme periyodu"
                    value={limits.offer?.regeneretetime}
                    onChange={(v) => setLimitField('offer', 'regeneretetime', v)}
                  />
                </div>
              </div>

              {/* LLM token limiti */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">LLM</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <LimitRow
                    label="Token"
                    value={limits.llm?.token}
                    unit="token"
                    onChange={(v) => setLimitField('llm', 'token', v)}
                  />
                  <LimitPeriodRow
                    label="Yenileme periyodu"
                    value={limits.llm?.regeneretetime}
                    onChange={(v) => setLimitField('llm', 'regeneretetime', v)}
                  />
                </div>
              </div>

              {/* AI üretim limitleri */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Üretim</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <LimitRow label="Görsel üretim" value={limits.ai?.images} unit="adet" onChange={(v) => setLimitField('ai', 'images', v)} />
                  <LimitRow label="Enrich" value={limits.ai?.enrich} unit="adet" onChange={(v) => setLimitField('ai', 'enrich', v)} />
                  <LimitRow label="Video üretim" value={limits.ai?.video} unit="adet" onChange={(v) => setLimitField('ai', 'video', v)} />
                </div>
              </div>

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

function LimitPeriodRow({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <Select value={value || 'Daily'} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {REGEN_PERIODS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
