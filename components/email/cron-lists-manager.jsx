'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Play, Save, Loader2, X, Eye, RefreshCw, Users, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useGetCronListsQuery,
  useGetCronListSchemaQuery,
  useCreateCronListMutation,
  useUpdateCronListMutation,
  useDeleteCronListMutation,
  useRunCronListMutation,
  usePreviewCronListMutation,
  useDryRunCronListMutation,
} from '@/redux/services';

const SELECT_CLS =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30';

const CRON_PRESETS = [
  { label: 'Her gün 09:00', cron: '0 9 * * *' },
  { label: 'Her hafta (Pzt 09:00)', cron: '0 9 * * 1' },
  { label: "Her ayın 1'i 09:00", cron: '0 9 1 * *' },
  { label: 'Saatte bir', cron: '0 * * * *' },
];

const countFormatter = new Intl.NumberFormat('tr-TR');
const formatCount = (value) => countFormatter.format(Number(value) || 0);

// "Test Et" tarama tavanı seçenekleri. Backend DRY_RUN_MAX_CAP=5000 ile sınırlar;
// buradan daha büyük bir değer göndermek işe yaramaz.
const SCAN_CAPS = [1000, 2500, 5000];

const OP_LABELS = {
  eq: '= eşit', ne: '≠ değil', in: 'içinde (virgülle)', nin: 'dışında (virgülle)',
  gt: '> büyük', gte: '≥ büyük/eşit', lt: '< küçük', lte: '≤ küçük/eşit', exists: 'var/yok',
};

// Tarih alanları için göreli pencere birimi. Backend hem relativeDays hem
// relativeHours çözer; "son 24 saat" gibi gün'e bölünmeyen pencereler saatle
// kurulmalı — gün alanına 0 yazmak `createdAt >= şimdi` demektir (boş liste).
const REL_UNITS = [
  { value: '', label: 'sabit değer' },
  { value: 'days', label: 'son N gün' },
  { value: 'hours', label: 'son N saat' },
];

// Satır bazında `reason` (snake_case) ve özet sayaç anahtarları (camelCase) ayrı
// gelir — ikisi de aynı etiketlere bağlanır.
const SKIP_REASONS = {
  no_email: 'E-posta yok',
  keycloak_error: 'Keycloak’a ulaşılamadı',
  duplicate: 'Aynı e-posta tekrar',
  unsubscribed: 'Listeden çıkmış',
  already_member: 'Zaten üye',
  guest: 'Misafir kullanıcı',
  no_source: 'Kaynak kaydı yok',
};

const SKIP_COUNTER_LABELS = {
  noEmail: SKIP_REASONS.no_email,
  keycloakError: SKIP_REASONS.keycloak_error,
  duplicate: SKIP_REASONS.duplicate,
  unsubscribed: SKIP_REASONS.unsubscribed,
  alreadyMember: SKIP_REASONS.already_member,
  guest: SKIP_REASONS.guest,
  noSource: SKIP_REASONS.no_source,
};

// Alıcının e-postasının nereden çözüldüğü. "mongo" dışı pay, Keycloak→Mongo
// kimlik senkronunun eksik olduğunu gösterir (bkz. auditKeycloakIdentitySync).
const SOURCE_LABELS = { mongo: 'Mongo', keycloak: 'Keycloak', company: 'Firma e-postası' };

const MONGO_OP_SYMBOLS = {
  $eq: '=', $ne: '≠', $gt: '>', $gte: '≥', $lt: '<', $lte: '≤',
  $in: 'içinde', $nin: 'dışında', $exists: 'var mı',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const formatFilterValue = (v) => {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'string' && ISO_DATE.test(v)) return new Date(v).toLocaleString('tr-TR');
  if (typeof v === 'boolean') return v ? 'evet' : 'hayır';
  return String(v);
};

/**
 * Derlenmiş Mongo filtresini okunur satırlara çevirir. Göreli tarihler backend'de
 * ÇÖZÜLMÜŞ geldiği için "createdAt ≥ 10.08.2026 09:00" gibi gerçek pencere görünür
 * — sessizce boş liste üreten hatalı göreli değerler burada yakalanır.
 */
const describeFilter = (filter) => {
  if (!filter || typeof filter !== 'object') return [];
  return Object.entries(filter).flatMap(([field, cond]) => {
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      return Object.entries(cond).map(
        ([op, v]) => `${field} ${MONGO_OP_SYMBOLS[op] || op} ${formatFilterValue(v)}`
      );
    }
    return [`${field} = ${formatFilterValue(cond)}`];
  });
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
  channelKey: null, // kayıtlı reçetede üyelik/çıkış kontrolü için gerekli
  schedule: { cron: '0 9 * * *', timezone: 'Europe/Istanbul' },
});

/**
 * Cron listeleri yönetimi (form + tablo) — sayfadan bağımsız, gömülebilir.
 * `Mail Listeleri > Cron` sekmesi altında kullanılır. Her satırdan liste
 * detayına (üyeler) `/cms/email/lists/<channelKey>` ile gidilir.
 */
export function CronListsManager({ authorized }) {
  const { data: lists = [], isLoading } = useGetCronListsQuery({}, { skip: !authorized });
  const { data: schema } = useGetCronListSchemaQuery(undefined, { skip: !authorized });

  const [createList, { isLoading: creating }] = useCreateCronListMutation();
  const [updateList, { isLoading: saving }] = useUpdateCronListMutation();
  const [deleteList] = useDeleteCronListMutation();
  const [runList] = useRunCronListMutation();
  const [previewList, { isLoading: previewing }] = usePreviewCronListMutation();
  const [dryRunList] = useDryRunCronListMutation();

  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(null);
  // { title, data } — form taslağının ya da tablodaki bir reçetenin test sonucu.
  const [dryRun, setDryRun] = useState(null);
  const [dryRunFor, setDryRunFor] = useState(null); // spinner hedefi: 'form' | row._id
  const [scanCap, setScanCap] = useState(SCAN_CAPS[0]); // "Test Et" tarama tavanı

  const sources = schema?.sources || {};
  const ops = schema?.ops || ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'exists'];
  const sourceDef = form ? sources[form.source] : null;
  const fields = sourceDef?.fields || [];
  const relations = sourceDef?.relations || [];

  const fieldType = (name) => fields.find((f) => f.name === name)?.type;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSchedule = (k, v) => setForm((f) => ({ ...f, schedule: { ...f.schedule, [k]: v } }));

  const openNew = () => { setPreview(null); setDryRun(null); setNotice(''); setForm(emptyForm()); };
  const openEdit = (row) => {
    setPreview(null); setDryRun(null); setNotice('');
    setForm({
      id: row._id,
      name: row.name || '',
      description: row.description || '',
      source: row.source || 'company',
      queryMode: row.queryMode || 'builder',
      // Göreli değerin BİRİMİNİ koru. Yalnız relativeDays'e bakan eski sürüm,
      // saatle kurulmuş bir filtreyi ekranda [object Object] gösterip kaydedince
      // relativeDays:0'a (boş liste) çeviriyordu.
      filters: (row.filters || []).map((f) => {
        const obj = f.value && typeof f.value === 'object' && !Array.isArray(f.value) ? f.value : null;
        const rel = obj && 'relativeHours' in obj ? 'hours' : obj && 'relativeDays' in obj ? 'days' : '';
        return {
          field: f.field,
          op: f.op,
          rel,
          value: rel === 'hours' ? obj.relativeHours
            : rel === 'days' ? obj.relativeDays
            : Array.isArray(f.value) ? f.value.join(',') : f.value,
        };
      }),
      relations: row.relations || [],
      pipelineText: JSON.stringify(row.pipeline || [], null, 2),
      buildMode: row.buildMode || 'append',
      maxRecipients: row.maxRecipients ?? 5000,
      channelKey: row.channelKey || null,
      schedule: { cron: row.schedule?.cron || '0 9 * * *', timezone: row.schedule?.timezone || 'Europe/Istanbul' },
    });
  };

  const changeSource = (src) => setForm((f) => ({ ...f, source: src, filters: [], relations: [] }));

  const addFilter = () => set('filters', [...form.filters, { field: fields[0]?.name || '', op: 'eq', value: '', rel: '' }]);

  /**
   * Operatör değişince `value` normalize edilir. Önceden devralınıyordu ve
   * `exists`'e geçen satır `value: ''` ile kalıyordu: `buildQuery` bunu
   * `false`'a çevirdiği için, ekranda "var" yazarken sorguya `$exists: false`
   * ("alan YOK") gidiyordu — yani tam tersi. Kullanıcı dropdown'a hiç
   * dokunmazsa liste sessizce boş/yanlış çıkıyordu.
   */
  const setFilter = (i, patch) =>
    set('filters', form.filters.map((f, j) => {
      if (j !== i) return f;
      const next = { ...f, ...patch };
      if (patch.op !== undefined && patch.op !== f.op) {
        next.value = patch.op === 'exists' ? 'true' : '';
        if (patch.op === 'exists') next.rel = '';
      }
      return next;
    }));
  const rmFilter = (i) => set('filters', form.filters.filter((_, j) => j !== i));

  const toggleRelation = (name) =>
    set('relations', form.relations.includes(name) ? form.relations.filter((r) => r !== name) : [...form.relations, name]);

  /**
   * Pipeline'ı doğrular ve backend'e DÜZ METİN olarak gönderilecek hâlini üretir.
   *
   * Dizi olarak gönderilemez: backend'deki global `express-mongo-sanitize`
   * `$match`/`$group` gibi anahtarları silip pipeline'ı `[{}]`'e çeviriyordu —
   * reçete sorunsuz kaydediliyor ama liste hiç oluşmuyordu. Sanitizer string
   * değerlere dokunmadığı için metin olarak yollanır, backend parse eder.
   */
  const buildPipelineText = () => {
    let p;
    try { p = JSON.parse(form.pipelineText || '[]'); }
    catch (e) { throw new Error('Pipeline JSON geçersiz: ' + e.message); }
    if (!Array.isArray(p)) throw new Error('Pipeline bir dizi (array) olmalı.');
    if (p.length === 0) throw new Error('Aggregate pipeline boş olamaz (örn. [ { "$match": { ... } } ]).');
    p.forEach((stage, i) => {
      if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
        throw new Error(`Pipeline ${i + 1}. stage bir nesne olmalı.`);
      }
      const keys = Object.keys(stage);
      if (keys.length !== 1) {
        throw new Error(`Pipeline ${i + 1}. stage tam olarak bir operatör içermeli (örn. { "$match": { ... } }).`);
      }
      if (!keys[0].startsWith('$')) {
        throw new Error(`Pipeline ${i + 1}. stage operatörü "$" ile başlamalı ("${keys[0]}").`);
      }
    });
    return JSON.stringify(p);
  };

  const buildQuery = () => {
    if (form.queryMode === 'aggregate') {
      return { source: form.source, queryMode: 'aggregate', pipelineText: buildPipelineText() };
    }
    return {
      source: form.source,
      queryMode: 'builder',
      filters: form.filters.filter((f) => f.field && f.op).map((f) => {
        let value;
        if (f.op === 'exists') value = f.value === true || f.value === 'true';
        else if (f.op === 'in' || f.op === 'nin') value = String(f.value).split(',').map((s) => s.trim()).filter(Boolean);
        else if (f.rel) {
          const n = Number(f.value);
          // 0/boş → pencere "şimdiden itibaren" olur ve liste her koşuda BOŞ
          // çıkar, hiçbir hata da üretmez. Kaydettirmeden burada durdur.
          if (!Number.isFinite(n) || n <= 0) {
            throw new Error(
              `"${f.field}" için göreli pencere 0'dan büyük olmalı (örn. son 24 saat → 24).`
            );
          }
          value = f.rel === 'hours' ? { relativeHours: n } : { relativeDays: n };
        } else value = f.value;
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

  /** Formdaki (kaydedilmemiş) taslağı yazmadan dener. */
  const doDryRunForm = async () => {
    setNotice(''); setDryRun(null); setDryRunFor('form');
    let query;
    try { query = buildQuery(); } catch (e) { setDryRunFor(null); return setNotice(e.message); }
    const r = await dryRunList({
      ...query,
      cap: scanCap,
      name: form.name.trim() || 'Test listesi',
      buildMode: form.buildMode,
      // Yalnızca "tavan teste ait, build limiti şu" uyarısını doğru göstermek için.
      maxRecipients: Number(form.maxRecipients) || 5000,
      channelKey: form.channelKey || undefined,
      schedule: { timezone: form.schedule.timezone },
    }).unwrap().catch((e) => ({ __err: e?.data?.message || 'Test başarısız' }));
    setDryRunFor(null);
    if (r?.__err) return setNotice(r.__err);
    setDryRun({ title: form.name.trim() || 'Taslak', data: r });
  };

  /** Tablodaki kayıtlı reçeteyi olduğu gibi dener (form açmadan). */
  const doDryRunRow = async (row) => {
    setNotice(''); setDryRun(null); setDryRunFor(row._id);
    const r = await dryRunList({ id: row._id, cap: scanCap }).unwrap()
      .catch((e) => ({ __err: e?.data?.message || 'Test başarısız' }));
    setDryRunFor(null);
    if (r?.__err) return setNotice(r.__err);
    setDryRun({ title: row.name, data: r });
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
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          Cron listeleri, tanımlı DB sorgusuyla zamanlanmış olarak (cron) otomatik güncellenir.
          Bir listenin üyelerini görmek için satırdaki <b>Üyeler</b> bağlantısını kullanın.
        </AlertDescription>
      </Alert>

      {notice && <Alert variant="info"><AlertDescription>{notice}</AlertDescription></Alert>}

      {form && (
        <Card>
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
              <div className="min-w-[200px]">
                <label className="mb-1 block text-xs text-muted-foreground">Oluşturma modu</label>
                <select className={SELECT_CLS} value={form.buildMode} onChange={(e) => set('buildMode', e.target.value)}>
                  <option value="append">Biriktir (aynı liste)</option>
                  <option value="replace">Yenile (aynı liste)</option>
                  <option value="new">Her döngüde yeni liste (tarihli)</option>
                </select>
              </div>
              <div className="w-40">
                <label className="mb-1 block text-xs text-muted-foreground">Max alıcı</label>
                <Input type="number" min={1} value={form.maxRecipients} onChange={(e) => set('maxRecipients', e.target.value)} />
              </div>
            </div>

            {form.buildMode === 'new' && (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Her çalıştırmada <b>“{form.name?.trim() || 'Liste'} — GG.AA.YYYY”</b> gibi tarihe göre
                otomatik adlandırılmış <b>yeni bir liste</b> oluşturulur. Üretilen listeler{' '}
                <b>Özel Listeler</b> sekmesinde görünür ve kampanyalarda seçilebilir.
              </p>
            )}

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
                        <select
                          className={`${SELECT_CLS} w-44`}
                          value={f.field}
                          // Tarih olmayan alanda göreli pencere anlamsız → birimi sıfırla,
                          // aksi halde gizli `rel` kalıp değeri {relativeDays} nesnesine çevirir.
                          onChange={(e) => setFilter(i, {
                            field: e.target.value,
                            ...(fieldType(e.target.value) === 'date' ? {} : { rel: '' }),
                            // Bool alana geçerken serbest metin devralınırsa backend
                            // onu sessizce `false`'a çevirir → varsayılanı netleştir.
                            ...(fieldType(e.target.value) === 'bool' && f.op !== 'exists'
                              ? { value: 'true' }
                              : {}),
                          })}
                        >
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
                        ) : fieldType(f.field) === 'bool' && f.op !== 'in' && f.op !== 'nin' ? (
                          // Bool alanlar serbest metin kutusundaydı; backend yalnız
                          // `true` dizesini doğru sayar, dolayısıyla "evet"/"1"/"True"
                          // sessizce `false` olup listeyi yanlış/boş üretiyordu.
                          <select
                            className={`${SELECT_CLS} w-36`}
                            value={String(f.value) === 'true' ? 'true' : 'false'}
                            onChange={(e) => setFilter(i, { value: e.target.value })}
                          >
                            <option value="true">evet (true)</option>
                            <option value="false">hayır (false)</option>
                          </select>
                        ) : (
                          <Input
                            className="w-44"
                            placeholder={
                              f.rel === 'hours' ? 'N (saat önce)'
                                : f.rel === 'days' ? 'N (gün önce)'
                                : fieldType(f.field) === 'date' ? 'YYYY-AA-GG (örn. 2026-08-18)'
                                : 'değer'
                            }
                            value={f.value}
                            onChange={(e) => setFilter(i, { value: e.target.value })}
                          />
                        )}
                        {fieldType(f.field) === 'date' && f.op !== 'exists' && (
                          <select
                            className={`${SELECT_CLS} w-36`}
                            value={f.rel || ''}
                            onChange={(e) => setFilter(i, { rel: e.target.value })}
                            title="Göreli pencere birimi"
                          >
                            {REL_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select>
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
              <Button variant="outline" onClick={doDryRunForm} disabled={dryRunFor === 'form'} title="Liste oluşturmadan kimlerin geleceğini gösterir">
                {dryRunFor === 'form' ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />} Test Et
              </Button>
              {/* Test Et kişi başına sıralı DB sorgusu yapar (eleme sırası build ile
                  birebir aynı kalmak zorunda, paralelleştirilemez) → tarama tavanı
                  ayarlanabilir. Gerçek toplam için Önizleme kullanılır: o tek
                  sorguda tam sayıyı döner. */}
              <select
                className={`${SELECT_CLS} w-44`}
                value={scanCap}
                onChange={(e) => setScanCap(Number(e.target.value))}
                title="Test Et taramasının durduğu kayıt sayısı"
              >
                {SCAN_CAPS.map((n) => (
                  <option key={n} value={n}>{formatCount(n)} kayıt tara</option>
                ))}
              </select>
              {preview && (
                <span className="text-sm text-muted-foreground">
                  Eşleşen{preview.exact === false ? ' (alt sınır)' : ''}:{' '}
                  <b>{formatCount(preview.count)}{preview.capped ? '+' : ''}</b>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {dryRun && <DryRunResult title={dryRun.title} data={dryRun.data} onClose={() => setDryRun(null)} />}

      <Card>
        <CardHeader>
          <CardTitle>Tanımlı Cron Listeleri</CardTitle>
          <CardToolbar>
            <Button onClick={openNew}><Plus className="size-4" /> Yeni Liste</Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Yükleniyor…</div>
          ) : lists.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Henüz cron listesi yok. Yukarıdan “Yeni Liste” ile oluşturun.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="p-3">Ad</th>
                    <th className="p-3">Kaynak</th>
                    <th className="p-3 text-right">Üye</th>
                    <th className="p-3">Zamanlama</th>
                    <th className="p-3">Son üretim</th>
                    <th className="p-3">Durum</th>
                    <th className="p-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.map((row) => {
                    // "new" modunda taban kanal boştur → son üretilen tarihli listeye bağla.
                    // Backend `targetChannelKey` döndürür; eski yanıtlar için fallback korunur.
                    const detailKey = row.targetChannelKey
                      || (row.buildMode === 'new'
                        ? (row.lastBuiltChannelKey || row.channelKey)
                        : row.channelKey);
                    return (
                    <tr key={row._id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        {detailKey ? (
                          <Link href={`/cms/email/lists/${detailKey}`} className="text-primary hover:underline">
                            {row.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{row.name}</span>
                        )}
                        {row.buildMode === 'new' && (
                          <div className="text-[11px] text-muted-foreground">Her döngüde yeni tarihli liste</div>
                        )}
                        {row.description && <div className="text-xs text-muted-foreground">{row.description}</div>}
                      </td>
                      <td className="p-3">{sources[row.source]?.label || row.source}</td>
                      <td className="p-3 text-right">
                        {detailKey ? (
                          <Link
                            href={`/cms/email/lists/${detailKey}`}
                            className="inline-flex items-center gap-1.5 font-medium hover:underline"
                            title="Listedeki güncel abone sayısı"
                          >
                            <Users className="size-3.5 text-muted-foreground" />
                            {formatCount(row.memberCount)}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {row.schedule?.cron}{' '}
                        <span className="text-muted-foreground">({row.schedule?.timezone})</span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {/* lastBuiltCount = son koşuda YENİ eklenen; listenin toplamı Üye sütununda. */}
                        {row.lastBuiltAt
                          ? `${new Date(row.lastBuiltAt).toLocaleString('tr-TR')} · +${formatCount(row.lastBuiltCount)} yeni`
                          : '—'}
                        {/* Elenenler artık koşuda kaydediliyor — Keycloak arızası
                            yüzünden küçülen liste burada fark edilir. */}
                        {row.lastBuiltStats?.noEmail > 0 && (
                          <div>{formatCount(row.lastBuiltStats.noEmail)} kişi e-postasız elendi</div>
                        )}
                        {row.lastBuiltStats?.keycloakErrors > 0 && (
                          <div className="font-medium text-amber-600">
                            {formatCount(row.lastBuiltStats.keycloakErrors)} Keycloak hatası
                          </div>
                        )}
                        {row.lastError && <div className="text-destructive">{row.lastError}</div>}
                      </td>
                      <td className="p-3">
                        <Badge variant={row.status === 'active' ? 'secondary' : 'outline'}>{row.status}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          {detailKey && (
                            <Link href={`/cms/email/lists/${detailKey}`}>
                              <Button variant="ghost" size="sm" title={row.buildMode === 'new' ? 'Son üretilen listenin üyeleri' : 'Üyeleri gör'}>
                                <Users className="size-3.5" />
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Test et — liste oluşturmadan kimlerin geleceğini gösterir"
                            onClick={() => doDryRunRow(row)}
                            disabled={dryRunFor === row._id}
                          >
                            {dryRunFor === row._id
                              ? <Loader2 className="size-3.5 animate-spin" />
                              : <FlaskConical className="size-3.5" />}
                          </Button>
                          <Button variant="ghost" size="sm" title="Şimdi çalıştır (GERÇEK liste oluşturur)" onClick={() => onRun(row)}>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Yazmasız test sonucu: hangi listeye, hangi pencereyle, kimlerin gireceği ve
 * elenenlerin nedeni. Build'de `skipped` yalnız sunucu loguna düştüğü için
 * (Keycloak hatası → sessiz kayıp) elenenler tablosu bunun tek görünür yeri.
 */
function DryRunResult({ title, data, onClose }) {
  const skipped = data?.skipped || {};
  const totalSkipped = Object.values(skipped).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const filterLines = describeFilter(data?.compiledFilter);
  const recipients = data?.recipients || [];
  const skippedSample = data?.skippedSample || [];
  const identity = data?.identity || null;
  const plus = data?.capped ? '+' : '';

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4" /> Test sonucu — {title}
          <span className="text-xs font-normal text-muted-foreground">
            hiçbir liste oluşturulmadı
          </span>
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}><X className="size-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {data?.capped && (
          <Alert variant="warning">
            <AlertDescription>
              Tarama {formatCount(data.cap)} kayıtta durduruldu — aşağıdaki sayılar{' '}
              <b>alt sınırdır</b>. Test, listeye kimin gireceğini ve elenenlerin nedenini
              göstermek için kişi başına ayrı sorgu yapar; bu yüzden bir tavanı vardır.
              Tavanı yukarıdaki <b>“kayıt tara”</b> seçiminden yükseltebilirsin.
              Kitlenin <b>gerçek toplamı</b> için <b>Önizleme</b>’yi kullan — o tek sorguda
              tam sayıyı verir. Not: bu tavan <b>yalnızca teste</b> aittir, listenin
              kendisi çalışırken <b>{formatCount(data.maxRecipients || 5000)}</b> kişiye
              kadar oluşturulur.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Sorguya uyan</div>
            <div className="text-xl font-semibold">{formatCount(data?.scanned)}{plus}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Listeye girecek</div>
            <div className="text-xl font-semibold text-emerald-600">{formatCount(data?.willAdd)}{plus}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Elenen</div>
            <div className="text-xl font-semibold text-muted-foreground">{formatCount(totalSkipped)}</div>
          </div>
        </div>

        <div className="space-y-1 rounded-md bg-muted/50 px-3 py-2 text-xs">
          <div>
            <span className="text-muted-foreground">Hedef liste: </span>
            {data?.targetChannelTitle || data?.targetChannelKey ? (
              <b>{data.targetChannelTitle || data.targetChannelKey}</b>
            ) : (
              <span className="text-muted-foreground">— (taslak henüz kaydedilmedi)</span>
            )}
            {data?.targetChannelKey && (
              <span className="ml-1 font-mono text-muted-foreground">({data.targetChannelKey})</span>
            )}
            {data?.buildMode === 'new' && (
              <span className="ml-1 text-muted-foreground">· her koşuda yeni tarihli liste</span>
            )}
          </div>
          {filterLines.length > 0 && (
            <div>
              <span className="text-muted-foreground">Sorgu penceresi: </span>
              <b className="font-mono">{filterLines.join(' · ')}</b>
            </div>
          )}
          {data?.relations?.length > 0 && (
            <div>
              <span className="text-muted-foreground">İlişki koşulu: </span>
              <b>{data.relations.join(', ')}</b>
            </div>
          )}
          {!data?.targetChannelKey && data?.buildMode !== 'new' && (
            <div className="text-amber-600">
              Kanal bilinmediği için “zaten üye / listeden çıkmış” kontrolü yapılamadı;
              gerçek koşuda bu kişiler elenebilir.
            </div>
          )}
          <div className="text-muted-foreground">Süre: {formatCount(data?.durationMs)} ms</div>
        </div>

        {identity && (identity.fromMongo || identity.fromKeycloak || identity.fromCompany || identity.keycloakLookups) ? (
          <div
            className={`space-y-1 rounded-md px-3 py-2 text-xs ${
              identity.keycloakErrors > 0 || identity.fromMongo < identity.fromKeycloak
                ? 'border border-amber-500/40 bg-amber-500/10'
                : 'bg-muted/50'
            }`}
          >
            <div>
              <span className="text-muted-foreground">E-posta nereden çözüldü: </span>
              <b>Mongo {formatCount(identity.fromMongo)}</b>
              {' · '}Keycloak {formatCount(identity.fromKeycloak)}
              {' · '}firma e-postası {formatCount(identity.fromCompany)}
            </div>
            {identity.keycloakErrors > 0 && (
              <div className="font-medium text-amber-700 dark:text-amber-400">
                {formatCount(identity.keycloakErrors)} Keycloak sorgusu HATA verdi —
                elenenlerin bir kısmı veri eksiği değil, geçici arıza. Tekrar deneyin.
              </div>
            )}
            {identity.fromKeycloak + identity.fromCompany > 0 && (
              <div className="text-muted-foreground">
                Mongo dışından çözülen her kişi için build sırasında ek sorgu yapılır.
                Kalıcı çözüm: <code>backfillUserIdentitySnapshots.js --only-missing</code>
              </div>
            )}
          </div>
        ) : null}

        <div>
          <div className="mb-1 text-xs font-medium">
            Listeye girecekler {recipients.length < (data?.willAdd || 0) && (
              <span className="text-muted-foreground">
                (ilk {recipients.length} / {formatCount(data.willAdd)})
              </span>
            )}
          </div>
          {recipients.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Hiç kimse eşleşmedi. Sorgu penceresini ve ilişki koşulunu kontrol edin.
            </p>
          ) : (
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <tbody>
                  {recipients.map((r, i) => (
                    <tr key={`${r.email}-${i}`} className="border-b last:border-0">
                      <td className="p-2 font-mono text-xs">{r.email}</td>
                      <td className="p-2">{r.name || '—'}</td>
                      <td className="p-2 text-muted-foreground">{r.label}</td>
                      <td className="p-2 text-right text-xs text-muted-foreground">
                        {r.source && r.source !== 'mongo' && (
                          <Badge variant="outline" className="mr-1 text-[10px]">
                            {SOURCE_LABELS[r.source] || r.source}
                          </Badge>
                        )}
                        {r.locale || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalSkipped > 0 && (
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-medium">
              <span>Elenenler</span>
              {Object.entries(skipped)
                .filter(([, n]) => Number(n) > 0)
                .map(([k, n]) => (
                  <Badge key={k} variant="outline">
                    {SKIP_COUNTER_LABELS[k] || k}: {formatCount(n)}
                  </Badge>
                ))}
            </div>
            <div className="max-h-56 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <tbody>
                  {skippedSample.map((r, i) => (
                    <tr key={`${r.label}-${i}`} className="border-b last:border-0">
                      <td className="p-2">{r.label}</td>
                      <td className="p-2 font-mono text-xs text-muted-foreground">{r.email || '—'}</td>
                      <td className="p-2 text-right text-xs text-muted-foreground">
                        {SKIP_REASONS[r.reason] || r.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CronListsManager;
