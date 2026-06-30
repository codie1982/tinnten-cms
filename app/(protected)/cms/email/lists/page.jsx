'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Users, ListFilter, Newspaper, RefreshCw, Plus, Trash2, Archive, ArchiveRestore,
  Loader2, ArrowRight, Pencil, Save, X,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
  useGetMailChannelsQuery,
  useGetChannelMembersQuery,
  useCreateMailChannelMutation,
  useUpdateMailChannelMutation,
  useDeleteMailChannelMutation,
  useGetCronListsQuery,
} from '@/redux/services';
import { AddMembersPanel } from '@/components/email/add-members-panel';

const MEMBER_PAGE = 50;

const SECTIONS = [
  { key: 'general', label: 'Genel Liste', icon: Users, desc: 'Tüm kayıtlı ve dışarıdan eklenen alıcılar' },
  { key: 'custom', label: 'Özel Listeler', icon: ListFilter, desc: 'Oluşturduğunuz kullanıcı listeleri' },
  { key: 'news', label: 'Haber Listesi', icon: Newspaper, desc: 'Haber akışından abone olundu' },
  { key: 'cron', label: 'Cron Listeleri', icon: RefreshCw, desc: 'Zamanlı olarak oluşturulan listeler' },
];

const TYPE_META = {
  custom: { label: 'Kullanıcı Listesi', variant: 'secondary' },
  private: { label: 'Gizli Liste', variant: 'muted' },
};

const STATUS_META = {
  active: { label: 'Aktif', variant: 'success' },
  archived: { label: 'Arşiv', variant: 'muted' },
};

const countFormatter = new Intl.NumberFormat('tr-TR');
const formatCount = (value) => countFormatter.format(Number(value) || 0);

/* ── Genel Liste ── */
function GeneralSection({ authorized }) {
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState('');

  const { data, isLoading, isFetching, error } = useGetChannelMembersQuery(
    { key: 'general', limit: MEMBER_PAGE, skip, q },
    { skip: !authorized },
  );
  const members = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <AddMembersPanel
          channelKey="general"
          authorized={authorized}
          note="Kayıtlı kullanıcılar otomatik eklenir. Buradan kayıt olmadan dışarıdan e-posta ekleyebilirsiniz."
        />

        <Card>
          <CardHeader>
            <CardTitle>Üyeler</CardTitle>
            <CardToolbar className="gap-2">
              <Input
                value={q}
                onChange={(e) => { setQ(e.target.value); setSkip(0); }}
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
                  <AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription>
                </Alert>
              </div>
            ) : isLoading ? (
              <div className="space-y-1 p-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
              </div>
            ) : members.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Genel listede üye yok.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-posta</TableHead>
                      <TableHead>Ad</TableHead>
                      <TableHead>Durum</TableHead>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                  <span className="text-muted-foreground">{skip + 1}–{skip + members.length}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - MEMBER_PAGE))}>Önceki</Button>
                    <Button size="sm" variant="outline" disabled={members.length < MEMBER_PAGE} onClick={() => setSkip(skip + MEMBER_PAGE)}>Sonraki</Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Özel Listeler ── */
function CustomListsSection({ authorized }) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [notice, setNotice] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });

  const { data: channels = [], isLoading, error } = useGetMailChannelsQuery({ all: 'true' }, { skip: !authorized });
  const customChannels = channels
    .filter((ch) => ch.type === 'custom' || ch.type === 'private')
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.title || '').localeCompare(String(b.title || ''), 'tr'));

  const [createChannel, { isLoading: creating }] = useCreateMailChannelMutation();
  const [updateChannel, { isLoading: updating }] = useUpdateMailChannelMutation();
  const [deleteChannel, { isLoading: deleting }] = useDeleteMailChannelMutation();

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    const r = await createChannel({ ...form, type: 'custom' })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Oluşturulamadı' }));
    if (r?.__err) return setNotice({ variant: 'destructive', message: r.__err });
    setShowCreate(false);
    setForm({ title: '', description: '' });
    setNotice({ variant: 'info', message: 'Liste oluşturuldu.' });
  };

  const openEdit = (ch) => {
    setConfirmId(null);
    setEditId(ch._id);
    setEditForm({ title: ch.title || '', description: ch.description || '' });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm({ title: '', description: '' });
  };

  const saveEdit = async (ch) => {
    const title = editForm.title.trim();
    if (!title) {
      setNotice({ variant: 'destructive', message: 'Liste adı boş olamaz.' });
      return;
    }

    const r = await updateChannel({
      id: ch._id,
      title,
      description: editForm.description.trim(),
    })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Liste güncellenemedi' }));

    if (r?.__err) {
      setNotice({ variant: 'destructive', message: r.__err });
      return;
    }
    cancelEdit();
    setNotice({ variant: 'info', message: 'Liste bilgileri güncellendi.' });
  };

  const toggleArchive = async (ch) => {
    const nextStatus = ch.status === 'active' ? 'archived' : 'active';
    const r = await updateChannel({ id: ch._id, status: nextStatus })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Güncellenemedi' }));
    if (r?.__err) {
      setNotice({ variant: 'destructive', message: r.__err });
      return;
    }
    setNotice({
      variant: 'info',
      message: nextStatus === 'archived' ? 'Liste arşivlendi.' : 'Liste aktifleştirildi.',
    });
  };

  const handleDelete = async (id) => {
    const r = await deleteChannel(id).unwrap().catch((e) => ({ __err: e?.data?.message || 'Silinemedi' }));
    setConfirmId(null);
    if (r?.__err) {
      setNotice({ variant: 'destructive', message: r.__err });
      return;
    }
    setNotice({
      variant: 'info',
      message: r?.message || 'Liste kaldırıldı.',
    });
  };

  return (
    <div className="space-y-4">
      {notice?.message && (
        <Alert variant={notice.variant || 'info'}>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Özel Listeler</CardTitle>
          <CardToolbar>
            <Button onClick={() => setShowCreate((v) => !v)}>
              <Plus className="size-4" /> Yeni Liste
            </Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          {showCreate && (
            <div className="border-b border-border p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Liste adı</label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Örn. VIP kullanıcılar"
                  />
                </div>
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Açıklama</label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <Button onClick={handleCreate} disabled={creating || !form.title.trim()}>
                  {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Oluştur
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
              </div>
            </div>
          )}

          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-1 p-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : customChannels.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Henüz özel liste yok. Yukarıdan oluşturun.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Liste</TableHead>
                  <TableHead className="text-right">Üye</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customChannels.map((ch) => {
                  const tm = TYPE_META[ch.type] || { label: ch.type, variant: 'muted' };
                  const sm = STATUS_META[ch.status] || { label: ch.status, variant: 'muted' };
                  const editing = editId === ch._id;
                  return (
                    <TableRow key={ch._id}>
                      <TableCell className="font-medium">
                        {editing ? (
                          <div className="max-w-[420px] space-y-2">
                            <Input
                              value={editForm.title}
                              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                              className="h-8"
                              autoFocus
                            />
                            <Input
                              value={editForm.description}
                              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                              className="h-8"
                              placeholder="Açıklama"
                            />
                          </div>
                        ) : (
                          <>
                            {ch.title}
                            {ch.description && (
                              <div className="mt-0.5 max-w-[360px] truncate text-xs font-normal text-muted-foreground">
                                {ch.description}
                              </div>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center justify-end gap-1.5 font-medium">
                          <Users className="size-3.5 text-muted-foreground" />
                          {formatCount(ch.memberCount)}
                        </span>
                      </TableCell>
                      <TableCell><Badge variant={tm.variant}>{tm.label}</Badge></TableCell>
                      <TableCell><Badge variant={sm.variant}>{sm.label}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {editing ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => saveEdit(ch)}
                                disabled={updating || !editForm.title.trim()}
                              >
                                {updating ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={updating}>
                                <X className="size-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => openEdit(ch)} title="Liste adını düzenle">
                              <Pencil className="size-3.5" />
                            </Button>
                          )}
                          <Link href={`/cms/email/lists/${ch.key}`}>
                            <Button size="sm" variant="outline">
                              <Users className="mr-1 size-3.5" /> Üyeleri Yönet
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleArchive(ch)}
                            title={ch.status === 'active' ? 'Arşivle' : 'Aktifleştir'}
                          >
                            {ch.status === 'active'
                              ? <Archive className="size-3.5" />
                              : <ArchiveRestore className="size-3.5" />}
                          </Button>
                          {confirmId === ch._id ? (
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(ch._id)} disabled={deleting}>
                              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : 'Emin?'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setEditId(null); setConfirmId(ch._id); }}
                              title="Listeyi kaldır"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
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
    </div>
  );
}

/* ── Haber Listesi (salt okunur) ── */
function NewsSection({ authorized }) {
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState('');

  const { data, isLoading, isFetching, error } = useGetChannelMembersQuery(
    { key: 'news_content', limit: MEMBER_PAGE, skip, q },
    { skip: !authorized },
  );
  const members = data?.items ?? [];

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          Haber abonelikleri haberler bölümünden yönetilir. Bu liste salt okunurdur.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Haber Aboneleri</CardTitle>
          <CardToolbar className="gap-2">
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setSkip(0); }}
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
                <AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-1 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
            </div>
          ) : members.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Haber listesinde üye yok.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Ad</TableHead>
                    <TableHead>Durum</TableHead>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                <span className="text-muted-foreground">{skip + 1}–{skip + members.length}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - MEMBER_PAGE))}>Önceki</Button>
                  <Button size="sm" variant="outline" disabled={members.length < MEMBER_PAGE} onClick={() => setSkip(skip + MEMBER_PAGE)}>Sonraki</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Cron Listeleri (özet, salt okunur) ── */
function CronSection({ authorized }) {
  const { data: lists = [], isLoading } = useGetCronListsQuery({}, { skip: !authorized });

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          Cron listeleri DB sorgusuyla otomatik güncellenir.{' '}
          <Link href="/cms/email/cron-lists" className="font-medium underline">
            Yeni liste oluşturmak veya düzenlemek için buraya gidin →
          </Link>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Cron Listesi Özeti</CardTitle>
          <CardToolbar>
            <Link href="/cms/email/cron-lists">
              <Button variant="outline" size="sm">
                Tam Kurulum <ArrowRight className="ml-1 size-3.5" />
              </Button>
            </Link>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-1 p-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
            </div>
          ) : lists.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Henüz cron listesi yok.{' '}
              <Link href="/cms/email/cron-lists" className="font-medium underline">Oluşturun →</Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Zamanlama</TableHead>
                  <TableHead>Son Üretim</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="font-medium">
                      {row.name}
                      {row.description && (
                        <div className="text-xs text-muted-foreground">{row.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.schedule?.cron}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.lastBuiltAt
                        ? `${new Date(row.lastBuiltAt).toLocaleString('tr-TR')} · ${row.lastBuiltCount ?? 0} kişi`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'active' ? 'secondary' : 'outline'}>{row.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Page ── */
export default function MailListsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const [section, setSection] = useState('general');

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        section="Email"
        title="Mail Listeleri"
        description="Genel, özel, haber ve cron tabanlı e-posta listeleri"
      />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <nav className="space-y-0.5 p-2">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = section === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">{s.desc}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        <div>
          {section === 'general' && <GeneralSection authorized={authorized} />}
          {section === 'custom' && <CustomListsSection authorized={authorized} />}
          {section === 'news' && <NewsSection authorized={authorized} />}
          {section === 'cron' && <CronSection authorized={authorized} />}
        </div>
      </div>
    </RoleGuard>
  );
}
