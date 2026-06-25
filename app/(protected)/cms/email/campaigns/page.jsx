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
import { useGetMailCampaignsQuery } from '@/redux/services';

const statusMeta = {
  draft: { label: 'Taslak', variant: 'secondary' },
  queued: { label: 'Kuyrukta', variant: 'primary' },
  sending: { label: 'Gönderiliyor', variant: 'primary' },
  sent: { label: 'Gönderildi', variant: 'success' },
  partial: { label: 'Kısmi', variant: 'warning' },
  failed: { label: 'Başarısız', variant: 'destructive' },
  paused: { label: 'Duraklatıldı', variant: 'warning' },
};

export default function CampaignsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const { data: campaigns = [], isLoading, error } = useGetMailCampaignsQuery({}, { skip: !authorized });

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Kampanyalar"
        description="Kanal + şablon seçip onaylı kullanıcılara toplu mail gönderin"
        actions={
          <Link href="/cms/email/campaigns/new">
            <Button><Plus className="size-4" /> Yeni Kampanya</Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Kampanyalar</CardTitle>
          <CardToolbar><Badge variant="muted">{campaigns.length}</Badge></CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription></Alert></div>
          ) : isLoading ? (
            <div className="space-y-1 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : campaigns.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Henüz kampanya yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İlerleme</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => {
                  const m = statusMeta[c.status] || { label: c.status, variant: 'muted' };
                  const a = c.audience || {};
                  return (
                    <TableRow key={c._id}>
                      <TableCell className="font-medium">
                        <Link href={`/cms/email/campaigns/${c._id}`} className="text-primary hover:underline">{c.name}</Link>
                      </TableCell>
                      <TableCell><span className="font-mono text-xs">{c.channelKey}</span></TableCell>
                      <TableCell><Badge variant={m.variant}>{m.label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.total ? `${a.sentCount || 0}/${a.total}${a.failedCount ? ` (${a.failedCount} hata)` : ''}` : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
