'use client';

import { useSession } from 'next-auth/react';
import { Wrench } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useGetToolDefinitionsQuery } from '@/redux/services';

export default function SettingsToolsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const { data: tools = [], isLoading, error } = useGetToolDefinitionsQuery(undefined, { skip: !authorized });
  const isEmpty = !isLoading && !error && tools.length === 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Sistem Ayarları"
        title="Tool Listesi"
        description="Sistemdeki genel (global) tool tanımları"
      />

      <Card>
        <CardHeader>
          <CardTitle>Genel Tool'lar</CardTitle>
          <CardToolbar><Badge variant="muted">{tools.length} tool</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Tool'lar yüklenemedi</AlertTitle>
                <AlertDescription>{error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}</AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6" />)}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Wrench className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Tool tanımı yok</p>
              <p className="text-sm text-muted-foreground">Genel tool tanımı bulunmuyor.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Etiket</TableHead>
                    <TableHead>Anahtar Kelime</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Wrench className="size-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{t.tool}</span>
                        </div>
                        {t.description && (
                          <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted-foreground">{t.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{t.key}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.userLabel || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.keywords?.length ?? 0}</TableCell>
                      <TableCell>
                        {t.active ? <Badge variant="success">Aktif</Badge> : <Badge variant="muted">Pasif</Badge>}
                      </TableCell>
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
