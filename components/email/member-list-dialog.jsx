'use client';

import { useState } from 'react';
import {
  Trash2, Loader2, Pencil, Save, X, Undo2, Ban,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useGetChannelMembersQuery,
  useRemoveChannelMemberMutation,
  useUpdateChannelMemberMutation,
  useBlockSubscriberMutation,
} from '@/redux/services';
import { AddMembersPanel } from '@/components/email/add-members-panel';
import { categoryMeta } from '@/lib/unsubscribeReasons';
import { cn } from '@/lib/utils';

const PAGE = 50;
const countFormatter = new Intl.NumberFormat('tr-TR');
const formatCount = (value) => countFormatter.format(Number(value) || 0);

// Listedeki üyelik durumu — abonenin genel durumundan (active/bounced) ayrı.
const MEMBER_VIEWS = [
  { key: 'subscribed', label: 'Listede' },
  { key: 'unsubscribed', label: 'Çıkarılanlar' },
  { key: 'all', label: 'Tümü' },
];

const isManualList = (channel) => channel?.type === 'custom' || channel?.type === 'private';

/** Çıkış gerekçesi rozeti (kategori renkli). */
function ReasonBadge({ category, reason }) {
  if (!reason) return <span className="text-xs text-muted-foreground">—</span>;
  const meta = categoryMeta(category);
  return (
    <span className="inline-flex items-center gap-1.5" title={meta.hint}>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
      <span className="text-xs">{meta.label}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{reason}</span>
    </span>
  );
}

export function MemberListDialog({ open, onOpenChange, channel, channelKey, authorized }) {
  const isArchived = channel?.status === 'archived';
  const canEditMembers = isManualList(channel);
  const canAddMembers = canEditMembers && !isArchived;

  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState('');
  const [memberView, setMemberView] = useState('subscribed');
  const [notice, setNotice] = useState('');
  const [confirmEmail, setConfirmEmail] = useState(null);
  const [blockEmail, setBlockEmail] = useState(null);
  const [editEmail, setEditEmail] = useState(null);
  const [editName, setEditName] = useState('');

  const { data, isLoading, error, isFetching } = useGetChannelMembersQuery(
    { key: channelKey, limit: PAGE, skip, q, status: memberView },
    { skip: !authorized || !channelKey || !open },
  );
  const members = data?.items ?? [];
  const total = data?.total ?? 0;

  const [removeMember, { isLoading: removing }] = useRemoveChannelMemberMutation();
  const [updateMember, { isLoading: savingMember }] = useUpdateChannelMemberMutation();
  const [blockSubscriber, { isLoading: blocking }] = useBlockSubscriberMutation();

  const handleRemove = async (email) => {
    setConfirmEmail(null);
    const r = await removeMember({ key: channelKey, email })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Çıkarılamadı' }));
    setNotice(r?.__err || `${email} listeden çıkarıldı. “Çıkarılanlar” sekmesinden geri alabilirsiniz.`);
  };

  const handleBlock = async (email) => {
    setBlockEmail(null);
    const r = await blockSubscriber({ key: channelKey, email })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Engellenemedi' }));
    setNotice(r?.__err || `${email} tüm listelerden çıkarıldı ve Kara Listeye eklendi.`);
  };

  const handleResubscribe = async (email) => {
    const r = await updateMember({ key: channelKey, email, channelStatus: 'subscribed' })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Geri alınamadı' }));
    // Kara listedeki adresi backend abone ETMEZ — "geri eklendi" deme.
    setNotice(
      r?.__err ||
        (r?.suppressed
          ? `${email} Kara Listede olduğu için geri eklenmedi.`
          : `${email} listeye geri eklendi.`),
    );
  };

  const startEdit = (m) => {
    setConfirmEmail(null);
    setBlockEmail(null);
    setEditEmail(m.email);
    setEditName(m.profile?.name || '');
  };
  const cancelEdit = () => {
    setEditEmail(null);
    setEditName('');
  };
  const saveMember = async (m) => {
    const r = await updateMember({
      key: channelKey,
      email: m.email,
      profile: { ...(m.profile || {}), name: editName.trim() },
    })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Güncellenemedi' }));
    if (r?.__err) { setNotice(r.__err); return; }
    cancelEdit();
    setNotice(`${m.email} güncellendi.`);
  };

  const changeView = (key) => {
    setMemberView(key);
    setSkip(0);
    setConfirmEmail(null);
    setBlockEmail(null);
    cancelEdit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="fullscreen" className="gap-0">
        <DialogHeader className="mb-3">
          <DialogTitle>{channel?.title || channelKey} — Üyeler</DialogTitle>
          <DialogDescription>
            {canEditMembers
              ? 'Adresleri görüntüleyin, listeden çıkarın, engelleyin veya geri alın.'
              : 'Bu liste kaynak akış tarafından güncellenir; salt görüntüleme.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex min-h-0 flex-col gap-3 overflow-hidden">
          {notice && (
            <Alert variant="info"><AlertDescription>{notice}</AlertDescription></Alert>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border">
              {MEMBER_VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => changeView(v.key)}
                  className={cn(
                    'px-2.5 py-1.5 text-xs font-medium transition-colors',
                    memberView === v.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setSkip(0); }}
              placeholder="E-posta ara…"
              className="h-8 w-56"
            />
            {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <span className="ml-auto text-sm text-muted-foreground">{formatCount(total)} kayıt</span>
          </div>

          <div className={cn('grid min-h-0 flex-1 gap-4', canAddMembers ? 'lg:grid-cols-[320px_1fr]' : '')}>
            {canAddMembers && (
              <div className="min-h-0 overflow-auto">
                <AddMembersPanel
                  channelKey={channelKey}
                  authorized={authorized}
                  note="Sadece doğrulanmış/onaylı adresler eklenmeli (SES itibarı)."
                />
              </div>
            )}

            <div className="min-h-0 overflow-auto rounded-md border border-border">
              {error ? (
                <div className="p-4">
                  <Alert variant="destructive">
                    <AlertDescription>{error?.data?.message || 'Sunucuya ulaşılamadı.'}</AlertDescription>
                  </Alert>
                </div>
              ) : isLoading ? (
                <div className="space-y-1 p-4">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
                </div>
              ) : members.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {memberView === 'unsubscribed' ? 'Bu listeden çıkarılmış üye yok.' : 'Bu listede üye yok.'}
                </p>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>E-posta</TableHead>
                      <TableHead>Ad</TableHead>
                      <TableHead>Listede</TableHead>
                      {memberView !== 'subscribed' && <TableHead>Çıkış Nedeni</TableHead>}
                      <TableHead>Abone Durumu</TableHead>
                      {canEditMembers && <TableHead className="text-right">İşlem</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => {
                      const removed = m.channelStatus === 'unsubscribed';
                      const editing = editEmail === m.email;
                      const confirming = confirmEmail === m.email;
                      const blockConfirming = blockEmail === m.email;
                      return (
                        <TableRow key={m._id || m.email}>
                          <TableCell className="font-mono text-xs">{m.email}</TableCell>
                          <TableCell>
                            {editing ? (
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-8 max-w-[200px]"
                                placeholder="Ad Soyad"
                                autoFocus
                              />
                            ) : (m.profile?.name || '—')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={removed ? 'muted' : 'success'}>
                              {removed ? 'Çıkarıldı' : 'Aktif'}
                            </Badge>
                          </TableCell>
                          {memberView !== 'subscribed' && (
                            <TableCell>
                              {removed
                                ? <ReasonBadge category={m.channelReasonCategory} reason={m.channelReason} />
                                : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant={m.status === 'active' ? 'secondary' : 'destructive'}>{m.status}</Badge>
                          </TableCell>
                          {canEditMembers && (
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                {editing ? (
                                  <>
                                    <Button size="sm" onClick={() => saveMember(m)} disabled={savingMember}>
                                      {savingMember ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={savingMember}>
                                      <X className="size-3.5" />
                                    </Button>
                                  </>
                                ) : blockConfirming ? (
                                  <>
                                    <Button size="sm" variant="destructive" onClick={() => handleBlock(m.email)} disabled={blocking}>
                                      {blocking ? <Loader2 className="size-3.5 animate-spin" /> : 'Engelle'}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setBlockEmail(null)} disabled={blocking}>Vazgeç</Button>
                                  </>
                                ) : confirming ? (
                                  <>
                                    <Button size="sm" variant="destructive" onClick={() => handleRemove(m.email)} disabled={removing}>
                                      {removing ? <Loader2 className="size-3.5 animate-spin" /> : 'Çıkar'}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setConfirmEmail(null)} disabled={removing}>Vazgeç</Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" variant="ghost" onClick={() => startEdit(m)} title="Adı düzenle">
                                      <Pencil className="size-3.5" />
                                    </Button>
                                    {removed ? (
                                      <Button size="sm" variant="outline" onClick={() => handleResubscribe(m.email)} disabled={savingMember}>
                                        <Undo2 className="mr-1 size-3.5" /> Geri al
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => { cancelEdit(); setConfirmEmail(m.email); }}
                                        title="Listeden çıkar"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => { cancelEdit(); setConfirmEmail(null); setBlockEmail(m.email); }}
                                      title="Tüm listelerden engelle"
                                    >
                                      <Ban className="size-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">
              {members.length > 0 ? `${skip + 1}–${skip + members.length}` : '0'}
              {total > 0 && ` / ${formatCount(total)}`}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>
                Önceki
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={total ? skip + members.length >= total : members.length < PAGE}
                onClick={() => setSkip(skip + PAGE)}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
