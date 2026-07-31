'use client';

import { Fragment, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Users, ListFilter, Newspaper, RefreshCw, Plus, Trash2, Archive, ArchiveRestore,
  Loader2, Pencil, Save, X, AlertTriangle, ChevronDown, ChevronRight,
  UserCheck, UserMinus, FolderInput, FolderTree,
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
} from '@/redux/services';
import { AddMembersPanel } from '@/components/email/add-members-panel';
import { CronListsManager } from '@/components/email/cron-lists-manager';

const SECTION_KEYS = ['general', 'custom', 'news', 'cron'];

const MEMBER_PAGE = 50;

const SECTIONS = [
  { key: 'general', label: 'Genel Liste', icon: Users, desc: 'Tüm kayıtlı ve dışarıdan eklenen alıcılar' },
  { key: 'custom', label: 'Özel Listeler', icon: ListFilter, desc: 'Oluşturduğunuz kullanıcı listeleri' },
  { key: 'news', label: 'Haber Listesi', icon: Newspaper, desc: 'Haber akışından abone olundu' },
  { key: 'cron', label: 'Cron Listeleri', icon: RefreshCw, desc: 'Zamanlı olarak oluşturulan listeler' },
];

const TYPE_META = {
  custom: { label: 'E-posta Listesi', variant: 'secondary' },
  private: { label: 'Gizli Liste', variant: 'muted' },
};

const STATUS_META = {
  active: { label: 'Aktif', variant: 'success' },
  archived: { label: 'Arşiv', variant: 'muted' },
};

const countFormatter = new Intl.NumberFormat('tr-TR');
const formatCount = (value) => countFormatter.format(Number(value) || 0);

/** Küçük özet kartı — liste panosunun üst şeridi. */
function SummaryCard({ icon: Icon, label, value, tone = 'primary' }) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
  }[tone] || 'bg-primary/10 text-primary';
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-semibold leading-tight">{formatCount(value)}</div>
          <div className="truncate text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

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

/* ── Kanal ağacı yardımcıları (parentKey → iç içe görünüm) ──
 * Backend `parentKey` alanını flat listede döndürür (bkz. mail-channel.model.js,
 * tinnten-server); burada CLIENT-SIDE ağaca çevrilir — ayrı bir `?tree=true`
 * isteğine gerek yok, elimizdeki flat veri zaten yeterli.
 */
function buildChannelTree(list) {
  const byKey = new Map(list.map((c) => [c.key, { ...c, children: [] }]));
  const roots = [];
  for (const c of list) {
    const node = byKey.get(c.key);
    const parent = c.parentKey ? byKey.get(c.parentKey) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function sortTreeNodes(nodes) {
  const sorted = [...nodes].sort(
    (a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0) ||
      String(a.title || '').localeCompare(String(b.title || ''), 'tr'),
  );
  return sorted.map((n) => ({ ...n, children: n.children.length ? sortTreeNodes(n.children) : n.children }));
}

/** DFS-preorder flatten. `collapsedKeys` verilirse daralt açık bir atanın altındaki satırlar `hidden:true` olur. */
function flattenTreeRows(nodes, depth, collapsedKeys, parentHidden, result) {
  for (const n of nodes) {
    const hasChildren = n.children.length > 0;
    result.push({ ...n, depth, hasChildren, childCount: n.children.length, hidden: parentHidden });
    if (hasChildren) {
      const childHidden = parentHidden || collapsedKeys.has(n.key);
      flattenTreeRows(n.children, depth + 1, collapsedKeys, childHidden, result);
    }
  }
  return result;
}

function findTreeNode(nodes, key) {
  for (const n of nodes) {
    if (n.key === key) return n;
    if (n.children.length) {
      const found = findTreeNode(n.children, key);
      if (found) return found;
    }
  }
  return null;
}

function collectDescendantKeys(node, acc = new Set()) {
  for (const child of node.children) {
    acc.add(child.key);
    collectDescendantKeys(child, acc);
  }
  return acc;
}

/** Her düğüme alt ağacındaki toplam üye sayısını (kendisi dâhil) iliştirir.
 *  Grup (çocuğu olan) satırları kendi "0" üyesini değil, altındaki listelerin
 *  toplamını gösterir. Node nesneleri her render'da yeniden üretildiği için
 *  mutasyon güvenli. */
function annotateSubtree(nodes) {
  let total = 0;
  for (const n of nodes) {
    const childMembers = n.children.length ? annotateSubtree(n.children) : 0;
    n.subtreeMemberCount = (Number(n.memberCount) || 0) + childMembers;
    total += n.subtreeMemberCount;
  }
  return total;
}

/* ── Özel Listeler ── */
function CustomListsSection({ authorized }) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', parentKey: '' });
  const [notice, setNotice] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', parentKey: '' });
  // Genişletilmiş varsayılan: gruplama ilk bakışta görünsün. Daraltılan grup key'leri.
  const [collapsedKeys, setCollapsedKeys] = useState(() => new Set());
  // Arşivlenen listeler aktif listeden kalkar, bu sekmede görünür.
  const [view, setView] = useState('active');
  // Toplu seçim → "Gruba Al". Seçim _id ile tutulur; satır kaybolsa da güvenli.
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupTarget, setGroupTarget] = useState('none');
  const [grouping, setGrouping] = useState(false);

  const { data: channels = [], isLoading, error } = useGetMailChannelsQuery({ all: 'true' }, { skip: !authorized });
  const sortByTitle = (a, b) =>
    (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.title || '').localeCompare(String(b.title || ''), 'tr');
  const allCustom = channels.filter((ch) => ch.type === 'custom' || ch.type === 'private');
  const activeChannels = allCustom.filter((ch) => ch.status !== 'archived').sort(sortByTitle);
  const archivedChannels = allCustom.filter((ch) => ch.status === 'archived').sort(sortByTitle);
  const customChannels = view === 'archived' ? archivedChannels : activeChannels;

  // Üst-liste seçici (create/edit) her zaman AKTİF listelerden kurulur — arşivlenmiş
  // bir listenin altına yeni bağlama yapılmaz, hangi sekmede olunursa olunsun.
  const activeTree = sortTreeNodes(buildChannelTree(activeChannels));
  const parentOptions = flattenTreeRows(activeTree, 0, new Set(), false, []);

  // Görüntülenen sekmenin (aktif/arşiv) kendi ağacı — parentKey'e göre iç içe sıralanır.
  // Grup (çocuğu olan) düğümlere alt ağaçtaki toplam üye sayısı iliştirilir.
  const displayTree = sortTreeNodes(buildChannelTree(customChannels));
  annotateSubtree(displayTree);
  const treeRows = flattenTreeRows(displayTree, 0, collapsedKeys, false, []);
  const visibleRows = treeRows.filter((r) => !r.hidden);

  // ── Toplu seçim türetimleri ──
  const selectedSet = new Set(selectedIds);
  const selectedChannels = customChannels.filter((ch) => selectedSet.has(ch._id));
  // Döngü guard'ı: seçili düğümler + tüm alt ağaçları hedef grup olamaz.
  const excludedGroupKeys = new Set();
  for (const ch of selectedChannels) {
    excludedGroupKeys.add(ch.key);
    const node = findTreeNode(activeTree, ch.key);
    if (node) collectDescendantKeys(node, excludedGroupKeys);
  }
  const groupOptions = parentOptions.filter((c) => !excludedGroupKeys.has(c.key));
  const visibleRowIds = visibleRows.map((r) => r._id);
  const allVisibleSelected =
    visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedSet.has(id));

  const toggleCollapse = (key) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const [createChannel, { isLoading: creating }] = useCreateMailChannelMutation();
  const [updateChannel, { isLoading: updating }] = useUpdateMailChannelMutation();
  const [deleteChannel, { isLoading: deleting }] = useDeleteMailChannelMutation();

  const toggleSelected = (id, checked) =>
    setSelectedIds((cur) => (checked ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id)));
  const toggleAllVisible = (checked) => setSelectedIds(checked ? visibleRowIds : []);
  const clearSelection = () => { setSelectedIds([]); setGroupTarget('none'); };

  // Seçili listeleri tek hedef gruba (parentKey) taşır. Toplu uç yok → tek tek PATCH.
  const handleGroupSelected = async () => {
    if (!selectedChannels.length) return;
    const target = groupTarget === 'none' ? null : groupTarget;
    setGrouping(true);
    const results = await Promise.all(
      selectedChannels.map((ch) =>
        updateChannel({ id: ch._id, parentKey: target })
          .unwrap()
          .then(() => null)
          .catch((e) => e?.data?.message || `“${ch.title}” taşınamadı`),
      ),
    );
    setGrouping(false);
    const errs = results.filter(Boolean);
    const moved = selectedChannels.length - errs.length;
    clearSelection();
    if (errs.length) {
      setNotice({
        variant: 'destructive',
        message:
          (moved > 0 ? `${moved} liste taşındı. ` : '') +
          `${errs.length} başarısız: ${errs.slice(0, 2).join('; ')}${errs.length > 2 ? '…' : ''}`,
      });
      return;
    }
    const targetTitle = target
      ? (parentOptions.find((c) => c.key === target)?.title || target)
      : 'Ana seviye';
    setNotice({ variant: 'info', message: `${moved} liste “${targetTitle}” grubuna taşındı.` });
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    const r = await createChannel({
      title: form.title,
      description: form.description,
      type: 'custom',
      parentKey: form.parentKey || null,
    })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Oluşturulamadı' }));
    if (r?.__err) return setNotice({ variant: 'destructive', message: r.__err });
    setShowCreate(false);
    setForm({ title: '', description: '', parentKey: '' });
    setNotice({ variant: 'info', message: 'Liste oluşturuldu.' });
  };

  const openEdit = (ch) => {
    setConfirmId(null);
    setEditId(ch._id);
    setEditForm({ title: ch.title || '', description: ch.description || '', parentKey: ch.parentKey || '' });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm({ title: '', description: '', parentKey: '' });
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
      parentKey: editForm.parentKey || null,
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
    const nextStatus = ch.status === 'archived' ? 'active' : 'archived';
    setConfirmId(null);
    setEditId(null);
    const r = await updateChannel({ id: ch._id, status: nextStatus })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Güncellenemedi' }));
    if (r?.__err) {
      setNotice({ variant: 'destructive', message: r.__err });
      return;
    }
    setNotice({
      variant: 'info',
      message:
        nextStatus === 'archived'
          ? `“${ch.title}” arşivlendi — Arşiv sekmesinden geri alabilirsiniz.`
          : `“${ch.title}” yeniden aktifleştirildi.`,
    });
  };

  // Üyeli listelerde backend varsayılan olarak silmez, arşivler. CMS'te silme
  // onayı zaten sonucu açıkça anlatıyor → her zaman `force` gönderilir; aksi halde
  // (ör. yalnızca "çıkarılmış" üyelik kaydı olan listede) silme sessizce arşive döner.
  const handleDelete = async (ch) => {
    const r = await deleteChannel({ id: ch._id, force: true })
      .unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Silinemedi' }));
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

  // Aktif özel listeler üzerinden pano özeti (abone/çıkan/liste sayısı).
  const summary = activeChannels.reduce(
    (acc, ch) => ({
      subscribed: acc.subscribed + (Number(ch.memberCount) || 0),
      unsubscribed: acc.unsubscribed + (Number(ch.unsubscribedCount) || 0),
    }),
    { subscribed: 0, unsubscribed: 0 },
  );

  return (
    <div className="space-y-4">
      {notice?.message && (
        <Alert variant={notice.variant || 'info'}>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      )}

      {!isLoading && activeChannels.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard icon={ListFilter} label="Aktif liste" value={activeChannels.length} />
          <SummaryCard icon={UserCheck} tone="success" label="Toplam aktif abone" value={summary.subscribed} />
          <SummaryCard icon={UserMinus} tone="warning" label="Toplam çıkan / çıkarılan" value={summary.unsubscribed} />
          <SummaryCard
            icon={Users}
            label="Toplam kayıt"
            value={summary.subscribed + summary.unsubscribed}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Özel Listeler</CardTitle>
          <CardToolbar className="gap-2">
            <div className="flex overflow-hidden rounded-md border border-border">
              {[
                { key: 'active', label: 'Aktif', count: activeChannels.length },
                { key: 'archived', label: 'Arşivlenenler', count: archivedChannels.length },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setView(t.key); setConfirmId(null); setEditId(null); setSelectedIds([]); setGroupTarget('none'); }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    view === t.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
            {view === 'active' && (
              <Button onClick={() => setShowCreate((v) => !v)}>
                <Plus className="size-4" /> Yeni Liste
              </Button>
            )}
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary/5 p-4">
              <span className="text-sm font-medium">{selectedIds.length} liste seçili</span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Gruba al:</span>
                <Select value={groupTarget} onValueChange={setGroupTarget}>
                  <SelectTrigger className="h-8 w-60"><SelectValue placeholder="Hedef grup" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ana seviye (gruptan çıkar)</SelectItem>
                    {groupOptions.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {'— '.repeat(c.depth)}{c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleGroupSelected} disabled={grouping}>
                  {grouping ? <Loader2 className="size-3.5 animate-spin" /> : <FolderInput className="size-3.5" />} Gruba Al
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection} disabled={grouping}>
                  Seçimi temizle
                </Button>
              </div>
            </div>
          )}
          {showCreate && view === 'active' && (
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
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Üst liste</label>
                  <Select
                    value={form.parentKey || 'none'}
                    onValueChange={(v) => setForm((f) => ({ ...f, parentKey: v === 'none' ? '' : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Ana seviye (opsiyonel)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ana seviye</SelectItem>
                      {parentOptions.map((c) => (
                        <SelectItem key={c.key} value={c.key}>
                          {'— '.repeat(c.depth)}{c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            <p className="py-10 text-center text-sm text-muted-foreground">
              {view === 'archived'
                ? 'Arşivlenmiş liste yok.'
                : 'Henüz özel liste yok. Yukarıdan oluşturun.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-primary"
                      checked={allVisibleSelected}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                      aria-label="Görünen satırları seç"
                    />
                  </TableHead>
                  <TableHead>Liste</TableHead>
                  <TableHead className="text-right">Üye</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((ch) => {
                  const tm = TYPE_META[ch.type] || { label: ch.type, variant: 'muted' };
                  const sm = STATUS_META[ch.status] || { label: ch.status, variant: 'muted' };
                  const editing = editId === ch._id;
                  const archived = ch.status === 'archived';
                  const memberCount = Number(ch.memberCount) || 0;
                  const isGroup = ch.hasChildren;
                  const selected = selectedSet.has(ch._id);
                  const selfNode = editing ? findTreeNode(activeTree, ch.key) : null;
                  const excludedKeys = editing
                    ? new Set([ch.key, ...(selfNode ? collectDescendantKeys(selfNode) : [])])
                    : null;
                  return (
                    <Fragment key={ch._id}>
                    <TableRow className={cn(selected ? 'bg-primary/5' : isGroup && 'bg-muted/40')}>
                      <TableCell className="w-10">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-primary"
                          checked={selected}
                          onChange={(e) => toggleSelected(ch._id, e.target.checked)}
                          aria-label={`${ch.title} seç`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-start gap-1.5" style={{ paddingLeft: `${ch.depth * 20}px` }}>
                          {ch.hasChildren ? (
                            <button
                              type="button"
                              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                              onClick={() => toggleCollapse(ch.key)}
                              title={collapsedKeys.has(ch.key) ? 'Genişlet' : 'Daralt'}
                            >
                              {collapsedKeys.has(ch.key)
                                ? <ChevronRight className="size-3.5" />
                                : <ChevronDown className="size-3.5" />}
                            </button>
                          ) : (
                            <span className="size-4 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
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
                                <Select
                                  value={editForm.parentKey || 'none'}
                                  onValueChange={(v) => setEditForm((f) => ({ ...f, parentKey: v === 'none' ? '' : v }))}
                                >
                                  <SelectTrigger className="h-8"><SelectValue placeholder="Ana seviye" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Ana seviye</SelectItem>
                                    {parentOptions
                                      .filter((c) => !excludedKeys?.has(c.key))
                                      .map((c) => (
                                        <SelectItem key={c.key} value={c.key}>
                                          {'— '.repeat(c.depth)}{c.title}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <>
                                <span className="inline-flex flex-wrap items-center gap-1.5">
                                  {isGroup && <FolderTree className="size-4 shrink-0 text-primary" />}
                                  <span className={cn(isGroup && 'font-semibold')}>{ch.title}</span>
                                  {ch.hasChildren && (
                                    <Badge variant="muted" className="font-normal">{ch.childCount} alt liste</Badge>
                                  )}
                                  {ch.metadata?.generatedFromCron && (
                                    <Badge variant="muted" className="gap-1 font-normal">
                                      <RefreshCw className="size-3" /> Cron
                                    </Badge>
                                  )}
                                </span>
                                {ch.description && (
                                  <div className="mt-0.5 max-w-[360px] truncate text-xs font-normal text-muted-foreground">
                                    {ch.description}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {isGroup ? (
                          <span
                            className="inline-flex items-center justify-end gap-1.5 text-sm text-muted-foreground"
                            title="Alt listelerdeki toplam üye"
                          >
                            <Users className="size-3.5" />
                            {formatCount(ch.subtreeMemberCount)}
                          </span>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="inline-flex items-center justify-end gap-1.5 font-medium">
                              <Users className="size-3.5 text-muted-foreground" />
                              {formatCount(ch.memberCount)}
                            </span>
                            {(Number(ch.unsubscribedCount) || 0) > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {formatCount(ch.unsubscribedCount)} çıkmış · {formatCount(ch.totalCount)} toplam
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isGroup
                          ? <Badge variant="outline" className="gap-1"><FolderTree className="size-3" /> Grup</Badge>
                          : <Badge variant={tm.variant}>{tm.label}</Badge>}
                      </TableCell>
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
                          {!isGroup && (
                            <Link href={`/cms/email/lists/${ch.key}`}>
                              <Button size="sm" variant="outline">
                                <Users className="mr-1 size-3.5" /> Üyeleri Yönet
                              </Button>
                            </Link>
                          )}
                          <Button
                            size="sm"
                            variant={archived ? 'outline' : 'ghost'}
                            onClick={() => toggleArchive(ch)}
                            disabled={updating}
                            title={archived ? 'Arşivden çıkar (aktifleştir)' : 'Arşivle'}
                          >
                            {archived ? (
                              <><ArchiveRestore className="mr-1 size-3.5" /> Geri Al</>
                            ) : (
                              <Archive className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditId(null);
                              setConfirmId(confirmId === ch._id ? null : ch._id);
                            }}
                            title="Listeyi kaldır"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Silme onayı — üyeli listede ne olacağı açıkça yazılır. */}
                    {confirmId === ch._id && (
                      <TableRow className="bg-destructive/5 hover:bg-destructive/5">
                        <TableCell colSpan={6}>
                          <div className="flex flex-wrap items-center justify-between gap-3 py-1">
                            <div className="flex items-start gap-2 text-sm">
                              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                              <span>
                                <b>“{ch.title}”</b> kalıcı olarak silinecek.
                                {memberCount > 0 ? (
                                  <>
                                    {' '}Bu listede <b>{formatCount(memberCount)} üye</b> var; liste silindiğinde
                                    üyelerin bu listeye kayıtları da kaldırılır. Üyeler diğer listelerde ve
                                    abone kayıtlarında kalmaya devam eder.
                                    {!archived && ' Silmek yerine arşivleyerek üyelikleri koruyabilirsiniz.'}
                                  </>
                                ) : (
                                  ' Listede üye yok.'
                                )}
                                {ch.hasChildren && (
                                  <>
                                    {' '}Bu listenin <b>{ch.childCount} alt listesi</b> var; onlar silinmez,
                                    yalnızca üst bağlantıları kalkar (ana seviyeye taşınır).
                                  </>
                                )}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {memberCount > 0 && !archived && (
                                <Button size="sm" variant="outline" onClick={() => toggleArchive(ch)} disabled={updating}>
                                  <Archive className="mr-1 size-3.5" /> Arşivle
                                </Button>
                              )}
                              <Button size="sm" variant="destructive" onClick={() => handleDelete(ch)} disabled={deleting}>
                                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : 'Yine de sil'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)} disabled={deleting}>
                                Vazgeç
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
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
    { key: 'news', limit: MEMBER_PAGE, skip, q },
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

/* ── Cron Listeleri (tam kurulum: oluştur/düzenle/üyeler) ── */
function CronSection({ authorized }) {
  return <CronListsManager authorized={authorized} />;
}

/* ── Page ── */
function MailListsPageInner() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);
  const searchParams = useSearchParams();
  const [section, setSection] = useState('general');

  // Sekme URL ile eşitlenir → /cms/email/lists?tab=cron (nav + eski Cron Listeleri
  // yönlendirmesi). Parametre değişince (aynı sayfada bile) doğru sekme açılır.
  useEffect(() => {
    const tab = searchParams.get('tab');
    setSection(tab && SECTION_KEYS.includes(tab) ? tab : 'general');
  }, [searchParams]);

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

// useSearchParams (App Router) Suspense sınırı gerektirir.
export default function MailListsPage() {
  return (
    <Suspense fallback={null}>
      <MailListsPageInner />
    </Suspense>
  );
}
