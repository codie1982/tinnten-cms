'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Check, Clipboard, Eye, EyeOff, Pencil, Ticket, Users, X } from 'lucide-react';

import { RoleGuard } from '@/components/auth/role-guard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useCreatePackageCodeMutation,
  useGetCmsPackageCodesQuery,
  useGetPackageCodeAttributionsQuery,
  useGetPackageCodePublishersQuery,
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
  publisherType: 'none',
  partnerCompanyId: '',
  partnerUserId: '',
  publisherName: '',
  publisherEmail: '',
};

const publisherLabel = (publisher) => {
  if (!publisher || publisher.type === 'none') return 'Sahipsiz';
  if (publisher.type === 'partner_company') return publisher.name || 'Partner firma';
  if (publisher.type === 'partner_person') return publisher.name || publisher.email || 'Partner kişi';
  return publisher.name || publisher.email || 'Harici yayıncı';
};

const publisherPayload = (value) => value.publisherType === 'partner_company'
  ? { type: 'partner_company', partnerCompanyId: value.partnerCompanyId }
  : value.publisherType === 'partner_person'
    ? {
        type: 'partner_person',
        partnerCompanyId: value.partnerCompanyId,
        partnerUserId: value.partnerUserId,
      }
    : value.publisherType === 'external_email'
      ? {
          type: 'external_email',
          name: value.publisherName,
          email: value.publisherEmail,
        }
      : { type: 'none' };

function AttributionList({ codeId }) {
  const [domainFilter, setDomainFilter] = useState('');
  const { data = [], isLoading, error } = useGetPackageCodeAttributionsQuery({
    id: codeId,
    domain: domainFilter.trim() || undefined,
  });
  if (isLoading) return <Skeleton className="m-4 h-12" />;
  if (error) return <p className="p-4 text-sm text-destructive">Kayıt atıfları yüklenemedi.</p>;
  if (!data.length) return <p className="p-4 text-sm text-muted-foreground">Bu kodla ilişkilendirilmiş kayıt bulunmuyor.</p>;
  return (
    <div className="border-t border-border bg-muted/10 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Kayıt ve yönlendirme izleri</p>
          <p className="text-xs text-muted-foreground">Referrer bilgisi tarayıcıdan gelir; UTM kullanmak domain eşleşmesini daha güvenilir kılar.</p>
        </div>
        <Input
          className="w-64"
          value={domainFilter}
          onChange={(event) => setDomainFilter(event.target.value)}
          placeholder="Domain filtrele: ornek.com"
          aria-label="Referrer domain filtrele"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kullanıcı</TableHead>
            <TableHead>Kaynak</TableHead>
            <TableHead>Referrer domain</TableHead>
            <TableHead>UTM</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>İlk kayıt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item._id}>
              <TableCell>{item.userId?.emailNormalized || item.userId?.email || item.userId?._id || '—'}</TableCell>
              <TableCell>{item.source === 'manual' ? 'Manuel' : item.source === 'legacy' ? 'Eski akış' : 'Referans linki'}</TableCell>
              <TableCell>{item.acquisition?.referrerDomain || 'Doğrudan / bilinmiyor'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {[item.acquisition?.utmSource, item.acquisition?.utmMedium, item.acquisition?.utmCampaign].filter(Boolean).join(' / ') || '—'}
              </TableCell>
              <TableCell><Badge variant={item.status === 'redeemed' ? 'success' : item.status === 'pending' ? 'warning' : 'muted'}>{item.status}</Badge></TableCell>
              <TableCell>{formatDate(item.claimedAt || item.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

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
            <TableHead>E-posta domain</TableHead>
            <TableHead>Firma domain</TableHead>
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
              <TableCell>{item.userEmailDomain || '—'}</TableCell>
              <TableCell>{item.companyWebsiteDomain || '—'}</TableCell>
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

export default function PackageCodesPage({ packageId, packageData }) {
  const router = useRouter();
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const defaultPricingInterval = (packageData?.pricing || [])
    .find((price) => ['month', 'year'].includes(price.interval))?.interval || 'month';
  const [form, setForm] = useState(() => ({
    ...initialForm,
    packageId: packageId || '',
    pricingInterval: defaultPricingInterval,
  }));
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedCode, setExpandedCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [publisherEdit, setPublisherEdit] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!packageId) {
      router.replace('/cms/settings/packages');
      return;
    }
    setForm((current) => ({
      ...current,
      packageId,
      pricingInterval: (packageData?.pricing || []).some(
        (price) => price.interval === current.pricingInterval,
      ) ? current.pricingInterval : defaultPricingInterval,
    }));
  }, [defaultPricingInterval, packageData?.pricing, packageId, router]);

  const { data: publisherOptions = [] } = useGetPackageCodePublishersQuery(
    { limit: 100 },
    { skip: !authorized || !packageId },
  );
  const { data: codes = [], isLoading, error } = useGetCmsPackageCodesQuery(
    {
      packageId,
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchFilter.trim() || undefined,
    },
    { skip: !authorized || !packageId },
  );
  const [createCode, { isLoading: isCreating }] = useCreatePackageCodeMutation();
  const [updateCode] = useUpdatePackageCodeMutation();

  const intervals = useMemo(
    () => (packageData?.pricing || []).filter((price) => ['month', 'year'].includes(price.interval)),
    [packageData?.pricing],
  );
  const canCreateCode = packageData?.status === 'active'
    && ['public', 'unlisted'].includes(packageData?.visibility || 'public')
    && intervals.length > 0;
  const selectedPartnerCompany = useMemo(
    () => publisherOptions.find((company) => company.id === form.partnerCompanyId) || null,
    [form.partnerCompanyId, publisherOptions],
  );

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setNotice(null);
    if (!canCreateCode) {
      setNotice({
        type: 'error',
        text: 'Kod oluşturmak için paket aktif, genel veya link/kod ile görünür ve aylık ya da yıllık dönemli olmalıdır.',
      });
      return;
    }
    try {
      const created = await createCode({
        label: form.label,
        packageId,
        pricingInterval: form.pricingInterval,
        grantDuration: { count: Number(form.durationCount), unit: 'month' },
        maxRedemptions: form.quotaMode === 'unlimited' ? null : Number(form.maxRedemptions),
        startsAt: toIsoOrNull(form.startsAt),
        expiresAt: toIsoOrNull(form.expiresAt),
        offerPrice: { amount: 0, currency: 'TRY' },
        publisher: publisherPayload(form),
      }).unwrap();
      setForm({
        ...initialForm,
        packageId,
        pricingInterval: defaultPricingInterval,
      });
      setNotice({ type: 'success', text: `${created?.code || 'Kod'} oluşturuldu.` });
    } catch (cause) {
      setNotice({ type: 'error', text: cause?.data?.message || cause?.normalizedMessage || 'Kod oluşturulamadı.' });
    }
  };

  const toggleStatus = async (item) => {
    await updateCode({ id: item._id, status: item.status === 'active' ? 'inactive' : 'active' }).unwrap().catch(() => {});
  };

  const beginPublisherEdit = (item) => {
    const publisher = item.publisher || {};
    setPublisherEdit({
      codeId: item._id,
      publisherType: publisher.type || 'none',
      partnerCompanyId: String(publisher.partnerCompanyId?._id || publisher.partnerCompanyId || ''),
      partnerUserId: String(publisher.partnerUserId?._id || publisher.partnerUserId || ''),
      publisherName: publisher.name || '',
      publisherEmail: publisher.email || '',
    });
  };

  const savePublisherEdit = async () => {
    if (!publisherEdit) return;
    setNotice(null);
    try {
      await updateCode({
        id: publisherEdit.codeId,
        publisher: publisherPayload(publisherEdit),
      }).unwrap();
      setPublisherEdit(null);
      setNotice({ type: 'success', text: 'Kod yayıncısı güncellendi.' });
    } catch (cause) {
      setNotice({ type: 'error', text: cause?.data?.message || cause?.normalizedMessage || 'Kod yayıncısı güncellenemedi.' });
    }
  };

  const copyLink = async (item) => {
    const base = String(process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://tinten.ai').replace(/\/+$/, '');
    const url = `${base}/onboarding?ref=${encodeURIComponent(item.code)}&openWizard=1`;
    await navigator.clipboard.writeText(url);
    setCopiedCode(item._id);
    window.setTimeout(() => setCopiedCode(null), 1800);
  };

  if (!packageId) {
    return (
      <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
        <Skeleton className="h-96 w-full" />
      </RoleGuard>
    );
  }

  return (
    <>

      {notice ? (
        <Alert variant={notice.type === 'error' ? 'destructive' : 'default'} className="mb-5">
          <AlertTitle>{notice.type === 'error' ? 'İşlem başarısız' : 'İşlem tamamlandı'}</AlertTitle>
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      ) : null}

      {!canCreateCode ? (
        <Alert className="mb-5">
          <AlertTitle>Yeni kod oluşturma kapalı</AlertTitle>
          <AlertDescription>
            Mevcut kodları görüntüleyebilirsiniz. Yeni kod için paket aktif olmalı, görünürlüğü “Genel” veya
            “Link/Kod ile” olmalı ve aylık ya da yıllık fiyat dönemi içermelidir.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="mb-5">
        <CardHeader>
          <div>
            <CardTitle>Yeni Kod Oluştur</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Kod doğrudan <strong>{packageTitle(packageData)}</strong> paketine bağlanır. Paket özellikleri ve limitleri
              paket ayarlarından gelir; burada yalnız erişim süresi, dağıtım kotası ve yayıncı belirlenir.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">İç etiket</label>
              <Input value={form.label} onChange={(e) => setField('label', e.target.value)} placeholder="Örn. Eylül partner teklifi" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Paket dönemi</label>
              <Select value={form.pricingInterval} onValueChange={(value) => setField('pricingInterval', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{intervals.map((price) => <SelectItem key={price.interval} value={price.interval}>{price.interval === 'year' ? 'Yıllık' : 'Aylık'} · {price.amount} {price.currency}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Erişim süresi (ay)</label>
              <Input type="number" min="1" step="1" value={form.durationCount} onChange={(e) => setField('durationCount', e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Kod kullanım türü</label>
              <Select value={form.quotaMode} onValueChange={(value) => setField('quotaMode', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="limited">Kotalı</SelectItem><SelectItem value="unlimited">Sınırsız</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Maksimum kayıt / firma</label>
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
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Kod yayıncısı</label>
              <Select value={form.publisherType} onValueChange={(value) => setForm((current) => ({
                ...current,
                publisherType: value,
                partnerCompanyId: '',
                partnerUserId: '',
                publisherName: '',
                publisherEmail: '',
              }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sahipsiz</SelectItem>
                  <SelectItem value="partner_company">Partner firma</SelectItem>
                  <SelectItem value="partner_person">Partner kişi</SelectItem>
                  <SelectItem value="external_email">Yalnız ad / e-posta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {['partner_company', 'partner_person'].includes(form.publisherType) ? (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Onaylı partner firma</label>
                <Select value={form.partnerCompanyId} onValueChange={(value) => setForm((current) => ({
                  ...current,
                  partnerCompanyId: value,
                  partnerUserId: '',
                }))}>
                  <SelectTrigger><SelectValue placeholder="Partner firma seçin" /></SelectTrigger>
                  <SelectContent>
                    {publisherOptions.map((company) => (
                      <SelectItem key={company.id} value={company.id}>{company.name}{company.email ? ` · ${company.email}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {form.publisherType === 'partner_person' ? (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Partner firma kişisi</label>
                <Select value={form.partnerUserId} onValueChange={(value) => setField('partnerUserId', value)} disabled={!selectedPartnerCompany}>
                  <SelectTrigger><SelectValue placeholder="Kişi seçin" /></SelectTrigger>
                  <SelectContent>
                    {(selectedPartnerCompany?.representatives || []).map((person) => (
                      <SelectItem key={person.id} value={person.id}>{person.name}{person.email ? ` · ${person.email}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {form.publisherType === 'external_email' ? (
              <>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Yayıncı adı (opsiyonel)</label>
                  <Input value={form.publisherName} onChange={(e) => setField('publisherName', e.target.value)} placeholder="Kişi veya kurum adı" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Yayıncı e-postası</label>
                  <Input type="email" value={form.publisherEmail} onChange={(e) => setField('publisherEmail', e.target.value)} placeholder="ornek@firma.com" required />
                </div>
              </>
            ) : null}
            <div className="lg:col-span-4 flex justify-end">
              <Button
                type="submit"
                disabled={
                  isCreating ||
                  !canCreateCode ||
                  !packageId ||
                  (form.publisherType === 'partner_company' && !form.partnerCompanyId) ||
                  (form.publisherType === 'partner_person' && (!form.partnerCompanyId || !form.partnerUserId)) ||
                  (form.publisherType === 'external_email' && !form.publisherEmail.trim())
                }
              >
                {isCreating ? 'Oluşturuluyor…' : 'Kod Oluştur'}
              </Button>
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
              <TableHeader><TableRow><TableHead>Kod</TableHead><TableHead>Yayıncı</TableHead><TableHead>Süre</TableHead><TableHead>Kota</TableHead><TableHead>Geçerlilik</TableHead><TableHead>Durum</TableHead><TableHead className="w-40" /></TableRow></TableHeader>
              <TableBody>
                {codes.map((item) => {
                  const remaining = item.maxRedemptions == null ? 'Sınırsız' : Math.max(item.maxRedemptions - item.redeemedCount, 0);
                  const editingPublisher = publisherEdit?.codeId === item._id;
                  const editCompany = editingPublisher
                    ? publisherOptions.find((company) => company.id === publisherEdit.partnerCompanyId)
                    : null;
                  const publisherEditInvalid = editingPublisher && (
                    (publisherEdit.publisherType === 'partner_company' && !publisherEdit.partnerCompanyId) ||
                    (publisherEdit.publisherType === 'partner_person' && (!publisherEdit.partnerCompanyId || !publisherEdit.partnerUserId)) ||
                    (publisherEdit.publisherType === 'external_email' && !publisherEdit.publisherEmail.trim())
                  );
                  return [
                    <TableRow key={item._id}>
                      <TableCell><p className="font-mono text-sm font-semibold">{item.code}</p><p className="text-xs text-muted-foreground">{item.label || '—'}</p></TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{publisherLabel(item.publisher)}</p>
                        <p className="text-xs text-muted-foreground">{item.publisher?.email || '—'}</p>
                        <button type="button" onClick={() => beginPublisherEdit(item)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                          <Pencil className="size-3" /> Düzenle
                        </button>
                      </TableCell>
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
                    editingPublisher ? (
                      <TableRow key={`${item._id}-publisher-edit`}>
                        <TableCell colSpan={7} className="bg-muted/15 p-4">
                          <div className="grid gap-3 lg:grid-cols-4">
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">Yayıncı türü</label>
                              <Select value={publisherEdit.publisherType} onValueChange={(value) => setPublisherEdit((current) => ({
                                ...current,
                                publisherType: value,
                                partnerCompanyId: '',
                                partnerUserId: '',
                                publisherName: '',
                                publisherEmail: '',
                              }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sahipsiz</SelectItem>
                                  <SelectItem value="partner_company">Partner firma</SelectItem>
                                  <SelectItem value="partner_person">Partner kişi</SelectItem>
                                  <SelectItem value="external_email">Yalnız ad / e-posta</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {['partner_company', 'partner_person'].includes(publisherEdit.publisherType) ? (
                              <div>
                                <label className="mb-1 block text-xs text-muted-foreground">Onaylı partner firma</label>
                                <Select value={publisherEdit.partnerCompanyId} onValueChange={(value) => setPublisherEdit((current) => ({ ...current, partnerCompanyId: value, partnerUserId: '' }))}>
                                  <SelectTrigger><SelectValue placeholder="Partner firma seçin" /></SelectTrigger>
                                  <SelectContent>{publisherOptions.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            ) : null}
                            {publisherEdit.publisherType === 'partner_person' ? (
                              <div>
                                <label className="mb-1 block text-xs text-muted-foreground">Partner firma kişisi</label>
                                <Select value={publisherEdit.partnerUserId} onValueChange={(value) => setPublisherEdit((current) => ({ ...current, partnerUserId: value }))} disabled={!editCompany}>
                                  <SelectTrigger><SelectValue placeholder="Kişi seçin" /></SelectTrigger>
                                  <SelectContent>{(editCompany?.representatives || []).map((person) => <SelectItem key={person.id} value={person.id}>{person.name}{person.email ? ` · ${person.email}` : ''}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            ) : null}
                            {publisherEdit.publisherType === 'external_email' ? (
                              <>
                                <div>
                                  <label className="mb-1 block text-xs text-muted-foreground">Yayıncı adı</label>
                                  <Input value={publisherEdit.publisherName} onChange={(event) => setPublisherEdit((current) => ({ ...current, publisherName: event.target.value }))} />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs text-muted-foreground">Yayıncı e-postası</label>
                                  <Input type="email" value={publisherEdit.publisherEmail} onChange={(event) => setPublisherEdit((current) => ({ ...current, publisherEmail: event.target.value }))} />
                                </div>
                              </>
                            ) : null}
                            <div className="flex items-end justify-end gap-2 lg:col-start-4">
                              <Button type="button" variant="outline" onClick={() => setPublisherEdit(null)}><X className="size-4" /> Vazgeç</Button>
                              <Button type="button" disabled={publisherEditInvalid} onClick={() => void savePublisherEdit()}><Check className="size-4" /> Kaydet</Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null,
                    expandedCode === item._id ? (
                      <TableRow key={`${item._id}-tracking`}>
                        <TableCell colSpan={7} className="p-0">
                          <AttributionList codeId={item._id} />
                          <RedemptionList codeId={item._id} />
                        </TableCell>
                      </TableRow>
                    ) : null,
                  ];
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
