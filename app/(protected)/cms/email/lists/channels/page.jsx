'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Plus, Users, Archive, ArchiveRestore, Trash2, Loader2, Lock } from 'lucide-react';
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
  useCreateMailChannelMutation,
  useUpdateMailChannelMutation,
  useDeleteMailChannelMutation,
} from '@/redux/services';

const TYPE_ORDER = {
  general: 1,
  news_content: 2,
  cron: 3,
  custom: 4,
  private: 5,
};

const TYPE_META = {
  general: { label: 'Genel', variant: 'primary' },
  news_content: { label: 'Haber', variant: 'success' },
  cron: { label: 'Cron', variant: 'warning' },
  custom: { label: 'Kullanıcı Listesi', variant: 'secondary' },
  private: { label: 'Gizli Kullanıcı Listesi', variant: 'muted' },
};

const STATUS_META = {
  active: { label: 'Aktif', variant: 'success' },
  archived: { label: 'Arşiv', variant: 'muted' },
};

function typeMeta(type) {
  return TYPE_META[type] || { label: type || '—', variant: 'muted' };
}

function statusMeta(status) {
  return STATUS_META[status] || { label: status || '—', variant: 'muted' };
}

function canManageChannel(channel) {
  return channel.type === 'custom' || channel.type === 'private';
}

export default function MailChannelsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data: channels = [], isLoading, error } = useGetMailChannelsQuery(
    { all: 'true' },
    { skip: !authorized },
  );
  const [createChannel, { isLoading: creating }] = useCreateMailChannelMutation();
  const [updateChannel] = useUpdateMailChannelMutation();
  const [deleteChannel] = useDeleteMailChannelMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [notice, setNotice] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  const submit = async () => {
    if (!form.title.trim()) return;
    const r = await createChannel({ ...form, type: 'custom' })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Oluşturulamadı' }));
    if (r?.__err) return setNotice(r.__err);
    setShowCreate(false);
    setForm({ title: '', description: '' });
    setNotice('');
  };

  const toggleArchive = async (ch) => {
    await updateChannel({ id: ch._id, status: ch.status === 'active' ? 'archived' : 'active' })
      .unwrap()
      .catch((e) => setNotice(e?.data?.message || 'Güncellenemedi'));
  };

  const remove = async (id) => {
    const r = await deleteChannel(id).unwrap().catch((e) => ({ __err: e?.data?.message || 'Silinemedi' }));
    setConfirmId(null);
    if (r?.__err) setNotice(r.__err);
  };

  const rows = [...channels].sort((a, b) => (
    (TYPE_ORDER[a.type] || 99) - (TYPE_ORDER[b.type] || 99)
    || (a.sortOrder || 0) - (b.sortOrder || 0)
    || String(a.title || '').localeCompare(String(b.title || ''), 'tr')
  ));

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        breadcrumb={[
          { label: 'Email' },
          { label: 'Mail Listeleri', href: '/cms/email/lists' },
          { label: 'Kanallar' },
        ]}
        title="Kanal Listeleri"
        description="Genel, Haber, Cron ve Kullanıcı listeleri"
        actions={
          <Button onClick={() => setShowCreate((v) => !v)}>
            <Plus className="size-4" /> Yeni Kullanıcı Listesi
          </Button>
        }
      />

      {notice && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {showCreate && (
        <Card className="mb-5">
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Liste adı</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="VIP kullanıcılar"
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Açıklama</label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <Button onClick={submit} disabled={creating || !form.title.trim()}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Liste Oluştur
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              İptal
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Listeler</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{channels.length}</Badge>
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
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Henüz liste yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Liste</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((ch) => {
                  const tm = typeMeta(ch.type);
                  const sm = statusMeta(ch.status);
                  const manageable = canManageChannel(ch);

                  return (
                    <TableRow key={ch._id}>
                      <TableCell className="font-medium">
                        {ch.title}
                        {ch.system && (
                          <Lock className="ml-1 inline size-3 text-muted-foreground" />
                        )}
                        {ch.description && (
                          <div className="mt-0.5 max-w-[360px] truncate text-xs font-normal text-muted-foreground">
                            {ch.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tm.variant}>{tm.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{ch.key}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sm.variant}>{sm.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/cms/email/lists/channels/${ch.key}`}>
                            <Button size="sm" variant="outline">
                              <Users className="size-3.5" /> Üyeler
                            </Button>
                          </Link>
                          {manageable && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleArchive(ch)}
                              title={ch.status === 'active' ? 'Arşivle' : 'Aktifleştir'}
                            >
                              {ch.status === 'active' ? (
                                <Archive className="size-3.5" />
                              ) : (
                                <ArchiveRestore className="size-3.5" />
                              )}
                            </Button>
                          )}
                          {manageable &&
                            (confirmId === ch._id ? (
                              <Button size="sm" variant="destructive" onClick={() => remove(ch._id)}>
                                Emin?
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => setConfirmId(ch._id)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            ))}
                        </div>
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
