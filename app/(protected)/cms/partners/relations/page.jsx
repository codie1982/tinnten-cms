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

export default function CompanyPartnerRelationsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const [actionError, setActionError] = useState('');
  const { data, isLoading, isFetching, error } = useGetPendingCompanyPartnerRelationsQuery(
    {},
    { skip: !authorized },
  );
  const [decide, { isLoading: deciding }] = useDecideCompanyPartnerRelationMutation();
  const items = data?.items ?? [];

  const handleDecision = async (relation, decision) => {
    setActionError('');
    const id = relation.id || relation._id;
    if (decision === 'reject' && !window.confirm('Bu partner ilişkisini reddetmek istiyor musunuz?')) return;
    try {
      await decide({ id, decision }).unwrap();
    } catch (requestError) {
      setActionError(
        requestError?.data?.message ||
          requestError?.normalizedMessage ||
          'Partner ilişkisi güncellenemedi.',
      );
    }
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Partnerler"
        title="Firma Partner Onayları"
        description="Kullanıcı partner uygunluğundan ayrı olarak her firma–partner ilişkisini onaylayın."
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
                        <TableCell><CapabilityBadges capabilities={capabilities} /></TableCell>
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
    </RoleGuard>
  );
}
