'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Save, Plus, Trash2, Loader2, ChevronLeft, Check } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { CONTENT_LOCALES } from '@/config/api';
import {
  useGetCmsPackageQuery,
  useCreatePackageMutation,
  useUpdatePackageMutation,
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

const emptyI18n = () => {
  const o = {};
  for (const l of CONTENT_LOCALES) o[l.code] = { title: '', description: '', features: '' };
  return o;
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
  const [activeLocale, setActiveLocale] = useState('tr');
  const [notice, setNotice] = useState('');

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
  }, [pkg, isNew]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setLocaleField = (loc, k, v) => setI18n((s) => ({ ...s, [loc]: { ...s[loc], [k]: v } }));
  const setPriceRow = (i, k, v) => setPricing((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addPriceRow = () => setPricing((rows) => [...rows, { interval: 'year', amount: '', currency: 'USD', isDefault: false, isRenewable: false, durationTime: 1 }]);
  const removePriceRow = (i) => setPricing((rows) => rows.filter((_, idx) => idx !== i));

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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Kaydet
          </Button>
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
    </RoleGuard>
  );
}
