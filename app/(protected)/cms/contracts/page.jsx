'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Plus, FileSignature } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useGetAgreementsQuery } from '@/redux/services';

function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ContractsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data: items = [], isLoading, error } = useGetAgreementsQuery({ locale: 'tr' }, { skip: !authorized });
  const isEmpty = !isLoading && !error && items.length === 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Sözleşmeler"
        title="Sözleşmeler"
        description="Sözleşmeleri yönetin: içerik, versiyonlama ve onaylayanlar"
        actions={
          <Link href="/cms/contracts/new" className={buttonVariants()}>
            <Plus className="size-4" />
            Yeni Sözleşme
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Sözleşme Listesi</CardTitle>
          <CardToolbar><Badge variant="muted">{items.length} sözleşme</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Sözleşmeler yüklenemedi</AlertTitle>
                <AlertDescription>{error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}</AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <FileSignature className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Sözleşme yok</p>
              <p className="text-sm text-muted-foreground">Yeni bir sözleşme oluşturabilirsiniz.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sözleşme</TableHead>
                    <TableHead>Son Versiyon</TableHead>
                    <TableHead>Versiyon Sayısı</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Güncellenme</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a) => (
                    <TableRow key={a.slug}>
                      <TableCell>
                        <Link href={`/cms/contracts/${a.slug}`} className="text-sm font-medium text-foreground hover:text-primary">
                          {a.title}
                        </Link>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{a.slug}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{a.latestVersion ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.versionCount}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {a.status === 'public' ? <Badge variant="success">Yayında</Badge> : <Badge variant="muted">Taslak</Badge>}
                          {a.hasDraft && a.status === 'public' && <Badge variant="warning">Taslak var</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTrDate(a.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
