'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Send,
  CheckCircle2,
  MailOpen,
  MousePointerClick,
  AlertCircle,
  ArrowDownLeft,
  RefreshCw,
  Plus,
  X,
  Users,
  Clock,
  Filter,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { SplitShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CMS_ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';

/* ─── mock ─── */
const historyMock = [
  {
    id: 'mh-01',
    recipients: [{ name: 'Ahmet Yıldız', email: 'ahmet@firma.com', avatar: 'AY' }],
    subject: 'Tinnten\'e Hoş Geldiniz!',
    template: 'Hoşgeldin Emaili',
    sentAt: '29.05.2025 14:32',
    status: 'opened',
    openedAt: '29.05.2025 14:45',
    clickedAt: null,
    body: '<p>Sayın Ahmet Bey,</p><p>Tinnten platformuna hoş geldiniz! Hesabınız başarıyla oluşturuldu.</p><a href="#">Platforma Giriş Yap →</a>',
  },
  {
    id: 'mh-02',
    recipients: [
      { name: 'Selin Yılmaz', email: 'selin@yilmaztech.com', avatar: 'SY' },
      { name: 'Kaan Arslan', email: 'kaan@atlas.io', avatar: 'KA' },
      { name: 'Deniz Ak', email: 'deniz@mavera.com', avatar: 'DA' },
    ],
    subject: 'Mayıs 2025 Dönemi Faturanız',
    template: 'Fatura Bildirim',
    sentAt: '28.05.2025 09:00',
    status: 'delivered',
    openedAt: null,
    clickedAt: null,
    body: '<p>Mayıs 2025 dönemi faturanız hazır. Toplam tutar: <strong>1.240 ₺</strong></p>',
  },
  {
    id: 'mh-03',
    recipients: [{ name: 'Cemre Danış', email: 'cemre@nova.io', avatar: 'CD' }],
    subject: 'KYC Sürecinizi Tamamlayın — 3 gün kaldı',
    template: 'KYC Hatırlatması',
    sentAt: '27.05.2025 10:15',
    status: 'clicked',
    openedAt: '27.05.2025 10:31',
    clickedAt: '27.05.2025 10:33',
    body: '<p>Firma doğrulamanızı tamamlamak için <strong>3 gününüz</strong> kaldı.</p>',
  },
  {
    id: 'mh-04',
    recipients: [{ name: 'İlker Parlak', email: 'ilker@perla.com', avatar: 'IP' }],
    subject: 'Şifre Sıfırlama Talebi',
    template: 'Şifre Sıfırlama',
    sentAt: '26.05.2025 18:44',
    status: 'failed',
    openedAt: null,
    clickedAt: null,
    failReason: 'Mailbox full — 452 Too many recipients',
    body: '<p>Şifre sıfırlama bağlantınız oluşturuldu.</p>',
  },
  {
    id: 'mh-05',
    recipients: [
      { name: 'Mehmet Kılıç', email: 'info@abctemizlik.com', avatar: 'MK' },
      { name: 'Ahmet Yıldız', email: 'ahmet@firma.com', avatar: 'AY' },
    ],
    subject: 'Platform Güncellemesi — Yapay Zeka Özellikleri',
    template: 'Kampanya Duyurusu',
    sentAt: '25.05.2025 11:00',
    status: 'delivered',
    openedAt: null,
    clickedAt: null,
    body: '<p>Platformumuza yeni AI özellikleri eklendi. Detaylar için tıklayın.</p>',
  },
  {
    id: 'mh-06',
    recipients: [{ name: 'Selin Yılmaz', email: 'selin@yilmaztech.com', avatar: 'SY' }],
    subject: 'Firma Doğrulamanız Onaylandı ✓',
    template: 'KYC Onay Bildirimi',
    sentAt: '24.05.2025 16:20',
    status: 'opened',
    openedAt: '24.05.2025 16:35',
    clickedAt: null,
    body: '<p>Tebrikler! <strong>Yılmaz Teknoloji Ltd.</strong> firması başarıyla doğrulandı.</p>',
  },
  {
    id: 'mh-07',
    recipients: [{ name: 'Deniz Ak', email: 'deniz@mavera.com', avatar: 'DA' }],
    subject: 'Tinnten\'e Hoş Geldiniz!',
    template: 'Hoşgeldin Emaili',
    sentAt: '23.05.2025 09:12',
    status: 'bounced',
    openedAt: null,
    clickedAt: null,
    failReason: 'User unknown — 550 5.1.1',
    body: '<p>Sayın Deniz Hanım, hoş geldiniz!</p>',
  },
  {
    id: 'mh-08',
    recipients: [
      { name: 'Kaan Arslan', email: 'kaan@atlas.io', avatar: 'KA' },
      { name: 'Cemre Danış', email: 'cemre@nova.io', avatar: 'CD' },
      { name: 'İlker Parlak', email: 'ilker@perla.com', avatar: 'IP' },
      { name: 'Mehmet Kılıç', email: 'info@abctemizlik.com', avatar: 'MK' },
      { name: 'Selin Yılmaz', email: 'selin@yilmaztech.com', avatar: 'SY' },
    ],
    subject: '🎉 Pro Üyelik Kampanyası — %30 İndirim!',
    template: 'Kampanya Duyurusu',
    sentAt: '22.05.2025 10:00',
    status: 'clicked',
    openedAt: '22.05.2025 10:18',
    clickedAt: '22.05.2025 10:21',
    body: '<p>Tüm Pro üyelik paketlerinde <strong>%30 indirim</strong> kampanyamız başladı!</p>',
  },
];

const statusMeta = {
  delivered: { label: 'İletildi', variant: 'secondary', icon: CheckCircle2 },
  opened: { label: 'Açıldı', variant: 'primary', icon: MailOpen },
  clicked: { label: 'Tıklandı', variant: 'success', icon: MousePointerClick },
  failed: { label: 'Hata', variant: 'destructive', icon: AlertCircle },
  bounced: { label: 'Geri Döndü', variant: 'warning', icon: ArrowDownLeft },
};

const TEMPLATES = ['Hoşgeldin Emaili', 'KYC Onay Bildirimi', 'Fatura Bildirim', 'KYC Hatırlatması', 'Kampanya Duyurusu', 'Şifre Sıfırlama'];
const ALL_USERS = [...new Map(historyMock.flatMap((m) => m.recipients).map((u) => [u.email, u])).values()];

/* ─── New Mail Modal ─── */
function SendMailModal({ onClose }) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [template, setTemplate] = useState('');
  const [subject, setSubject] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const filteredUsers = ALL_USERS.filter(
    (u) => !userSearch || [u.name, u.email].some((f) => f.toLowerCase().includes(userSearch.toLowerCase())),
  );

  function toggleUser(u) {
    setSelectedUsers((prev) =>
      prev.find((p) => p.email === u.email) ? prev.filter((p) => p.email !== u.email) : [...prev, u],
    );
  }

  function handleSend() {
    if (!selectedUsers.length || !subject) return;
    setSending(true);
    setTimeout(() => { setSending(false); setDone(true); }, 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Send className="size-4" />
            </div>
            <CardTitle>Mail Gönder</CardTitle>
          </div>
          <CardToolbar>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
          </CardToolbar>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="size-7" />
              </div>
              <p className="font-medium">Mail gönderildi!</p>
              <p className="text-sm text-muted-foreground">{selectedUsers.length} alıcıya gönderildi.</p>
              <Button onClick={onClose}>Kapat</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Recipient picker */}
              <div className="space-y-2">
                <label className="text-2sm font-medium">Alıcılar *</label>
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUsers.map((u) => (
                      <span key={u.email} className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {u.name}
                        <button onClick={() => toggleUser(u)} className="ml-0.5 hover:text-destructive"><X className="size-2.5" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Kullanıcı adı veya e-posta ara…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                  {filteredUsers.map((u) => {
                    const checked = !!selectedUsers.find((p) => p.email === u.email);
                    return (
                      <label key={u.email} className={cn('flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-accent', checked && 'bg-primary/5')}>
                        <input type="checkbox" checked={checked} onChange={() => toggleUser(u)} className="accent-primary" />
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <p className="font-medium leading-none">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Template */}
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Şablon</label>
                <Select value={template} onValueChange={setTemplate}>
                  <SelectTrigger><SelectValue placeholder="Şablon seçin (opsiyonel)" /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">Konu *</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email konusu"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>İptal</Button>
                <Button disabled={!selectedUsers.length || !subject || sending} onClick={handleSend}>
                  <Send className="size-4" />
                  {sending ? 'Gönderiliyor…' : `${selectedUsers.length > 0 ? selectedUsers.length + ' kişiye ' : ''}Gönder`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── page ─── */
export default function MailHistoryPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [templateFilter, setTemplateFilter] = useState('all');
  const [selected, setSelected] = useState(historyMock[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => setIsLoading(false), 350);
    return () => clearTimeout(t);
  }, [search, statusFilter, templateFilter]);

  const filtered = useMemo(() =>
    historyMock
      .filter((m) => statusFilter === 'all' || m.status === statusFilter)
      .filter((m) => templateFilter === 'all' || m.template === templateFilter)
      .filter((m) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          m.subject.toLowerCase().includes(q) ||
          m.recipients.some((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
        );
      }),
    [search, statusFilter, templateFilter],
  );

  const aside = (
    <div className="sticky top-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mail Detayı</CardTitle>
        </CardHeader>
        <CardContent>
          {selected ? (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                {(() => { const sm = statusMeta[selected.status]; const Icon = sm?.icon; return (<><Icon className="size-4 text-muted-foreground" /><Badge variant={sm?.variant}>{sm?.label}</Badge></> ); })()}
              </div>

              {/* Recipients */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Alıcılar</p>
                <div className="space-y-2">
                  {selected.recipients.slice(0, 3).map((r) => (
                    <div key={r.email} className="flex items-center gap-2">
                      <Avatar name={r.name} size="sm" />
                      <div>
                        <p className="text-sm font-medium leading-none">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      </div>
                    </div>
                  ))}
                  {selected.recipients.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{selected.recipients.length - 3} kişi daha</p>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div>
                <p className="text-xs font-medium text-muted-foreground">Konu</p>
                <p className="mt-0.5 text-sm font-medium">{selected.subject}</p>
              </div>

              {/* Template & time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Şablon</p>
                  <p className="mt-0.5 text-xs font-medium">{selected.template}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gönderim</p>
                  <p className="mt-0.5 font-mono text-xs">{selected.sentAt}</p>
                </div>
                {selected.openedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Açıldı</p>
                    <p className="mt-0.5 font-mono text-xs">{selected.openedAt}</p>
                  </div>
                )}
                {selected.clickedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Tıklandı</p>
                    <p className="mt-0.5 font-mono text-xs">{selected.clickedAt}</p>
                  </div>
                )}
              </div>

              {/* Error */}
              {selected.failReason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <p className="text-xs font-medium text-destructive">Hata</p>
                  <p className="mt-0.5 font-mono text-xs text-destructive/80">{selected.failReason}</p>
                  <Button variant="outline" size="sm" className="mt-2 h-6 text-xs">
                    <RefreshCw className="size-3" />
                    Yeniden Gönder
                  </Button>
                </div>
              )}

              {/* Body preview */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">İçerik Önizleme</p>
                <div
                  className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-xs leading-relaxed text-foreground"
                  dangerouslySetInnerHTML={{ __html: selected.body }}
                />
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Mail seçin</p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      {showSendModal && <SendMailModal onClose={() => setShowSendModal(false)} />}

      <PageHeader
        section="Email"
        title="Mail Geçmişi"
        description="Tüm kullanıcılara gönderilen ve alınan mail kayıtlarını inceleyin"
        actions={
          <Button onClick={() => setShowSendModal(true)}>
            <Send className="size-4" />
            Mail Gönder
          </Button>
        }
      />

      <SplitShell aside={aside} asideWidth="w-80">
        {/* Toolbar */}
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Kullanıcı adı, e-posta veya konu ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
              />
            </div>
            <div className="w-36">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Durumlar</SelectItem>
                  {Object.entries(statusMeta).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger><SelectValue placeholder="Şablon" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Şablonlar</SelectItem>
                  {TEMPLATES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Gönderim Kayıtları</CardTitle>
            <CardToolbar>
              <Badge variant="muted">{filtered.length} kayıt</Badge>
            </CardToolbar>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alıcı</TableHead>
                    <TableHead>Konu</TableHead>
                    <TableHead>Şablon</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Gönderim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => {
                    const sm = statusMeta[m.status];
                    const Icon = sm?.icon;
                    const isSelected = selected?.id === m.id;
                    return (
                      <TableRow
                        key={m.id}
                        className={cn('cursor-pointer', isSelected && 'bg-primary/5')}
                        onClick={() => setSelected(m)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5">
                              {m.recipients.slice(0, 3).map((r) => (
                                <Avatar key={r.email} name={r.name} size="sm" />
                              ))}
                            </div>
                            {m.recipients.length > 1 ? (
                              <span className="text-xs text-muted-foreground">{m.recipients.length} kişi</span>
                            ) : (
                              <div>
                                <p className="text-sm font-medium leading-none">{m.recipients[0].name}</p>
                                <p className="text-xs text-muted-foreground">{m.recipients[0].email}</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="line-clamp-1 max-w-[180px] text-sm">{m.subject}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{m.template}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Icon className="size-3.5 text-muted-foreground" />
                            <Badge variant={sm?.variant}>{sm?.label}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{m.sentAt}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </SplitShell>
    </RoleGuard>
  );
}
