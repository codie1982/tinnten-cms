'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, Trash2, Loader2, ArrowLeft, UserPlus } from 'lucide-react';
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
  useAddChannelMembersMutation,
  useRemoveChannelMemberMutation,
} from '@/redux/services';

const PAGE = 50;
const isManualList = (channel) => channel?.type === 'custom' || channel?.type === 'private';

export default function ChannelMembersPage() {
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

  const [addMembers, { isLoading: adding }] = useAddChannelMembersMutation();
  const [removeMember] = useRemoveChannelMemberMutation();

  const [bulk, setBulk] = useState('');
  const [notice, setNotice] = useState('');

  const handleAdd = async () => {
    const emails = bulk
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!emails.length) return;
    const r = await addMembers({ key, emails }).unwrap().catch((e) => ({ __err: e?.data?.message || 'Eklenemedi' }));
    if (r?.__err) return setNotice(r.__err);
    setBulk('');
    setNotice(`${r?.added ?? 0} üye eklendi.${r?.failed?.length ? ` ${r.failed.length} başarısız.` : ''}`);
  };

  const handleRemove = async (email) => {
    await removeMember({ key, email }).unwrap().catch((e) => setNotice(e?.data?.message || 'Çıkarılamadı'));
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        breadcrumb={[
          { label: 'Email' },
          { label: 'Mail Listeleri', href: '/cms/email/lists' },
          { label: 'Kanal Listeleri', href: '/cms/email/lists/channels' },
          { label: String(key) },
        ]}
        title={`Liste Üyeleri: ${key}`}
        description={canEditMembers ? 'Bu kullanıcı listesine bağlı alıcılar' : 'Bu liste kaynak akış tarafından güncellenir'}
        actions={
          <Link href="/cms/email/lists/channels">
            <Button variant="outline">
              <ArrowLeft className="size-4" /> Listeler
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
        {/* Üye ekle */}
        {canEditMembers && (
          <Card className="lg:sticky lg:top-4 lg:self-start">
            <CardHeader>
              <CardTitle>
                <UserPlus className="mr-1 inline size-4" /> Üye Ekle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <label className="block text-xs text-muted-foreground">
                E-posta(lar) — virgül, boşluk veya satırla ayırın (toplu)
              </label>
              <textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                rows={8}
                placeholder={'engin_erol@hotmail.com\nuser2@example.com'}
                className="w-full resize-y rounded-lg border border-input bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/30"
              />
              <Button onClick={handleAdd} disabled={adding || !bulk.trim()} className="w-full">
                {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Ekle
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Sadece doğrulanmış/onaylı kullanıcı adresleri eklenmeli (SES itibarı).
              </p>
            </CardContent>
          </Card>
        )}

        {/* Üye listesi */}
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
              <p className="py-10 text-center text-sm text-muted-foreground">Bu kanalda üye yok.</p>
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
