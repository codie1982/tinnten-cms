'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Plus } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useGetMergeDefsQuery } from '@/redux/services';

const statusVariant = (s) => (s === 'active' ? 'success' : 'muted');

export default function MergeVariablesPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data: defs = [], isLoading, error } = useGetMergeDefsQuery(
    { all: 'true' },
    { skip: !authorized },
  );

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Değişkenler"
        description="Kampanya maillerinde kullanılan dinamik {{TOKEN}} değişkenleri — değer alıcı bazında DB'den çözülür"
        actions={
          <Link href="/cms/email/merge-variables/new">
            <Button>
              <Plus className="size-4" /> Yeni Değişken
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Değişken Kataloğu</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{defs.length}</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Yüklenemedi</AlertTitle>
                <AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-1 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : defs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Henüz değişken yok. “Yeni Değişken” ile ekleyin.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Etiket</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Fallback</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defs.map((d) => (
                  <TableRow key={d._id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/cms/email/merge-variables/${d._id}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {`{{${d.token}}}`}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{d.label}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {d.sourceKey}.{d.fieldKey}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.fallback || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
