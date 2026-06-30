'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useDeleteMailCampaignMutation, useGetMailCampaignsQuery } from '@/redux/services';

const statusMeta = {
  draft: { label: 'Taslak', variant: 'secondary' },
  queued: { label: 'Kuyrukta', variant: 'primary' },
  sending: { label: 'Gönderiliyor', variant: 'primary' },
  sent: { label: 'Gönderildi', variant: 'success' },
  partial: { label: 'Kısmi', variant: 'warning' },
  failed: { label: 'Başarısız', variant: 'destructive' },
  paused: { label: 'Duraklatıldı', variant: 'warning' },
};

const numberFormatter = new Intl.NumberFormat('tr-TR');
const formatCount = (value) => numberFormatter.format(Number(value) || 0);
const getProgress = (campaign) => {
  const audience = campaign.audience || {};
  const progress = campaign.progress || {};
  const total = Number(progress.total ?? audience.total ?? 0) || 0;
  const sent = Number(progress.sent ?? audience.sentCount ?? 0) || 0;
  const failed = Number(progress.failed ?? audience.failedCount ?? 0) || 0;
  const pending = Math.max(Number(progress.pending ?? progress.queued ?? audience.queuedCount ?? total - sent - failed) || 0, 0);
  const done = sent + failed;
  return {
    total,
    sent,
    failed,
    pending,
    percent: total ? Math.min(100, Math.round((done / total) * 100)) : 0,
  };
};

export default function CampaignsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const [notice, setNotice] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const {
    data: campaigns = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetMailCampaignsQuery({}, { skip: !authorized });
  const [deleteCampaign, { isLoading: deleting }] = useDeleteMailCampaignMutation();

  const handleRefresh = async () => {
    await refetch();
    setNotice({ variant: 'info', message: 'Kampanya durumları yenilendi.' });
  };

  const handleDelete = async (campaign) => {
    const result = await deleteCampaign(campaign._id)
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Kampanya kaldırılamadı.' }));
    setConfirmId(null);
    if (result?.__err) {
      setNotice({ variant: 'destructive', message: result.__err });
      return;
    }
    setNotice({ variant: 'info', message: result?.message || 'Taslak kampanya silindi.' });
  };

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

      {notice?.message && (
        <Alert variant={notice.variant || 'info'} className="mb-4">
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Kampanyalar</CardTitle>
          <CardToolbar className="gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
              {isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Yenile
            </Button>
            <Badge variant="muted">{campaigns.length}</Badge>
          </CardToolbar>
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
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => {
                  const m = statusMeta[c.status] || { label: c.status, variant: 'muted' };
                  const progress = getProgress(c);
                  return (
                    <TableRow key={c._id}>
                      <TableCell className="font-medium">
                        <Link href={`/cms/email/campaigns/${c._id}`} className="text-primary hover:underline">{c.name}</Link>
                      </TableCell>
                      <TableCell><span className="font-mono text-xs">{c.channelKey}</span></TableCell>
                      <TableCell><Badge variant={m.variant}>{m.label}</Badge></TableCell>
                      <TableCell className="min-w-[220px]">
                        {progress.total ? (
                          <div className="space-y-1.5">
                            <Progress value={progress.percent} indicatorClassName={progress.failed ? 'bg-amber-500' : undefined} />
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{formatCount(progress.sent)}/{formatCount(progress.total)}</span>
                              {progress.pending > 0 && <span>Kuyrukta {formatCount(progress.pending)}</span>}
                              {progress.failed > 0 && <span className="text-destructive">{formatCount(progress.failed)} hata</span>}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.status === 'draft' ? (
                          confirmId === c._id ? (
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(c)} disabled={deleting}>
                              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : 'Emin?'}
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setConfirmId(c._id)} title="Taslağı kaldır">
                              <Trash2 className="size-3.5" />
                            </Button>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
