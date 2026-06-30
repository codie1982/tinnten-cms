'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Trash2, Loader2, ArrowLeft } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetMailChannelsQuery,
  useGetChannelMembersQuery,
  useRemoveChannelMemberMutation,
} from '@/redux/services';
import { AddMembersPanel } from '@/components/email/add-members-panel';

const PAGE = 50;
const isManualList = (channel) => channel?.type === 'custom' || channel?.type === 'private';

export default function ListMembersPage() {
  const { key } = useParams();
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const { data: channels = [] } = useGetMailChannelsQuery({ all: 'true' }, { skip: !authorized });
  const channel = channels.find((ch) => ch.key === String(key || '').toLowerCase());
  const canEditMembers = isManualList(channel);

  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState('');
  const { data, isLoading, error, isFetching } = useGetChannelMembersQuery(
    { key, limit: PAGE, skip, q },
    { skip: !authorized || !key },
  );
  const members = data?.items ?? [];

  const [removeMember] = useRemoveChannelMemberMutation();
  const [notice, setNotice] = useState('');

  const handleRemove = async (email) => {
    await removeMember({ key, email }).unwrap().catch((e) => setNotice(e?.data?.message || 'Çıkarılamadı'));
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        breadcrumb={[
          { label: 'Email' },
          { label: 'Mail Listeleri', href: '/cms/email/lists' },
          { label: channel?.title || String(key) },
        ]}
        title={channel?.title || String(key)}
        description={canEditMembers ? 'Bu kullanıcı listesine bağlı alıcılar' : 'Bu liste kaynak akış tarafından güncellenir'}
        actions={
          <Link href="/cms/email/lists">
            <Button variant="outline">
              <ArrowLeft className="size-4" /> Mail Listeleri
            </Button>
          </Link>
        }
      />

      {notice && (
        <Alert variant="info" className="mb-4">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <div className={canEditMembers ? 'grid gap-5 lg:grid-cols-[340px_1fr]' : 'space-y-5'}>
        {canEditMembers && (
          <AddMembersPanel
            channelKey={key}
            authorized={authorized}
            note="Sadece doğrulanmış/onaylı kullanıcı adresleri eklenmeli (SES itibarı)."
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Üyeler</CardTitle>
            <CardToolbar className="gap-2">
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSkip(0);
                }}
                placeholder="E-posta ara…"
                className="h-8 w-48"
              />
              {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
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
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Bu listede üye yok.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-posta</TableHead>
                      <TableHead>Ad</TableHead>
                      <TableHead>Durum</TableHead>
                      {canEditMembers && <TableHead className="text-right">İşlem</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m._id || m.email}>
                        <TableCell className="font-mono text-xs">{m.email}</TableCell>
                        <TableCell>{m.profile?.name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={m.status === 'active' ? 'success' : 'destructive'}>{m.status}</Badge>
                        </TableCell>
                        {canEditMembers && (
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => handleRemove(m.email)} title="Çıkar">
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                  <span className="text-muted-foreground">{skip + 1}–{skip + members.length}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>
                      Önceki
                    </Button>
                    <Button size="sm" variant="outline" disabled={members.length < PAGE} onClick={() => setSkip(skip + PAGE)}>
                      Sonraki
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
