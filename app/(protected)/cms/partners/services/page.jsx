'use client';

import { useState } from 'react';
import { Archive, Package, ShieldCheck } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState, SkeletonRows } from '@/components/layout/page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CMS_ROLES } from '@/lib/roles';
import {
  useArchiveCmsPartnerServicePackageMutation,
  useGetCmsPartnerServiceAgreementsQuery,
  useGetCmsPartnerServicePackagesQuery,
} from '@/redux/services';

const statusVariant = {
  draft: 'muted', published: 'success', archived: 'destructive', requested: 'warning',
  active: 'success', declined: 'destructive', cancelled: 'muted', termination_scheduled: 'warning',
  suspended: 'destructive', terminated: 'muted',
};

const money = (pricing) => pricing?.type === 'free'
  ? 'Ücretsiz'
  : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: pricing?.currency || 'TRY' }).format((pricing?.amountMinor || 0) / 100);

export default function PartnerServicesPage({ embedded = false }) {
  const [packageStatus, setPackageStatus] = useState('');
  const [agreementStatus, setAgreementStatus] = useState('');
  const { data: packageData, isLoading: packagesLoading, error: packageError } = useGetCmsPartnerServicePackagesQuery(packageStatus ? { status: packageStatus } : {});
  const { data: agreementData, isLoading: agreementsLoading, error: agreementError } = useGetCmsPartnerServiceAgreementsQuery(agreementStatus ? { status: agreementStatus } : {});
  const [archivePackage, { isLoading: archiving }] = useArchiveCmsPartnerServicePackageMutation();
  const packages = packageData?.items || [];
  const agreements = agreementData?.items || [];

  const handleArchive = async (item) => {
    if (!window.confirm(`“${item.name}” paketi kötüye kullanım / politika incelemesi nedeniyle arşivlensin mi?`)) return;
    await archivePackage(item.id || item._id).unwrap();
  };

  return <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
    {!embedded ? <PageHeader section="Partnerler" title="Partner Hizmetleri" description="Yayımlanan paketleri ve anlaşmalarda sabitlenen ticari/yetki snapshot'larını inceleyin." /> : null}

    <Card className="mb-5">
      <CardHeader><CardTitle className="flex items-center gap-2"><Package className="size-5" /> Hizmet Paketleri</CardTitle><CardToolbar><select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={packageStatus} onChange={(event) => setPackageStatus(event.target.value)}><option value="">Tüm durumlar</option><option value="draft">Taslak</option><option value="published">Yayında</option><option value="archived">Arşiv</option></select></CardToolbar></CardHeader>
      <CardContent className="p-0">
        {packageError ? <div className="p-4"><Alert variant="destructive"><AlertTitle>Paketler yüklenemedi</AlertTitle><AlertDescription>{packageError.normalizedMessage || 'Beklenmeyen hata.'}</AlertDescription></Alert></div> : packagesLoading ? <SkeletonRows rows={4} cols={7} /> : packages.length === 0 ? <EmptyState title="Paket yok" description="Seçili filtreyle eşleşen hizmet paketi bulunamadı." /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Partner firma</TableHead><TableHead>Paket</TableHead><TableHead>Alanlar</TableHead><TableHead>Fiyat</TableHead><TableHead>Yetki</TableHead><TableHead>Durum / Revizyon</TableHead><TableHead className="text-right">İşlem</TableHead></TableRow></TableHeader><TableBody>{packages.map((item) => <TableRow key={item.id || item._id}><TableCell>{item.partnerCompanyName}</TableCell><TableCell><p className="font-medium">{item.name}</p><p className="max-w-72 truncate text-xs text-muted-foreground">{item.description}</p></TableCell><TableCell><div className="flex max-w-64 flex-wrap gap-1">{item.serviceAreas?.map((area) => <Badge key={area} variant="muted">{area}</Badge>)}</div></TableCell><TableCell>{money(item.pricing)}{item.pricing?.type === 'monthly' ? '/ay' : ''}</TableCell><TableCell>{item.permissionTemplate?.length || 0}</TableCell><TableCell><Badge variant={statusVariant[item.status] || 'muted'}>{item.status}</Badge><span className="ms-2 text-xs text-muted-foreground">v{item.revision}</span></TableCell><TableCell className="text-right">{item.status !== 'archived' ? <Button size="sm" variant="outline" disabled={archiving} onClick={() => handleArchive(item)}><Archive className="size-4" /> Arşivle</Button> : '—'}</TableCell></TableRow>)}</TableBody></Table></div>}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" /> Hizmet Anlaşmaları</CardTitle><CardToolbar><select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={agreementStatus} onChange={(event) => setAgreementStatus(event.target.value)}><option value="">Tüm durumlar</option><option value="requested">Talep</option><option value="active">Aktif</option><option value="termination_scheduled">Fesih planlı</option><option value="suspended">Askıda</option><option value="terminated">Sona ermiş</option></select></CardToolbar></CardHeader>
      <CardContent className="p-0">
        {agreementError ? <div className="p-4"><Alert variant="destructive"><AlertTitle>Anlaşmalar yüklenemedi</AlertTitle><AlertDescription>{agreementError.normalizedMessage || 'Beklenmeyen hata.'}</AlertDescription></Alert></div> : agreementsLoading ? <SkeletonRows rows={4} cols={6} /> : agreements.length === 0 ? <EmptyState title="Anlaşma yok" description="Seçili filtreyle eşleşen anlaşma bulunamadı." /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Müşteri</TableHead><TableHead>Partner</TableHead><TableHead>Snapshot</TableHead><TableHead>Fiyat</TableHead><TableHead>Durum</TableHead><TableHead>İki taraflı kabul</TableHead></TableRow></TableHeader><TableBody>{agreements.map((item) => { const snapshot = item.amendments?.at(-1)?.snapshot || item.snapshot; return <TableRow key={item.id || item._id}><TableCell>{item.customerCompanyName}</TableCell><TableCell>{item.partnerCompanyName}</TableCell><TableCell><details><summary className="cursor-pointer font-medium">{snapshot?.name || 'Paket'} · v{snapshot?.revision}</summary><div className="mt-2 max-w-xl space-y-2 text-xs text-muted-foreground"><p>Teslimatlar: {snapshot?.deliverables?.join(' · ') || '—'}</p><p>Temsilciler: {snapshot?.representativeIds?.length || 0}</p><p className="break-all">Yetkiler: {snapshot?.permissions?.join(', ') || '—'}</p></div></details></TableCell><TableCell>{money(snapshot?.pricing)}</TableCell><TableCell><Badge variant={statusVariant[item.status] || 'muted'}>{item.status}</Badge></TableCell><TableCell>{item.customerAcceptance?.acceptedAt ? 'Müşteri ✓' : 'Müşteri —'} · {item.partnerAcceptance?.acceptedAt ? 'Partner ✓' : 'Partner —'}</TableCell></TableRow>; })}</TableBody></Table></div>}
      </CardContent>
    </Card>
  </RoleGuard>;
}
