'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Check, Trash2, X } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState, SkeletonRows } from '@/components/layout/page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useDecideCompanyPartnerRelationMutation,
  useGetCompanyPartnerRevenueSharePreviewQuery,
  useGetPendingCompanyPartnerRelationsQuery,
  useRemoveCompanyPartnerRelationMutation,
  useUpdateCompanyPartnerCapabilitiesMutation,
} from '@/redux/services';

const STATUS = {
  pending_partner_approval: ['Partner firma onayı bekliyor', 'warning'],
  pending_relationship_approval: ['İlişki onayı bekliyor', 'primary'],
  active: ['Aktif', 'success'],
  rejected: ['Reddedildi', 'destructive'],
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('tr-TR');
};

function CapabilityBadges({ capabilities }) {
  return (
    <div className="flex flex-wrap gap-1">
      {capabilities?.canManageAccount ? <Badge variant="primary">Hesap yönetimi</Badge> : null}
      {capabilities?.canEarnRevenue ? <Badge variant="success">Gelir ortağı</Badge> : null}
    </div>
  );
}

const formatMoney = (value, currency = 'USD') => new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

function RevenueChoice({
  checked,
  percent,
  costPercent,
  commissionSummary = [],
  disabled,
  onChange,
  onPercentChange,
  onCostPercentChange,
}) {
  const parsedPercent = Number(percent);
  const parsedCostPercent = Number(costPercent);
  const validPercent = Number.isFinite(parsedPercent) && parsedPercent > 0 && parsedPercent <= 100;
  const validCostPercent = Number.isFinite(parsedCostPercent) && parsedCostPercent >= 0 && parsedCostPercent <= 100;
  const { data: previewData } = useGetCompanyPartnerRevenueSharePreviewQuery(
    {
      commissionPercent: parsedPercent,
      costPercent: parsedCostPercent,
      grossAmount: 1000,
      currency: 'USD',
    },
    { skip: !checked || !validPercent || !validCostPercent },
  );
  const preview = previewData?.preview;

  return (
    <div className="mt-2 min-w-56 space-y-2">
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 accent-primary"
        />
        Gelir ortağı
      </label>
      {checked ? (
        <>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Maliyet oranı
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={costPercent}
              disabled={disabled}
              onChange={(event) => onCostPercentChange(event.target.value)}
              className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              aria-label="Net gelir maliyet oranı"
            />
            <span>%</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Kâr komisyonu
            <input
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={percent}
              disabled={disabled}
              onChange={(event) => onPercentChange(event.target.value)}
              className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              aria-label="Net kâr komisyon oranı"
            />
            <span>%</span>
          </label>
          {!validPercent ? (
            <p className="text-xs text-destructive">Komisyon oranı 0 ile 100 arasında olmalıdır.</p>
          ) : !validCostPercent ? (
            <p className="text-xs text-destructive">Maliyet oranı 0 ile 100 arasında olmalıdır.</p>
          ) : preview ? (
            <p className="max-w-xs text-xs leading-5 text-muted-foreground">
              1.000 USD örneği: dağıtılabilir net kâr {formatMoney(preview.distributableProfit, preview.currency)};
              partner payı {formatMoney(preview.partnerCommission, preview.currency)}. Hakediş yalnız başarılı Stripe faturasında oluşur.
            </p>
          ) : null}
        </>
      ) : null}
      {commissionSummary.length ? (
        <div className="flex flex-wrap gap-1">
          {commissionSummary.map((summary) => (
            <Badge key={summary.currency} variant="success">
              Hakediş: {formatMoney(summary.payable, summary.currency)}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CompanyPartnerRelationsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [revenueSelections, setRevenueSelections] = useState({});
  const [revenueRateSelections, setRevenueRateSelections] = useState({});
  const [revenueCostSelections, setRevenueCostSelections] = useState({});
  const { data, isLoading, isFetching, error } = useGetPendingCompanyPartnerRelationsQuery(
    {},
    { skip: !authorized },
  );
  const {
    data: activeData,
    isLoading: activeLoading,
    isFetching: activeFetching,
    error: activeError,
  } = useGetPendingCompanyPartnerRelationsQuery(
    { status: 'active' },
    { skip: !authorized },
  );
  const [decide, { isLoading: deciding }] = useDecideCompanyPartnerRelationMutation();
  const [updateCapabilities, { isLoading: updatingCapabilities }] = useUpdateCompanyPartnerCapabilitiesMutation();
  const [removeRelation, { isLoading: removingRelation }] = useRemoveCompanyPartnerRelationMutation();
  const items = data?.items ?? [];
  const activeItems = activeData?.items ?? [];

  const relationRevenueValue = (relation) => {
    const id = relation.id || relation._id;
    return revenueSelections[id] ?? Boolean(
      (relation.pendingCapabilities || relation.capabilities)?.canEarnRevenue,
    );
  };

  const setRelationRevenueValue = (relation, value) => {
    const id = relation.id || relation._id;
    setRevenueSelections((current) => ({ ...current, [id]: value }));
  };

  const relationRevenueRate = (relation) => {
    const id = relation.id || relation._id;
    return revenueRateSelections[id] ?? String(relation.revenueShare?.percent || 20);
  };

  const setRelationRevenueRate = (relation, value) => {
    const id = relation.id || relation._id;
    setRevenueRateSelections((current) => ({ ...current, [id]: value }));
  };

  const relationRevenueCost = (relation) => {
    const id = relation.id || relation._id;
    return revenueCostSelections[id] ?? String(relation.revenueShare?.costPercent ?? 20);
  };

  const setRelationRevenueCost = (relation, value) => {
    const id = relation.id || relation._id;
    setRevenueCostSelections((current) => ({ ...current, [id]: value }));
  };

  const revenueSharePercentFor = (relation) => {
    if (!relationRevenueValue(relation)) return 0;
    const percent = Number(relationRevenueRate(relation));
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      setActionError('Gelir ortaklığı için komisyon oranı 0 ile 100 arasında olmalıdır.');
      return null;
    }
    return percent;
  };

  const revenueShareCostPercentFor = (relation) => {
    const percent = Number(relationRevenueCost(relation));
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setActionError('Maliyet oranı 0 ile 100 arasında olmalıdır.');
      return null;
    }
    return percent;
  };

  const handleDecision = async (relation, decision) => {
    setActionError('');
    setActionSuccess('');
    const id = relation.id || relation._id;
    if (decision === 'reject' && !window.confirm('Bu partner ilişkisini reddetmek istiyor musunuz?')) return;
    try {
      const revenueSharePercent = decision === 'approve' ? revenueSharePercentFor(relation) : undefined;
      const revenueShareCostPercent = decision === 'approve' ? revenueShareCostPercentFor(relation) : undefined;
      if (decision === 'approve' && (revenueSharePercent === null || revenueShareCostPercent === null)) return;
      await decide({
        id,
        decision,
        ...(decision === 'approve'
          ? {
              capabilities: {
                canManageAccount: true,
                canEarnRevenue: relationRevenueValue(relation),
              },
              revenueSharePercent,
              revenueShareCostPercent,
            }
          : {}),
      }).unwrap();
      setRevenueSelections((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setRevenueRateSelections((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setRevenueCostSelections((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } catch (requestError) {
      setActionError(
        requestError?.data?.message ||
          requestError?.normalizedMessage ||
          'Partner ilişkisi güncellenemedi.',
      );
    }
  };

  const handleRevenueUpdate = async (relation) => {
    setActionError('');
    setActionSuccess('');
    const id = relation.id || relation._id;
    try {
      const revenueSharePercent = revenueSharePercentFor(relation);
      const revenueShareCostPercent = revenueShareCostPercentFor(relation);
      if (revenueSharePercent === null || revenueShareCostPercent === null) return;
      await updateCapabilities({
        id,
        canEarnRevenue: relationRevenueValue(relation),
        revenueSharePercent,
        revenueShareCostPercent,
      }).unwrap();
      setRevenueSelections((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setRevenueRateSelections((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setRevenueCostSelections((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } catch (requestError) {
      setActionError(
        requestError?.data?.message ||
          requestError?.normalizedMessage ||
          'Gelir ortaklığı güncellenemedi.',
      );
    }
  };

  const handleRemove = async (relation) => {
    setActionError('');
    setActionSuccess('');
    const id = relation.id || relation._id;
    const partnerName = relation.partnerCompany?.name || relation.externalCompanyName || 'Bu partner';
    const targetName = relation.company?.name || 'hedef firma';
    if (!window.confirm(
      `${partnerName} ile ${targetName} arasındaki partnerliği kaldırmak istiyor musunuz? ` +
      'Partner temsilcilerin hesap erişimi hemen kapatılacak; geçmiş kayıt silinmeyecek.',
    )) return;
    try {
      await removeRelation({ id }).unwrap();
      setRevenueSelections((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setRevenueRateSelections((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setRevenueCostSelections((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setActionSuccess('Partnerlik kaldırıldı ve partner hesap erişimleri kapatıldı.');
    } catch (requestError) {
      setActionError(
        requestError?.data?.message ||
          requestError?.normalizedMessage ||
          'Partnerlik kaldırılamadı.',
      );
    }
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Partnerler"
        title="Firma Partner Onayları"
        description="Firma–partner ilişkilerini onaylayın ve gelir ortaklığını yalnızca CMS üzerinden yönetin."
      />

      {actionError ? (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>İşlem tamamlanamadı</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {actionSuccess ? (
        <Alert className="mb-5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
          <AlertTitle>İşlem tamamlandı</AlertTitle>
          <AlertDescription>{actionSuccess}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Bekleyen İlişkiler</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{isFetching ? 'Yükleniyor…' : `${items.length} kayıt`}</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>İlişkiler yüklenemedi</AlertTitle>
                <AlertDescription>
                  {error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}
                </AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <SkeletonRows rows={5} cols={6} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Bekleyen partner ilişkisi yok"
              description="Yeni kabul veya yetenek değişikliği talepleri burada görünür."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner Firma</TableHead>
                    <TableHead>Hedef firma</TableHead>
                    <TableHead>Yetenekler</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Güncelleme</TableHead>
                    <TableHead className="text-right">Karar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((relation) => {
                    const id = relation.id || relation._id;
                    const [statusLabel, statusVariant] = STATUS[relation.status] || [relation.status, 'muted'];
                    const capabilities = relation.pendingCapabilities || relation.capabilities;
                    const canApprove = relation.status === 'pending_relationship_approval' || relation.amendmentStatus === 'pending';
                    return (
                      <TableRow key={id}>
                        <TableCell>
                          <p className="font-medium">
                            {relation.partnerCompany?.name || relation.externalCompanyName || 'Firma seçimi bekleniyor'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(relation.members || []).filter((member) => member.active !== false).length} aktif temsilci
                          </p>
                          {relation.partnerCompany?.partner ? (
                            <Badge variant="success" className="mt-1">Firma partner onaylı</Badge>
                          ) : (
                            <Badge variant="warning" className="mt-1">Firma partner onayı gerekli</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{relation.company?.name || relation.companyId}</p>
                          {relation.partnerCompany?.name || relation.externalCompanyName ? (
                            <p className="text-xs text-muted-foreground">
                              Partner firma: {relation.partnerCompany?.name || relation.externalCompanyName}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <CapabilityBadges capabilities={{ ...capabilities, canManageAccount: true }} />
                          <RevenueChoice
                            checked={relationRevenueValue(relation)}
                            percent={relationRevenueRate(relation)}
                            costPercent={relationRevenueCost(relation)}
                            disabled={deciding}
                            onChange={(value) => setRelationRevenueValue(relation, value)}
                            onPercentChange={(value) => setRelationRevenueRate(relation, value)}
                            onCostPercentChange={(value) => setRelationRevenueCost(relation, value)}
                          />
                        </TableCell>
                        <TableCell><Badge variant={statusVariant}>{statusLabel}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(relation.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={deciding || !canApprove}
                              onClick={() => handleDecision(relation, 'approve')}
                            >
                              <Check className="size-4" /> Onayla
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={deciding}
                              onClick={() => handleDecision(relation, 'reject')}
                            >
                              <X className="size-4" /> Reddet
                            </Button>
                          </div>
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Aktif Partnerler</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{activeFetching ? 'Yükleniyor…' : `${activeItems.length} kayıt`}</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          {activeError ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Aktif partnerler yüklenemedi</AlertTitle>
                <AlertDescription>
                  {activeError?.data?.message || activeError?.normalizedMessage || 'Sunucuya ulaşılamadı.'}
                </AlertDescription>
              </Alert>
            </div>
          ) : activeLoading ? (
            <SkeletonRows rows={5} cols={5} />
          ) : activeItems.length === 0 ? (
            <EmptyState title="Aktif partner yok" description="Onaylanan partnerler burada görünür." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner Firma</TableHead>
                    <TableHead>Hedef firma</TableHead>
                    <TableHead>Hesap erişimi</TableHead>
                    <TableHead>Gelir ortaklığı</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeItems.map((relation) => {
                    const id = relation.id || relation._id;
                    return (
                      <TableRow key={id}>
                        <TableCell>
                          <p className="font-medium">
                            {relation.partnerCompany?.name || relation.externalCompanyName || '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(relation.members || [])
                              .filter((member) => member.active !== false)
                              .map((member) => member.user?.name || member.user?.email)
                              .filter(Boolean)
                              .join(', ') || 'Temsilci yok'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{relation.company?.name || relation.companyId}</p>
                        </TableCell>
                        <TableCell><Badge variant="primary">Hesap yönetimi</Badge></TableCell>
                        <TableCell>
                          <RevenueChoice
                            checked={relationRevenueValue(relation)}
                            percent={relationRevenueRate(relation)}
                            costPercent={relationRevenueCost(relation)}
                            commissionSummary={relation.commissionSummary}
                            disabled={updatingCapabilities || removingRelation}
                            onChange={(value) => setRelationRevenueValue(relation, value)}
                            onPercentChange={(value) => setRelationRevenueRate(relation, value)}
                            onCostPercentChange={(value) => setRelationRevenueCost(relation, value)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={updatingCapabilities || removingRelation}
                              onClick={() => handleRevenueUpdate(relation)}
                            >
                              Kaydet
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={updatingCapabilities || removingRelation}
                              onClick={() => handleRemove(relation)}
                            >
                              <Trash2 className="size-4" /> Partnerliği kaldır
                            </Button>
                          </div>
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
    </RoleGuard>
  );
}
