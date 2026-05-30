'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Activity, ListChecks, RefreshCw, X, Plus, Play, Pencil, Trash2, Loader2,
  Inbox, HeartPulse, Save,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
  useGetCronHealthQuery,
  useGetCronStatsQuery,
  useGetCronJobsQuery,
  useGetCronJobLogsQuery,
  useCreateCronJobMutation,
  useUpdateCronJobMutation,
  useDeleteCronJobMutation,
  useRunCronJobMutation,
} from '@/redux/services';

const RESULT_META = {
  success: { label: 'Başarılı', variant: 'success' },
  failed: { label: 'Hata', variant: 'destructive' },
  queued: { label: 'Kuyrukta', variant: 'warning' },
  running: { label: 'Çalışıyor', variant: 'warning' },
  timeout: { label: 'Zaman aşımı', variant: 'destructive' },
  idle: { label: 'Beklemede', variant: 'muted' },
};
const DB_OPS = ['insert', 'update', 'update_one', 'upsert', 'bulk_insert', 'find_and_update', 'delete'];
const CRON_PRESETS = [
  { label: 'Her dakika', value: '* * * * *' },
  { label: 'Her 5 dakika', value: '*/5 * * * *' },
  { label: 'Her saat', value: '0 * * * *' },
  { label: 'Her gün 03:00', value: '0 3 * * *' },
  { label: 'Her Pazartesi 09:00', value: '0 9 * * 1' },
];

function formatTr(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

const SECTIONS = [
  { key: 'status', label: 'Genel Durum', icon: Activity, desc: 'Dashboard & sağlık' },
  { key: 'jobs', label: 'Görevler', icon: ListChecks, desc: 'Cron görev yönetimi' },
];

/* ════════════ Genel Durum ════════════ */
function StatusSection({ authorized }) {
  const stats = useGetCronStatsQuery(undefined, { skip: !authorized, pollingInterval: 20000 });
  const health = useGetCronHealthQuery(undefined, { skip: !authorized, pollingInterval: 30000 });
  const s = stats.data?.summary;
  const jobs = stats.data?.jobs ?? [];
  const h = health.data;

  const stat = (label, value, tone) => (
    <Card><CardContent className="p-4">
      <p className="text-2sm text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{stats.isFetching && !s ? '…' : value}</p>
    </CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {health.isFetching && !h ? <Badge variant="muted">Kontrol ediliyor…</Badge>
            : h?.ok === false ? <Badge variant="destructive">Erişilemiyor</Badge>
            : h?.status === 'ok' ? <Badge variant="success">Sağlıklı</Badge>
            : h?.status === 'degraded' ? <Badge variant="warning">Kısmi (degraded)</Badge>
            : <Badge variant="muted">{h?.status || '—'}</Badge>}
          {h?.scheduledJobCount != null && <span className="ms-2 text-muted-foreground">{h.scheduledJobCount} görev zamanlayıcıda</span>}
        </div>
        <Button variant="outline" size="sm" onClick={() => { stats.refetch(); health.refetch(); }} disabled={stats.isFetching}>
          <RefreshCw className={stats.isFetching ? 'size-4 animate-spin' : 'size-4'} /> Yenile
        </Button>
      </div>

      {stats.isError ? (
        <Alert variant="destructive"><AlertTitle>Cron servisine ulaşılamadı</AlertTitle><AlertDescription>Köprü (tinnten-server /cron) veya cron servisi çalışmıyor olabilir.</AlertDescription></Alert>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stat('Toplam Görev', s?.totalJobs ?? 0)}
          {stat('Aktif', s?.activeJobs ?? 0, 'text-green-600')}
          {stat('Zamanlayıcıda', s?.scheduledNow ?? 0, 'text-primary')}
          {stat('24s Hata', s?.failuresLast24h ?? 0, (s?.failuresLast24h ?? 0) > 0 ? 'text-destructive' : undefined)}
        </div>
      )}

      {/* Zorunlu görev sağlığı */}
      {Array.isArray(h?.requiredJobs) && h.requiredJobs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="size-4 text-primary" /> Zorunlu Görevler</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {h.requiredJobs.map((rj) => (
              <div key={rj.name} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium">{rj.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {rj.lastResult && <Badge variant={(RESULT_META[rj.lastResult] || {}).variant || 'muted'}>{(RESULT_META[rj.lastResult] || {}).label || rj.lastResult}</Badge>}
                  <Badge variant={rj.healthy ? 'success' : 'destructive'}>{rj.healthy ? 'Sağlıklı' : 'Sorunlu'}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Görev başına 24s özet */}
      <Card>
        <CardHeader><CardTitle>Son 24 Saat (Görev Bazında)</CardTitle></CardHeader>
        <CardContent className="px-0 py-0">
          {stats.isFetching && jobs.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center"><Inbox className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Görev yok</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Görev</TableHead>
                    <TableHead>Cron</TableHead>
                    <TableHead>Son Sonuç</TableHead>
                    <TableHead>Toplam</TableHead>
                    <TableHead>Başarı</TableHead>
                    <TableHead>Hata</TableHead>
                    <TableHead>Ort. Süre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => {
                    const rm = RESULT_META[j.lastResult] || { label: j.lastResult, variant: 'muted' };
                    return (
                      <TableRow key={j.jobId}>
                        <TableCell className="text-sm font-medium text-foreground">{j.name}{!j.isActive && <Badge variant="muted" className="ms-2">pasif</Badge>}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{j.cron}</TableCell>
                        <TableCell><Badge variant={rm.variant}>{rm.label}</Badge></TableCell>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">{j.last24h?.total ?? 0}</TableCell>
                        <TableCell className="text-sm tabular-nums text-green-600">{j.last24h?.success ?? 0}</TableCell>
                        <TableCell className="text-sm tabular-nums text-destructive">{j.last24h?.failed ?? 0}</TableCell>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">{j.last24h?.avgDurationMs != null ? `${Math.round(j.last24h.avgDurationMs)}ms` : '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ════════════ Görevler ════════════ */
const emptyForm = { name: '', description: '', cron: '', timezone: '', isActive: true, opType: 'webhook', callbackUrl: '', secret: '', collection: '', query: '', payload: '' };

function JobsSection({ authorized }) {
  const { data, isFetching, isError, refetch } = useGetCronJobsQuery(undefined, { skip: !authorized });
  const jobs = Array.isArray(data) ? data : [];

  const [createJob, { isLoading: creating }] = useCreateCronJobMutation();
  const [updateJob, { isLoading: updating }] = useUpdateCronJobMutation();
  const [deleteJob] = useDeleteCronJobMutation();
  const [runJob] = useRunCronJobMutation();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(null);
  const [logsFor, setLogsFor] = useState(null);

  const startCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowForm(true); };
  const startEdit = (j) => {
    const op = j.operation || {};
    setEditId(j._id);
    setForm({
      name: j.name || '', description: j.description || '', cron: j.cron || '', timezone: j.timezone || '',
      isActive: j.isActive !== false, opType: op.type || 'webhook',
      callbackUrl: op.callbackUrl || '', secret: op.secret || '', collection: op.collection || '',
      query: op.query ? JSON.stringify(op.query, null, 2) : '', payload: op.payload ? JSON.stringify(op.payload, null, 2) : '',
    });
    setFormError(''); setShowForm(true);
  };

  const buildBody = () => {
    const operation = { type: form.opType };
    if (form.opType === 'webhook') {
      operation.callbackUrl = form.callbackUrl.trim();
      if (form.secret.trim()) operation.secret = form.secret.trim();
    } else {
      operation.collection = form.collection.trim();
      if (form.query.trim()) operation.query = JSON.parse(form.query);
      if (form.payload.trim()) operation.payload = JSON.parse(form.payload);
    }
    const body = {
      name: form.name.trim(), description: form.description.trim(), cron: form.cron.trim(),
      isActive: form.isActive, operation,
    };
    if (form.timezone.trim()) body.timezone = form.timezone.trim();
    return body;
  };

  const submit = async () => {
    setFormError('');
    let body;
    try { body = buildBody(); }
    catch { setFormError('Query/Payload geçerli JSON olmalı.'); return; }
    if (!body.name || !body.cron) { setFormError('Ad ve cron zorunlu.'); return; }
    if (body.operation.type === 'webhook' && !body.operation.callbackUrl) { setFormError('Webhook için callbackUrl zorunlu.'); return; }
    if (body.operation.type !== 'webhook' && !body.operation.collection) { setFormError('DB işlemi için collection zorunlu.'); return; }
    try {
      if (editId) await updateJob({ id: editId, ...body }).unwrap();
      else await createJob(body).unwrap();
      setShowForm(false); setEditId(null); setForm(emptyForm);
    } catch (e) {
      setFormError(e?.data?.message || e?.error || 'Kaydedilemedi.');
    }
  };

  const toggleActive = async (j) => {
    setBusy(`${j._id}:toggle`);
    await updateJob({ id: j._id, isActive: !(j.isActive !== false) }).unwrap().catch(() => {});
    setBusy(null);
  };
  const run = async (j) => {
    setBusy(`${j._id}:run`);
    await runJob(j._id).unwrap().catch(() => {});
    setBusy(null);
  };
  const remove = async (j) => {
    if (!window.confirm(`"${j.name}" görevi silinsin mi? Bu işlem geri alınamaz.`)) return;
    setBusy(`${j._id}:del`);
    await deleteJob(j._id).unwrap().catch(() => {});
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className="text-xs text-muted-foreground">{jobs.length} görev</span>
          <div className="ms-auto flex gap-2">
            <Button variant="ghost" size="icon" onClick={refetch} disabled={isFetching}><RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /></Button>
            <Button size="sm" onClick={startCreate}><Plus className="size-4" /> Yeni Görev</Button>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader><CardTitle>{editId ? 'Görevi Düzenle' : 'Yeni Cron Görevi'}</CardTitle>
            <CardToolbar><Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="size-4" /></Button></CardToolbar>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><label className="text-2sm font-medium">Ad *</label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Benzersiz görev adı" /></div>
              <div className="space-y-1.5"><label className="text-2sm font-medium">Cron İfadesi *</label>
                <Input list="cron-presets" value={form.cron} onChange={(e) => setForm((f) => ({ ...f, cron: e.target.value }))} placeholder="*/5 * * * *" className="font-mono" />
                <datalist id="cron-presets">{CRON_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</datalist>
              </div>
              <div className="space-y-1.5"><label className="text-2sm font-medium">Zaman Dilimi</label>
                <Input value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} placeholder="Europe/Istanbul" /></div>
              <div className="space-y-1.5"><label className="text-2sm font-medium">İşlem Tipi *</label>
                <Select value={form.opType} onValueChange={(v) => setForm((f) => ({ ...f, opType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webhook">webhook</SelectItem>
                    {DB_OPS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5"><label className="text-2sm font-medium">Açıklama</label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Opsiyonel" /></div>

            {form.opType === 'webhook' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><label className="text-2sm font-medium">Callback URL *</label>
                  <Input value={form.callbackUrl} onChange={(e) => setForm((f) => ({ ...f, callbackUrl: e.target.value }))} placeholder="https://…" /></div>
                <div className="space-y-1.5"><label className="text-2sm font-medium">Secret</label>
                  <Input value={form.secret} onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))} placeholder="Opsiyonel imza anahtarı" /></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5"><label className="text-2sm font-medium">Collection *</label>
                  <Input value={form.collection} onChange={(e) => setForm((f) => ({ ...f, collection: e.target.value }))} placeholder="mongo koleksiyon adı" /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><label className="text-2sm font-medium">Query (JSON)</label>
                    <textarea value={form.query} onChange={(e) => setForm((f) => ({ ...f, query: e.target.value }))} rows={4}
                      className="w-full rounded-lg border border-border bg-background p-2 font-mono text-xs" placeholder='{ "status": "pending" }' /></div>
                  <div className="space-y-1.5"><label className="text-2sm font-medium">Payload (JSON)</label>
                    <textarea value={form.payload} onChange={(e) => setForm((f) => ({ ...f, payload: e.target.value }))} rows={4}
                      className="w-full rounded-lg border border-border bg-background p-2 font-mono text-xs" placeholder='{ "$set": { "x": 1 } }' /></div>
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Aktif
            </label>

            {formError && <Alert variant="warning"><AlertTitle>Hata</AlertTitle><AlertDescription>{formError}</AlertDescription></Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>İptal</Button>
              <Button size="sm" disabled={creating || updating} onClick={submit}>
                {creating || updating ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Kaydet
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="px-0 py-0">
          {isError ? (
            <div className="p-4"><Alert variant="destructive"><AlertTitle>Yüklenemedi</AlertTitle><AlertDescription>Görev listesi alınamadı.</AlertDescription></Alert></div>
          ) : isFetching && jobs.length === 0 ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center"><Inbox className="size-6 text-muted-foreground" /><p className="font-semibold text-foreground">Görev yok</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Görev</TableHead>
                    <TableHead>Cron</TableHead>
                    <TableHead>İşlem</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Son Çalışma</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => {
                    const rm = RESULT_META[j.lastResult] || { label: j.lastResult, variant: 'muted' };
                    return (
                      <TableRow key={j._id}>
                        <TableCell className="cursor-pointer" onClick={() => setLogsFor(j)}>
                          <div className="font-medium text-foreground">{j.name}</div>
                          {j.description && <div className="max-w-[220px] truncate text-xs text-muted-foreground">{j.description}</div>}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{j.cron}</TableCell>
                        <TableCell><Badge variant="outline">{j.operation?.type || '—'}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant={j.isActive !== false ? 'success' : 'muted'}>{j.isActive !== false ? 'Aktif' : 'Pasif'}</Badge>
                            <Badge variant={rm.variant}>{rm.label}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTr(j.lastRunAt)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-7" title="Şimdi çalıştır" disabled={busy === `${j._id}:run`} onClick={() => run(j)}>
                              {busy === `${j._id}:run` ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 text-green-600" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7" title={j.isActive !== false ? 'Pasife al' : 'Aktif et'} disabled={busy === `${j._id}:toggle`} onClick={() => toggleActive(j)}>
                              {busy === `${j._id}:toggle` ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className={cn('size-3.5', j.isActive !== false ? 'text-amber-600' : 'text-muted-foreground')} />}
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7" title="Düzenle" onClick={() => startEdit(j)}><Pencil className="size-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="size-7" title="Sil" disabled={busy === `${j._id}:del`} onClick={() => remove(j)}>
                              {busy === `${j._id}:del` ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5 text-destructive" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {logsFor && <JobLogs job={logsFor} onClose={() => setLogsFor(null)} />}
    </div>
  );
}

function JobLogs({ job, onClose }) {
  const { data, isFetching } = useGetCronJobLogsQuery({ id: job._id, page: 1, limit: 30 });
  const logs = data?.logs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="flex max-h-[88vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="truncate">{job.name} — Loglar</CardTitle>
          <CardToolbar><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></CardToolbar>
        </CardHeader>
        <CardContent className="space-y-2 overflow-y-auto p-5">
          {isFetching ? <Skeleton className="h-48 w-full" /> : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Log kaydı yok.</p>
          ) : (
            logs.map((l) => {
              const rm = RESULT_META[l.status] || { label: l.status, variant: 'muted' };
              return (
                <div key={l._id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={rm.variant}>{rm.label}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{formatTr(l.startedAt || l.createdAt)}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    {l.duration != null && <div>Süre: {l.duration}ms</div>}
                    {l.operation && <div>Tip: {l.operation}</div>}
                    {l.httpStatus != null && <div>HTTP: {l.httpStatus}</div>}
                    {l.documentsAffected != null && <div>Etkilenen: {l.documentsAffected}</div>}
                  </div>
                  {l.error && <p className="mt-1 break-words text-xs text-destructive">{l.error}</p>}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ════════════ Sayfa ════════════ */
export default function CronServicePage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ADMIN]);
  const [section, setSection] = useState('status');

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        section="Servisler"
        title="Cron Servisi"
        description="tinnten-cron: zamanlanmış görevler, çalışma geçmişi ve sağlık"
      />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <nav className="space-y-0.5 p-2">
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const active = section === sec.key;
                return (
                  <button key={sec.key} onClick={() => setSection(sec.key)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    )}>
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{sec.label}</span>
                      <span className="block text-xs text-muted-foreground">{sec.desc}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        <div>
          {section === 'status' && <StatusSection authorized={authorized} />}
          {section === 'jobs' && <JobsSection authorized={authorized} />}
        </div>
      </div>
    </RoleGuard>
  );
}
