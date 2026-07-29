'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Building2,
  ArrowRightLeft,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import CompanySelect, { shortId } from '@/components/cms/company-select';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetAssistantsQuery,
  useCreateAssistantMutation,
  useAssignAssistantCompanyMutation,
} from '@/redux/services';

const PAGE_SIZE = 20;

const statusMeta = {
  draft: { label: 'Taslak', variant: 'muted' },
  published: { label: 'Yayında', variant: 'success' },
  active: { label: 'Aktif', variant: 'success' },
  disabled: { label: 'Devre Dışı', variant: 'warning' },
  archived: { label: 'Arşivli', variant: 'muted' },
};

const LOCALES = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'İngilizce' },
  { value: 'de', label: 'Almanca' },
  { value: 'fr', label: 'Fransızca' },
  { value: 'es', label: 'İspanyolca' },
  { value: 'it', label: 'İtalyanca' },
  { value: 'ar', label: 'Arapça' },
  { value: 'ru', label: 'Rusça' },
  { value: 'el', label: 'Yunanca' },
];

function formatTrDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const errText = (e, fallback) =>
  e?.data?.message || e?.normalizedMessage || fallback;

export default function AssistantsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ACCESS]);
  const canManage = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);

  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [assigned, setAssigned] = useState(''); // '' | 'assigned' | 'unassigned'
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState(null); // { type: 'success'|'error', text }

  const [createOpen, setCreateOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null); // asistan satırı

  useEffect(() => {
    setPage(1);
  }, [submittedSearch, assigned]);

  const applySearch = () => setSubmittedSearch(search.trim());

  const { data, isLoading, isFetching, error } = useGetAssistantsQuery(
    {
      query: submittedSearch || undefined,
      assigned: assigned || undefined,
      page,
      limit: PAGE_SIZE,
    },
    { skip: !authorized },
  );

  const assistants = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const isEmpty = !isLoading && !error && assistants.length === 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ACCESS]}>
      <PageHeader
        section="Yapay Zeka"
        title="Asistanlar"
        description="Tüm AI asistanlarını görüntüleyin ve yönetin"
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Yeni Asistan
            </Button>
          ) : null
        }
      />

      {notice && (
        <Alert variant={notice.type === 'error' ? 'destructive' : 'info'} className="mb-5">
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Asistan adı veya slug ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch();
              }}
              className="h-9 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </div>
          {/* Boş değer gerçek bir seçenek — SelectValue'ya placeholder verilmez,
              aksi halde value="" ile çakışan gizli bir <option> üretilir. */}
          <Select value={assigned} onValueChange={setAssigned} className="w-[190px]">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tüm asistanlar</SelectItem>
              <SelectItem value="unassigned">Firmaya atanmamış</SelectItem>
              <SelectItem value="assigned">Firmaya atanmış</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={applySearch} disabled={isFetching}>
            <Search className="size-4" />
            Ara
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asistan Listesi</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{total} kayıt</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="relative px-0 py-0">
          {isFetching && !isLoading && !error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}

          {error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Asistanlar yüklenemedi</AlertTitle>
                <AlertDescription>{errText(error, 'Sunucuya ulaşılamadı.')}</AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Search className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Asistan bulunamadı</p>
              <p className="text-sm text-muted-foreground">
                {assigned === 'unassigned'
                  ? 'Firmaya atanmamış asistan bulunmuyor.'
                  : 'Kayıtlı asistan bulunmuyor.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asistan</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Güncellenme</TableHead>
                      {canManage && <TableHead className="text-end">İşlem</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assistants.map((a) => {
                      const s = statusMeta[a.status] ?? { label: a.status, variant: 'muted' };
                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <Link
                                href={`/cms/assistants/${a.id}`}
                                className="text-sm font-medium text-foreground hover:text-primary"
                              >
                                {a.name}
                              </Link>
                              <p className="truncate font-mono text-[11px] text-muted-foreground" title={a.id}>
                                {a.id}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {a.slug ?? '—'}
                          </TableCell>
                          <TableCell>
                            {a.companyId ? (
                              <Link
                                href={`/cms/companies/${a.companyId}`}
                                className="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground hover:text-primary"
                                title={a.companyId}
                              >
                                <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{a.companyName || shortId(a.companyId)}</span>
                              </Link>
                            ) : (
                              <Badge variant="warning">Atanmamış</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={s.variant}>{s.label}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                            {formatTrDate(a.updatedAt)}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setNotice(null);
                                  setTransferTarget(a);
                                }}
                              >
                                <ArrowRightLeft className="size-3.5" />
                                {a.companyId ? 'Firma Değiştir' : 'Firmaya Aktar'}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Sayfa <span className="font-medium text-foreground">{page}</span> / {totalPages}
                  {' · '}
                  Toplam <span className="font-medium text-foreground">{total}</span> asistan
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
                    <ChevronLeft className="size-4" />
                    Önceki
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => Math.min(p + 1, totalPages))}>
                    Sonraki
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <>
          <CreateAssistantDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onDone={(msg) => setNotice({ type: 'success', text: msg })}
          />
          <TransferAssistantDialog
            assistant={transferTarget}
            onOpenChange={(open) => !open && setTransferTarget(null)}
            onDone={(msg) => setNotice({ type: 'success', text: msg })}
          />
        </>
      )}
    </RoleGuard>
  );
}

/* ─── yeni asistan ─── */
function CreateAssistantDialog({ open, onOpenChange, onDone }) {
  const [form, setForm] = useState({
    asistan_name: '',
    title: '',
    description: '',
    locale: 'tr',
    companyId: '',
  });
  const [formError, setFormError] = useState(null);
  const [create, { isLoading }] = useCreateAssistantMutation();

  // Dialog her açılışta temiz başlasın (kapanış animasyonu bitmeden sıfırlamayalım).
  useEffect(() => {
    if (!open) return;
    setForm({ asistan_name: '', title: '', description: '', locale: 'tr', companyId: '' });
    setFormError(null);
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    const name = form.asistan_name.trim();
    if (!name) {
      setFormError('Asistan adı zorunludur.');
      return;
    }
    try {
      const res = await create({
        asistan_name: name,
        title: form.title.trim() || undefined,
        description: form.description.trim() || undefined,
        locale: form.locale,
        companyId: form.companyId || undefined,
      }).unwrap();
      const created = res?.assistant;
      onDone(
        created?.companyId
          ? `“${created.name}” oluşturuldu ve ${created.companyName || 'firmaya'} atandı. Taslak olarak kaydedildi.`
          : `“${created?.name || name}” taslak olarak oluşturuldu. Henüz bir firmaya atanmadı.`,
      );
      onOpenChange(false);
    } catch (e) {
      setFormError(errText(e, 'Asistan oluşturulamadı.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Asistan</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <Field label="Asistan Adı" required>
            <Input
              autoFocus
              value={form.asistan_name}
              onChange={set('asistan_name')}
              placeholder="Örn. Satış Asistanı"
            />
          </Field>

          <Field label="Başlık" hint="Sohbet ekranında görünen başlık (opsiyonel)">
            <Input value={form.title} onChange={set('title')} placeholder="Örn. Size nasıl yardımcı olabilirim?" />
          </Field>

          <Field label="Açıklama">
            <textarea
              rows={3}
              value={form.description}
              onChange={set('description')}
              placeholder="Asistanın ne yaptığına dair kısa not (opsiyonel)"
              className="w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </Field>

          <Field label="Dil">
            <Select value={form.locale} onValueChange={(v) => setForm((f) => ({ ...f, locale: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Firma"
            hint="Boş bırakırsanız asistan firmasız oluşturulur ve listeden istediğiniz zaman bir firmaya aktarabilirsiniz."
          >
            <CompanySelect
              value={form.companyId}
              onChange={(companyId) => setForm((f) => ({ ...f, companyId }))}
              placeholder="Firma seç (opsiyonel)"
            />
          </Field>

          <p className="text-xs text-muted-foreground">
            Yeni asistan her zaman <span className="font-medium text-foreground">taslak</span> olarak
            oluşturulur; yayına alma işlemi firma tarafında sözleşme ve kota kontrolünden geçer.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Vazgeç
          </Button>
          <Button onClick={submit} disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── firmaya aktar ─── */
function TransferAssistantDialog({ assistant, onOpenChange, onDone }) {
  const open = Boolean(assistant);
  const [companyId, setCompanyId] = useState('');
  const [formError, setFormError] = useState(null);
  const [assign, { isLoading }] = useAssignAssistantCompanyMutation();

  useEffect(() => {
    if (!open) return;
    setCompanyId('');
    setFormError(null);
  }, [open, assistant?.id]);

  const wasPublished = assistant?.status === 'published';

  const submit = async () => {
    if (!companyId) {
      setFormError('Lütfen asistanın aktarılacağı firmayı seçin.');
      return;
    }
    try {
      const res = await assign({ id: assistant.id, companyId }).unwrap();
      const target = res?.assistant;
      onDone(
        `“${target?.name || assistant.name}” ${target?.companyName || 'seçilen firmaya'} aktarıldı.` +
          (res?.unpublished ? ' Asistan taslağa alındı; yeni firmada tekrar yayınlanmalı.' : ''),
      );
      onOpenChange(false);
    } catch (e) {
      setFormError(errText(e, 'Asistan aktarılamadı.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Firmaya Aktar</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium text-foreground">{assistant?.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mevcut firma:{' '}
              {assistant?.companyId
                ? assistant.companyName || shortId(assistant.companyId)
                : 'atanmamış'}
            </p>
          </div>

          <Field label="Hedef Firma" required>
            <CompanySelect
              value={companyId}
              onChange={setCompanyId}
              placeholder="Firma seç"
            />
          </Field>

          <Alert variant={wasPublished ? 'warning' : 'info'}>
            <AlertDescription>
              Asistan seçilen firmanın sahibine devredilir: sahiplik, faturalandırma,
              kaynak bağlamaları ve ürün kapsamları yeni firmaya taşınır; araç listesi
              firmanın iş moduna göre yeniden süzülür.
              {wasPublished
                ? ' Asistan şu anda yayında — yayın kotası firma bazlı olduğu için aktarımda taslağa alınacak ve yeni firmada tekrar yayınlanması gerekecek.'
                : ''}
            </AlertDescription>
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Vazgeç
          </Button>
          <Button onClick={submit} disabled={isLoading || !companyId}>
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            Aktar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="ms-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
