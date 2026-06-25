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

const TYPES = [
  { value: 'custom', label: 'Özel' },
  { value: 'general', label: 'Genel' },
  { value: 'news_content', label: 'Haber' },
  { value: 'private', label: 'Özel/Gizli' },
  { value: 'cron', label: 'Otomatik (Cron)' },
];

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
  const [form, setForm] = useState({ title: '', type: 'custom', description: '' });
  const [notice, setNotice] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  const submit = async () => {
    if (!form.title.trim()) return;
    const r = await createChannel(form).unwrap().catch((e) => ({ __err: e?.data?.message || 'Oluşturulamadı' }));
    if (r?.__err) return setNotice(r.__err);
    setShowCreate(false);
    setForm({ title: '', type: 'custom', description: '' });
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

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Kanallar"
        description="Mail listeleri/kanalları — onaylı kullanıcıları gruplayın (general/news/cron sistem kanalı)"
        actions={
          <Button onClick={() => setShowCreate((v) => !v)}>
            <Plus className="size-4" /> Yeni Kanal
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
              <label className="mb-1 block text-xs text-muted-foreground">Başlık</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Yeni Çıkanlar"
              />
            </div>
            <div className="w-44">
              <label className="mb-1 block text-xs text-muted-foreground">Tür</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Açıklama</label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <Button onClick={submit} disabled={creating || !form.title.trim()}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Oluştur
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              İptal
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Kanallar</CardTitle>
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
          ) : channels.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Henüz kanal yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Başlık</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((ch) => (
                  <TableRow key={ch._id}>
                    <TableCell className="font-medium">
                      {ch.title}
                      {ch.system && (
                        <Lock className="ml-1 inline size-3 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{ch.key}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{ch.type}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ch.status === 'active' ? 'success' : 'muted'}>{ch.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/cms/email/channels/${ch.key}`}>
                          <Button size="sm" variant="outline">
                            <Users className="size-3.5" /> Üyeler
                          </Button>
                        </Link>
                        {!ch.system && (
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
                        {!ch.system &&
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
