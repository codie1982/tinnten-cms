'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Check, X } from 'lucide-react';
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
  useGetPendingCompanyPartnerRelationsQuery,
  useUpdateCompanyPartnerCapabilitiesMutation,
} from '@/redux/services';

const STATUS = {
  pending_partner_approval: ['Kullanıcı partner onayı bekliyor', 'warning'],
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

function RevenueChoice({ checked, disabled, onChange }) {
  return (
    <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-medium">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary"
      />
      Gelir ortağı
    </label>
  );
}

export default function CompanyPartnerRelationsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const [actionError, setActionError] = useState('');
  const [revenueSelections, setRevenueSelections] = useState({});
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

  const handleDecision = async (relation, decision) => {
    setActionError('');
    const id = relation.id || relation._id;
    if (decision === 'reject' && !window.confirm('Bu partner ilişkisini reddetmek istiyor musunuz?')) return;
    try {
      await decide({
        id,
        decision,
        ...(decision === 'approve'
          ? {
              capabilities: {
                canManageAccount: true,
                canEarnRevenue: relationRevenueValue(relation),
              },
            }
          : {}),
      }).unwrap();
      setRevenueSelections((current) => {
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
    const id = relation.id || relation._id;
    try {
      await updateCapabilities({
        id,
        canEarnRevenue: relationRevenueValue(relation),
      }).unwrap();
      setRevenueSelections((current) => {
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
                    <TableHead>Partner</TableHead>
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
                          <p className="font-medium">{relation.user?.name || relation.emailNormalized}</p>
                          <p className="text-xs text-muted-foreground">{relation.user?.email || relation.emailNormalized}</p>
                          {relation.user?.partner ? (
                            <Badge variant="success" className="mt-1">Partner onaylı</Badge>
                          ) : (
                            <Badge variant="warning" className="mt-1">Partner onayı gerekli</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{relation.company?.name || relation.companyId}</p>
                          {relation.partnerCompany?.name || relation.externalCompanyName ? (
                            <p className="text-xs text-muted-foreground">
                              Temsil edilen: {relation.partnerCompany?.name || relation.externalCompanyName}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <CapabilityBadges capabilities={{ ...capabilities, canManageAccount: true }} />
                          <RevenueChoice
                            checked={relationRevenueValue(relation)}
                            disabled={deciding}
                            onChange={(value) => setRelationRevenueValue(relation, value)}
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
                    <TableHead>Partner</TableHead>
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
                          <p className="font-medium">{relation.user?.name || relation.emailNormalized}</p>
                          <p className="text-xs text-muted-foreground">{relation.user?.email || relation.emailNormalized}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{relation.company?.name || relation.companyId}</p>
                        </TableCell>
                        <TableCell><Badge variant="primary">Hesap yönetimi</Badge></TableCell>
                        <TableCell>
                          <RevenueChoice
                            checked={relationRevenueValue(relation)}
                            disabled={updatingCapabilities}
                            onChange={(value) => setRelationRevenueValue(relation, value)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            disabled={updatingCapabilities}
                            onClick={() => handleRevenueUpdate(relation)}
                          >
                            Kaydet
                          </Button>
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
