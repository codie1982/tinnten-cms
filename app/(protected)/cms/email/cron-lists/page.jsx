'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Trash2, Play, Save, Loader2, X, Eye, RefreshCw } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import {
  useGetCronListsQuery,
  useGetCronListSchemaQuery,
  useCreateCronListMutation,
  useUpdateCronListMutation,
  useDeleteCronListMutation,
  useRunCronListMutation,
  usePreviewCronListMutation,
} from '@/redux/services';

const SELECT_CLS =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30';

const CRON_PRESETS = [
  { label: 'Her gün 09:00', cron: '0 9 * * *' },
  { label: 'Her hafta (Pzt 09:00)', cron: '0 9 * * 1' },
  { label: "Her ayın 1'i 09:00", cron: '0 9 1 * *' },
  { label: 'Saatte bir', cron: '0 * * * *' },
];

const OP_LABELS = {
  eq: '= eşit', ne: '≠ değil', in: 'içinde (virgülle)', nin: 'dışında (virgülle)',
  gt: '> büyük', gte: '≥ büyük/eşit', lt: '< küçük', lte: '≤ küçük/eşit', exists: 'var/yok',
};

const emptyForm = () => ({
  id: null,
  name: '',
  description: '',
  source: 'company',
  queryMode: 'builder',
  filters: [],
  relations: [],
  pipelineText: '[\n  { "$match": {} }\n]',
  buildMode: 'append',
  maxRecipients: 5000,
  schedule: { cron: '0 9 * * *', timezone: 'Europe/Istanbul' },
});

export default function CronListsPage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.EDITOR]);

  const { data: lists = [], isLoading } = useGetCronListsQuery({}, { skip: !authorized });
  const { data: schema } = useGetCronListSchemaQuery(undefined, { skip: !authorized });

  const [createList, { isLoading: creating }] = useCreateCronListMutation();
  const [updateList, { isLoading: saving }] = useUpdateCronListMutation();
  const [deleteList] = useDeleteCronListMutation();
  const [runList] = useRunCronListMutation();
  const [previewList, { isLoading: previewing }] = usePreviewCronListMutation();

  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(null);

  const sources = schema?.sources || {};
  const ops = schema?.ops || ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'exists'];
  const sourceDef = form ? sources[form.source] : null;
  const fields = sourceDef?.fields || [];
  const relations = sourceDef?.relations || [];

  const fieldType = (name) => fields.find((f) => f.name === name)?.type;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSchedule = (k, v) => setForm((f) => ({ ...f, schedule: { ...f.schedule, [k]: v } }));

  const openNew = () => { setPreview(null); setNotice(''); setForm(emptyForm()); };
  const openEdit = (row) => {
    setPreview(null); setNotice('');
    setForm({
      id: row._id,
      name: row.name || '',
      description: row.description || '',
      source: row.source || 'company',
      queryMode: row.queryMode || 'builder',
      filters: (row.filters || []).map((f) => ({
        field: f.field, op: f.op,
        rel: f.value && typeof f.value === 'object' && 'relativeDays' in f.value,
        value: f.value && typeof f.value === 'object' && 'relativeDays' in f.value
          ? f.value.relativeDays
          : Array.isArray(f.value) ? f.value.join(',') : f.value,
      })),
      relations: row.relations || [],
      pipelineText: JSON.stringify(row.pipeline || [], null, 2),
      buildMode: row.buildMode || 'append',
      maxRecipients: row.maxRecipients ?? 5000,
      schedule: { cron: row.schedule?.cron || '0 9 * * *', timezone: row.schedule?.timezone || 'Europe/Istanbul' },
    });
  };

  const changeSource = (src) => setForm((f) => ({ ...f, source: src, filters: [], relations: [] }));

  const addFilter = () => set('filters', [...form.filters, { field: fields[0]?.name || '', op: 'eq', value: '', rel: false }]);
  const setFilter = (i, patch) => set('filters', form.filters.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const rmFilter = (i) => set('filters', form.filters.filter((_, j) => j !== i));

  const toggleRelation = (name) =>
    set('relations', form.relations.includes(name) ? form.relations.filter((r) => r !== name) : [...form.relations, name]);

  const parsePipeline = () => {
    let p;
    try { p = JSON.parse(form.pipelineText || '[]'); }
    catch (e) { throw new Error('Pipeline JSON geçersiz: ' + e.message); }
    if (!Array.isArray(p)) throw new Error('Pipeline bir dizi (array) olmalı.');
    return p;
  };

  const buildQuery = () => {
    if (form.queryMode === 'aggregate') {
      return { source: form.source, queryMode: 'aggregate', pipeline: parsePipeline() };
    }
    return {
      source: form.source,
      queryMode: 'builder',
      filters: form.filters.filter((f) => f.field && f.op).map((f) => {
        let value;
        if (f.op === 'exists') value = f.value === true || f.value === 'true';
        else if (f.op === 'in' || f.op === 'nin') value = String(f.value).split(',').map((s) => s.trim()).filter(Boolean);
        else if (f.rel) value = { relativeDays: Number(f.value) || 0 };
        else value = f.value;
        return { field: f.field, op: f.op, value };
      }),
      relations: form.relations,
    };
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim(),
    ...buildQuery(),
    buildMode: form.buildMode,
    maxRecipients: Number(form.maxRecipients) || 5000,
    schedule: { cron: form.schedule.cron.trim(), timezone: form.schedule.timezone.trim() || 'Europe/Istanbul' },
  });

  const doPreview = async () => {
    setNotice('');
    let query;
    try { query = buildQuery(); } catch (e) { setPreview(null); return setNotice(e.message); }
    const r = await previewList(query).unwrap().catch((e) => ({ __err: e?.data?.message || 'Önizleme başarısız' }));
    if (r?.__err) { setPreview(null); return setNotice(r.__err); }
    setPreview(r);
  };

  const save = async () => {
    setNotice('');
    if (!form.name.trim()) return setNotice('Liste adı zorunlu.');
    if (!form.schedule.cron.trim()) return setNotice('Zamanlama (cron) zorunlu.');
    let payload;
    try { payload = buildPayload(); } catch (e) { return setNotice(e.message); }
    const action = form.id
      ? updateList({ id: form.id, ...payload })
      : createList(payload);
    const r = await action.unwrap().catch((e) => ({ __err: e?.data?.message || 'Kaydedilemedi' }));
    if (r?.__err) return setNotice(r.__err);
    setNotice(form.id ? 'Cron listesi güncellendi.' : 'Cron listesi oluşturuldu.');
    setForm(null);
  };

  const onRun = async (row) => {
    const r = await runList(row._id).unwrap().catch((e) => ({ __err: e?.data?.message || 'Tetiklenemedi' }));
    setNotice(r?.__err || `"${row.name}" tetiklendi — liste arka planda oluşturuluyor.`);
  };

  const onDelete = async (row) => {
    if (!window.confirm(`"${row.name}" silinsin mi? (cron job + kanal arşivlenir)`)) return;
    const r = await deleteList(row._id).unwrap().catch((e) => ({ __err: e?.data?.message || 'Silinemedi' }));
    setNotice(r?.__err || 'Silindi.');
    if (form?.id === row._id) setForm(null);
  };

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageHeader
        breadcrumb={[
          { label: 'Email' },
          { label: 'Cron Listeleri' },
        ]}
        title="Cron Listeleri"
        description="DB sorgularından Cron kanalında otomatik güncellenen listeler"
        actions={
          <Button onClick={openNew}><Plus className="size-4" /> Yeni Liste</Button>
        }
      />

      {notice && <Alert variant="info" className="mb-4"><AlertDescription>{notice}</AlertDescription></Alert>}

      {form && (
        <Card className="mb-5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{form.id ? 'Listeyi Düzenle' : 'Yeni Cron Listesi'}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setForm(null)}><X className="size-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">Ad</label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Örn. Asistansız yeni firmalar" />
              </div>
              <div className="min-w-[220px] flex-[2]">
                <label className="mb-1 block text-xs text-muted-foreground">Açıklama</label>
                <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Kampanyalar'da bu metinle görünür" />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="min-w-[180px]">
                <label className="mb-1 block text-xs text-muted-foreground">Kaynak</label>
                <select className={SELECT_CLS} value={form.source} onChange={(e) => changeSource(e.target.value)}>
                  {Object.entries(sources).map(([key, def]) => (
                    <option key={key} value={key}>{def.label || key}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[180px]">
                <label className="mb-1 block text-xs text-muted-foreground">Sorgu modu</label>
                <select className={SELECT_CLS} value={form.queryMode} onChange={(e) => set('queryMode', e.target.value)}>
                  <option value="builder">Yapılandırılmış (filtre + ilişki)</option>
                  <option value="aggregate">JSON Aggregate (gelişmiş)</option>
                </select>
              </div>
              <div className="min-w-[160px]">
                <label className="mb-1 block text-xs text-muted-foreground">Oluşturma modu</label>
                <select className={SELECT_CLS} value={form.buildMode} onChange={(e) => set('buildMode', e.target.value)}>
                  <option value="append">Biriktir (append)</option>
                  <option value="replace">Yenile (replace)</option>
                </select>
              </div>
              <div className="w-40">
                <label className="mb-1 block text-xs text-muted-foreground">Max alıcı</label>
                <Input type="number" min={1} value={form.maxRecipients} onChange={(e) => set('maxRecipients', e.target.value)} />
              </div>
            </div>

            {form.queryMode === 'aggregate' && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Aggregation pipeline (JSON dizi) — kaynak: <b>{sourceDef?.label || form.source}</b>
                </label>
                <textarea
                  className="h-56 w-full rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/30"
                  value={form.pipelineText}
                  onChange={(e) => set('pipelineText', e.target.value)}
                  spellCheck={false}
                  placeholder='[ { "$match": { "active": true } } ]'
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Sonuç dokümanları şu alanları döndürmeli:{' '}
                  <code>{(sourceDef?.aggregateIdFields || []).join(', ') || '—'}</code>. Yasak operatörler:{' '}
                  <code>{(schema?.aggregate?.forbiddenOperators || []).join(', ')}</code>. Sona otomatik <code>$limit</code> eklenir.
                </p>
              </div>
            )}

            {form.queryMode === 'builder' && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Filtreler (DB sorgusu)</label>
                  <div className="space-y-2">
                    {form.filters.map((f, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <select className={`${SELECT_CLS} w-44`} value={f.field} onChange={(e) => setFilter(i, { field: e.target.value })}>
                          {fields.map((fl) => <option key={fl.name} value={fl.name}>{fl.name} ({fl.type})</option>)}
                        </select>
                        <select className={`${SELECT_CLS} w-40`} value={f.op} onChange={(e) => setFilter(i, { op: e.target.value })}>
                          {ops.map((o) => <option key={o} value={o}>{OP_LABELS[o] || o}</option>)}
                        </select>
                        {f.op === 'exists' ? (
                          <select className={`${SELECT_CLS} w-28`} value={String(f.value)} onChange={(e) => setFilter(i, { value: e.target.value })}>
                            <option value="true">var</option>
                            <option value="false">yok</option>
                          </select>
                        ) : (
                          <Input
                            className="w-44"
                            placeholder={f.rel ? 'N (gün önce)' : 'değer'}
                            value={f.value}
                            onChange={(e) => setFilter(i, { value: e.target.value })}
                          />
                        )}
                        {fieldType(f.field) === 'date' && f.op !== 'exists' && (
                          <label className="flex items-center gap-1 text-xs text-muted-foreground">
                            <input type="checkbox" checked={!!f.rel} onChange={(e) => setFilter(i, { rel: e.target.checked })} />
                            son N gün
                          </label>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => rmFilter(i)}><Trash2 className="size-3.5" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addFilter} disabled={!fields.length}>
                      <Plus className="size-3.5" /> Filtre ekle
                    </Button>
                  </div>
                </div>

                {relations.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">İlişki koşulları</label>
                    <div className="flex flex-wrap gap-3">
                      {relations.map((r) => (
                        <label key={r.name} className="flex items-center gap-1.5 text-sm">
                          <input type="checkbox" checked={form.relations.includes(r.name)} onChange={() => toggleRelation(r.name)} />
                          {r.label || r.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-3">
              <div className="min-w-[200px]">
                <label className="mb-1 block text-xs text-muted-foreground">Sıklık (preset)</label>
                <select
                  className={SELECT_CLS}
                  value={CRON_PRESETS.find((p) => p.cron === form.schedule.cron)?.cron || ''}
                  onChange={(e) => e.target.value && setSchedule('cron', e.target.value)}
                >
                  <option value="">— özel —</option>
                  {CRON_PRESETS.map((p) => <option key={p.cron} value={p.cron}>{p.label}</option>)}
                </select>
              </div>
              <div className="w-44">
                <label className="mb-1 block text-xs text-muted-foreground">Cron ifadesi</label>
                <Input className="font-mono text-xs" value={form.schedule.cron} onChange={(e) => setSchedule('cron', e.target.value)} />
              </div>
              <div className="w-48">
                <label className="mb-1 block text-xs text-muted-foreground">Zaman dilimi</label>
                <Input value={form.schedule.timezone} onChange={(e) => setSchedule('timezone', e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button onClick={save} disabled={creating || saving}>
                {creating || saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Kaydet
              </Button>
              <Button variant="outline" onClick={doPreview} disabled={previewing}>
                {previewing ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />} Önizleme
              </Button>
              {preview && (
                <span className="text-sm text-muted-foreground">
                  Eşleşen (tahmini): <b>{preview.count}{preview.capped ? '+' : ''}</b>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Tanımlı Cron Listeleri</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Yükleniyor…</div>
          ) : lists.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Henüz cron listesi yok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="p-3">Ad</th>
                    <th className="p-3">Kaynak</th>
                    <th className="p-3">Zamanlama</th>
                    <th className="p-3">Son üretim</th>
                    <th className="p-3">Durum</th>
                    <th className="p-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.map((row) => (
                    <tr key={row._id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <button className="text-primary hover:underline" onClick={() => openEdit(row)}>{row.name}</button>
                        {row.description && <div className="text-xs text-muted-foreground">{row.description}</div>}
                      </td>
                      <td className="p-3">{sources[row.source]?.label || row.source}</td>
                      <td className="p-3 font-mono text-xs">
                        {row.schedule?.cron}{' '}
                        <span className="text-muted-foreground">({row.schedule?.timezone})</span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {row.lastBuiltAt ? `${new Date(row.lastBuiltAt).toLocaleString('tr-TR')} · ${row.lastBuiltCount ?? 0} kişi` : '—'}
                        {row.lastError && <div className="text-destructive">{row.lastError}</div>}
                      </td>
                      <td className="p-3">
                        <Badge variant={row.status === 'active' ? 'secondary' : 'outline'}>{row.status}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" title="Şimdi çalıştır" onClick={() => onRun(row)}>
                            <Play className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Düzenle" onClick={() => openEdit(row)}>
                            <RefreshCw className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Sil" onClick={() => onDelete(row)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
