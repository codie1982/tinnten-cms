'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Check, Clipboard, Eye, EyeOff, Ticket, Users } from 'lucide-react';

import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useCreatePackageCodeMutation,
  useGetCmsPackageCodesQuery,
  useGetCmsPackagesQuery,
  useGetPackageCodeRedemptionsQuery,
  useUpdatePackageCodeMutation,
} from '@/redux/services';

const packageTitle = (pkg) => {
  const i18n = pkg?.i18n || {};
  return i18n.tr?.title || i18n.en?.title || Object.values(i18n)[0]?.title || pkg?.name || '—';
};

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';

const toIsoOrNull = (value) => value ? new Date(value).toISOString() : null;

const initialForm = {
  label: '',
  packageId: '',
  pricingInterval: 'month',
  durationCount: '3',
  quotaMode: 'limited',
  maxRedemptions: '100',
  startsAt: '',
  expiresAt: '',
};

function RedemptionList({ codeId }) {
  const { data = [], isLoading, error } = useGetPackageCodeRedemptionsQuery(codeId);
  if (isLoading) return <Skeleton className="m-4 h-12" />;
  if (error) return <p className="p-4 text-sm text-destructive">Kullanımlar yüklenemedi.</p>;
  if (!data.length) return <p className="p-4 text-sm text-muted-foreground">Bu kod henüz kullanılmadı.</p>;
  return (
    <div className="border-t border-border bg-muted/20 p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kullanıcı</TableHead>
            <TableHead>Firma</TableHead>
            <TableHead>Kullanım</TableHead>
            <TableHead>Erişim Sonu</TableHead>
            <TableHead>Durum</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item._id}>
              <TableCell>{item.userId?.email || item.userId?._id || '—'}</TableCell>
              <TableCell>{item.companyId?.companyName || item.companyId?._id || '—'}</TableCell>
              <TableCell>{formatDate(item.redeemedAt)}</TableCell>
              <TableCell>{formatDate(item.accessEndsAt)}</TableCell>
              <TableCell><Badge variant={item.status === 'active' ? 'success' : 'muted'}>{item.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function PackageCodesPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const [form, setForm] = useState(initialForm);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedCode, setExpandedCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [notice, setNotice] = useState(null);

  const { data: packages = [] } = useGetCmsPackagesQuery(
    { forCompany: 'true', status: 'active' },
    { skip: !authorized },
  );
  const { data: codes = [], isLoading, error } = useGetCmsPackageCodesQuery(
    {
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchFilter.trim() || undefined,
    },
    { skip: !authorized },
  );
  const [createCode, { isLoading: isCreating }] = useCreatePackageCodeMutation();
  const [updateCode] = useUpdatePackageCodeMutation();

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg._id === form.packageId) || null,
    [form.packageId, packages],
  );
  const intervals = useMemo(
    () => (selectedPackage?.pricing || []).filter((price) => ['month', 'year'].includes(price.interval)),
    [selectedPackage],
  );

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setNotice(null);
    try {
      const created = await createCode({
        label: form.label,
        packageId: form.packageId,
        pricingInterval: form.pricingInterval,
        grantDuration: { count: Number(form.durationCount), unit: 'month' },
        maxRedemptions: form.quotaMode === 'unlimited' ? null : Number(form.maxRedemptions),
        startsAt: toIsoOrNull(form.startsAt),
        expiresAt: toIsoOrNull(form.expiresAt),
        offerPrice: { amount: 0, currency: 'TRY' },
      }).unwrap();
      setForm(initialForm);
      setNotice({ type: 'success', text: `${created?.code || 'Kod'} oluşturuldu.` });
    } catch (cause) {
      setNotice({ type: 'error', text: cause?.data?.message || cause?.normalizedMessage || 'Kod oluşturulamadı.' });
    }
  };

  const toggleStatus = async (item) => {
    await updateCode({ id: item._id, status: item.status === 'active' ? 'inactive' : 'active' }).unwrap().catch(() => {});
  };

  const copyLink = async (item) => {
    const base = String(process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://tinten.ai').replace(/\/+$/, '');
    const url = `${base}/onboarding?code=${encodeURIComponent(item.code)}&openWizard=1`;
    await navigator.clipboard.writeText(url);
    setCopiedCode(item._id);
    window.setTimeout(() => setCopiedCode(null), 1800);
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        breadcrumb={[{ label: 'Paketler', href: '/cms/settings/packages' }, { label: 'Kodlar' }]}
        section="Sistem Ayarları"
        title="Paket Kodları"
        description="Kotalı veya sınırsız özel deneme kodları üretin ve kullanımlarını izleyin."
        actions={<Link href="/cms/settings/packages" className={buttonVariants({ variant: 'outline' })}>Paketlere Dön</Link>}
      />

      {notice ? (
        <Alert variant={notice.type === 'error' ? 'destructive' : 'default'} className="mb-5">
          <AlertTitle>{notice.type === 'error' ? 'İşlem başarısız' : 'İşlem tamamlandı'}</AlertTitle>
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="mb-5">
        <CardHeader><CardTitle>Yeni Kod Oluştur</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">İç etiket</label>
              <Input value={form.label} onChange={(e) => setField('label', e.target.value)} placeholder="Örn. Eylül partner teklifi" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Paket</label>
              <Select value={form.packageId} onValueChange={(value) => {
                const pkg = packages.find((item) => item._id === value);
                const firstInterval = (pkg?.pricing || []).find((price) => ['month', 'year'].includes(price.interval))?.interval || 'month';
                setForm((current) => ({ ...current, packageId: value, pricingInterval: firstInterval }));
              }}>
                <SelectTrigger><SelectValue placeholder="Paket seçin" /></SelectTrigger>
                <SelectContent>{packages.filter((pkg) => pkg.visibility !== 'private').map((pkg) => <SelectItem key={pkg._id} value={pkg._id}>{packageTitle(pkg)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Paket kota döngüsü</label>
              <Select value={form.pricingInterval} onValueChange={(value) => setField('pricingInterval', value)} disabled={!form.packageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{intervals.map((price) => <SelectItem key={price.interval} value={price.interval}>{price.interval === 'year' ? 'Yıllık' : 'Aylık'} · {price.amount} {price.currency}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Ücretsiz erişim (ay)</label>
              <Input type="number" min="1" step="1" value={form.durationCount} onChange={(e) => setField('durationCount', e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Kod kotası</label>
              <Select value={form.quotaMode} onValueChange={(value) => setField('quotaMode', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="limited">Kotalı</SelectItem><SelectItem value="unlimited">Sınırsız</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Maksimum kullanım</label>
              <Input type="number" min="1" step="1" value={form.maxRedemptions} onChange={(e) => setField('maxRedemptions', e.target.value)} disabled={form.quotaMode === 'unlimited'} required={form.quotaMode === 'limited'} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Kod başlangıcı (opsiyonel)</label>
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => setField('startsAt', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Kod bitişi (opsiyonel)</label>
              <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setField('expiresAt', e.target.value)} />
            </div>
            <div className="lg:col-span-4 flex justify-end">
              <Button type="submit" disabled={isCreating || !form.packageId}>{isCreating ? 'Oluşturuluyor…' : 'Kod Oluştur'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kod Listesi</CardTitle>
          <CardToolbar className="flex items-center gap-2">
            <Input
              className="w-52"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="Kod veya etiket ara"
              aria-label="Kod veya etiket ara"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tüm durumlar</SelectItem><SelectItem value="active">Aktif</SelectItem><SelectItem value="inactive">Pasif</SelectItem></SelectContent>
            </Select>
            <Badge variant="muted">{codes.length} kod</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {error ? <p className="p-4 text-sm text-destructive">Kodlar yüklenemedi.</p> : isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-8" />)}</div>
          ) : !codes.length ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center"><Ticket className="size-6 text-muted-foreground" /><p className="font-semibold">Kod yok</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Kod</TableHead><TableHead>Paket</TableHead><TableHead>Süre</TableHead><TableHead>Kota</TableHead><TableHead>Geçerlilik</TableHead><TableHead>Durum</TableHead><TableHead className="w-40" /></TableRow></TableHeader>
              <TableBody>
                {codes.map((item) => {
                  const remaining = item.maxRedemptions == null ? 'Sınırsız' : Math.max(item.maxRedemptions - item.redeemedCount, 0);
                  return [
                    <TableRow key={item._id}>
                      <TableCell><p className="font-mono text-sm font-semibold">{item.code}</p><p className="text-xs text-muted-foreground">{item.label || '—'}</p></TableCell>
                      <TableCell>{packageTitle(item.packageId)}</TableCell>
                      <TableCell>{item.grantDuration?.count || 1} ay</TableCell>
                      <TableCell><span className="font-medium">{item.redeemedCount || 0}</span> kullanıldı · {remaining} kaldı</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.startsAt ? formatDate(item.startsAt) : 'Hemen'} — {item.expiresAt ? formatDate(item.expiresAt) : 'Süresiz'}</TableCell>
                      <TableCell><Badge variant={item.status === 'active' ? 'success' : 'muted'}>{item.status === 'active' ? 'Aktif' : 'Pasif'}</Badge></TableCell>
                      <TableCell><div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="size-8" title="Onboarding linkini kopyala" onClick={() => copyLink(item)}>{copiedCode === item._id ? <Check className="size-4 text-emerald-600" /> : <Clipboard className="size-4" />}</Button>
                        <Button variant="ghost" size="icon" className="size-8" title="Kullanımları göster" onClick={() => setExpandedCode((current) => current === item._id ? null : item._id)}><Users className="size-4" /></Button>
                        <Button variant="ghost" size="icon" className="size-8" title={item.status === 'active' ? 'Pasife al' : 'Aktifleştir'} onClick={() => toggleStatus(item)}>{item.status === 'active' ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
                      </div></TableCell>
                    </TableRow>,
                    expandedCode === item._id ? <TableRow key={`${item._id}-redemptions`}><TableCell colSpan={7} className="p-0"><RedemptionList codeId={item._id} /></TableCell></TableRow> : null,
                  ];
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
