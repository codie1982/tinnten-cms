'use client';

import { useEffect, useState } from 'react';
import { Database, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { CMS_ROLES } from '@/lib/roles';
import { AI_ROLES, AI_PROVIDERS, AI_CONNECTION_TYPES, aiCatalogApi as api, canWriteCatalog, catalogError, isDecimal } from '@/lib/ai-catalog';

const panel = 'rounded-xl border border-border/60 bg-card p-5 shadow-sm';
const control = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50';
const buttonBase = 'inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50';
const button = `${buttonBase} hover:bg-muted`;
const primary = `${buttonBase} bg-foreground text-background hover:opacity-90`;
function Field({ label, children }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>; }
const EMPTY_MODEL = { name: '', provider: 'openai', apiModelId: '', description: '', allowedRoles: ['response'], connectionTypes: ['openai'] };
const EMPTY_PRICE = { kind: 'provider_estimate', input: '', output: '', creditPerUsd: '', effectiveAt: '', sourceUrl: '' };

export default function AiModelsPage() {
  return <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}><Catalog /></RoleGuard>;
}
function Catalog() {
  const [context, setContext] = useState(null); const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState(''); const [draft, setDraft] = useState(EMPTY_MODEL); const [form, setForm] = useState(false);
  const [selected, setSelected] = useState(null); const [price, setPrice] = useState(EMPTY_PRICE); const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState('');
  const [cursors, setCursors] = useState([undefined]); const [nextCursor, setNextCursor] = useState(null); const cursor = cursors[cursors.length - 1];
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError(''); setModels([]); setContext(null); setNextCursor(null);
    (async () => { const ctx = await api.context(abort.signal); if (abort.signal.aborted) return; setContext(ctx); if (!ctx.availability.catalog && !ctx.readAvailability?.catalog) return; const page = await api.models(abort.signal, cursor); if (!abort.signal.aborted) { setModels(page.items); setNextCursor(page.nextCursor); } })()
      .catch(err => { if (!abort.signal.aborted) { setContext(null); setError(catalogError(err)); } }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [revision, cursor]);
  const writable = canWriteCatalog(context) && !busy;
  async function perform(operation, after) { if (!writable) return; setBusy(true); setFeedback(''); try { await operation(); after?.(); setFeedback('İşlem kaydedildi.'); setRevision(x => x + 1); } catch (err) { setFeedback(catalogError(err)); } finally { setBusy(false); } }
  function create(event) { event.preventDefault(); if (!draft.name.trim() || !draft.apiModelId.trim()) return; void perform(() => api.create(context, { ...draft, name: draft.name.trim(), apiModelId: draft.apiModelId.trim() }), () => { setDraft(EMPTY_MODEL); setForm(false); }); }
  function addPrice(event) {
    event.preventDefault(); if (!selected || !isDecimal(price.input) || !isDecimal(price.output)) return;
    const { creditPerUsd, effectiveAt, ...fields } = price;
    if (!effectiveAt || (price.kind === 'tinnten_tariff' && (!isDecimal(creditPerUsd) || Number(creditPerUsd) <= 0))) return;
    void perform(() => api.price(context, selected.id, { ...fields, ...(price.kind === 'tinnten_tariff' ? { creditPerUsd } : {}), currency: 'USD', unit: 'million_tokens', effectiveAt: new Date(effectiveAt).toISOString(), expectedVersion: selected.version }), () => { setSelected(null); setPrice(EMPTY_PRICE); });
  }
  return <div className="space-y-5">
    <PageHeader section="Yapay Zeka" title="AI Model Kataloğu" description="Merkezi model tanımları, yayın durumu ve değişmez fiyat sürümleri" />
    <div className={`${panel} flex flex-wrap justify-between gap-3`}><p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck size={18} />Yalnız Tinnten CMS yöneticileri. Firma model listelerinden bağımsızdır.</p><button className={button} onClick={() => setForm(!form)}><Plus size={16} />{form ? 'Formu kapat' : 'Model tanımı'}</button></div>
    {!loading && !context?.availability.catalog && <div role="status" className={`${panel} text-sm`}><strong>Backend entegrasyonu bekleniyor</strong><p className="mt-2 text-muted-foreground">Aktarım taslakları servis etkinse aşağıda DB’den listelenir. DigitalOcean bir sağlayıcı, Tinnten ise yönetimli bağlantı türüdür. Eski model dosyasındaki fiyatlar doğrulanmış yeni tarife sayılmaz. CMS yazma/fiyat/yayın işlemleri henüz kapalıdır.</p></div>}
    {error && <div role="alert" className={panel}>{error}<button className={`${button} ms-3`} onClick={() => setRevision(x => x + 1)}><RefreshCw size={16} />Yeniden dene</button></div>}
    {feedback && <p role="status" className={panel}>{feedback}</p>}
    {form && <form onSubmit={create} className={`${panel} grid gap-4 md:grid-cols-2`}><h2 className="font-semibold md:col-span-2">Yeni global model taslağı</h2>
      <Field label="Model adı"><input className={control} required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
      <Field label="Sağlayıcı"><select className={control} value={draft.provider} onChange={e => setDraft({ ...draft, provider: e.target.value, connectionTypes: [e.target.value === 'digitalocean' ? 'tinnten' : e.target.value] })}>{AI_PROVIDERS.map(p => <option key={p}>{p}</option>)}</select></Field>
      <Field label="Gerçek API model kimliği"><input className={control} required maxLength={200} value={draft.apiModelId} onChange={e => setDraft({ ...draft, apiModelId: e.target.value })} /></Field>
      <Field label="Açıklama"><textarea className={control} maxLength={2000} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Field>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Uygun runtime rolleri</legend><div className="flex flex-wrap gap-3">{AI_ROLES.map(role => <label key={role} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.allowedRoles.includes(role)} onChange={e => setDraft({ ...draft, allowedRoles: e.target.checked ? [...draft.allowedRoles, role] : draft.allowedRoles.filter(r => r !== role) })} />{role}</label>)}</div></fieldset>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Desteklenen bağlantı türleri</legend><div className="flex flex-wrap gap-3">{AI_CONNECTION_TYPES.map(type => <label key={type} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.connectionTypes.includes(type)} onChange={e => setDraft({ ...draft, connectionTypes: e.target.checked ? [...draft.connectionTypes, type] : draft.connectionTypes.filter(v => v !== type) })} />{type}</label>)}</div></fieldset>
      <p className="text-xs text-muted-foreground md:col-span-2">Taslak oluşturmak modeli yayınlamaz. Teknik doğrulama ve fiyat sürümleri ayrı adımlardır.</p><button className={primary} disabled={!writable || !draft.allowedRoles.length || !draft.connectionTypes.length}>Taslak oluştur</button>
    </form>}
    <section className={`${panel} space-y-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Database size={18} />Merkezi modeller</h2><Field label="Bu sayfada ara"><input type="search" className={control} value={query} onChange={e => setQuery(e.target.value)} /></Field></div>
      {loading ? <p aria-busy="true">Yükleniyor…</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Model', 'Sağlayıcı', 'Roller', 'Sürüm / Durum', 'İşlemler'].map(h => <th className="p-3 text-start" key={h}>{h}</th>)}</tr></thead><tbody>{models.filter(m => `${m.name} ${m.apiModelId}`.toLowerCase().includes(query.toLowerCase())).map(m => <tr className="border-t border-border" key={m.id}><td className="p-3 font-medium">{m.name}<p className="text-xs text-muted-foreground">{m.apiModelId}</p></td><td>{m.provider}</td><td>{m.allowedRoles.join(', ')}</td><td>{m.version} · {m.status}</td><td><div className="flex flex-wrap gap-2"><button className={button} onClick={() => { setSelected(m); setPrice(EMPTY_PRICE); }}>Fiyat sürümü</button><button className={button} disabled={!writable || m.status === 'published'} onClick={() => window.confirm('Bu modelin doğrulanmış sürümünü yayınlamak istiyor musunuz?') && void perform(() => api.publish(context, m))}>Yayınla</button><button className={button} disabled={!writable || !m.enabled} onClick={() => window.confirm('Modeli yeni seçimlere kapatmak istiyor musunuz? Geçmiş kayıtlar korunur.') && void perform(() => api.disable(context, m))}>Pasifleştir</button></div></td></tr>)}</tbody></table></div>}
      {!loading && (context?.availability.catalog || context?.readAvailability?.catalog) && !error && models.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Henüz global model yok.</p>}
      <div className="flex justify-between"><button className={button} disabled={loading || cursors.length === 1} onClick={() => setCursors(x => x.slice(0, -1))}>Önceki</button><button className={button} disabled={loading || !nextCursor} onClick={() => setCursors(x => [...x, nextCursor])}>Sonraki</button></div>
    </section>
    <section className={`${panel} space-y-4`}><h2 className="font-semibold">{selected ? `${selected.name} · Yeni fiyat sürümü` : 'Model / fiyat sürümü formu'}</h2><p className="text-sm text-muted-foreground">Sağlayıcı tahmini ve Tinnten tahakkuk tarifesi ayrı sürümlenir. Yeni fiyat geçmiş kullanımı yeniden hesaplamaz. İlk sözleşme metin/vision için milyon token fiyatını kapsar.</p>
      <form onSubmit={addPrice} className="grid gap-4 md:grid-cols-3"><Field label="Fiyat türü"><select className={control} value={price.kind} onChange={e => setPrice({ ...price, kind: e.target.value })}><option value="provider_estimate">Sağlayıcı maliyet tahmini</option><option value="tinnten_tariff">Tinnten tahakkuk tarifesi</option></select></Field>
        <Field label="Input · USD / 1M token"><input className={control} inputMode="decimal" required pattern="(0|[1-9][0-9]*)(\.[0-9]+)?" value={price.input} onChange={e => setPrice({ ...price, input: e.target.value })} /></Field>
        <Field label="Output · USD / 1M token"><input className={control} inputMode="decimal" required pattern="(0|[1-9][0-9]*)(\.[0-9]+)?" value={price.output} onChange={e => setPrice({ ...price, output: e.target.value })} /></Field>
        {price.kind === 'tinnten_tariff' && <Field label="USD başına Tinnten kredisi"><input className={control} inputMode="decimal" required value={price.creditPerUsd} onChange={e => setPrice({ ...price, creditPerUsd: e.target.value })} /></Field>}
        <Field label="Geçerlilik başlangıcı"><input type="datetime-local" className={control} required value={price.effectiveAt} onChange={e => setPrice({ ...price, effectiveAt: e.target.value })} /></Field><Field label="Fiyat kaynağı (HTTPS)"><input type="url" className={control} required pattern="https://.*" value={price.sourceUrl} onChange={e => setPrice({ ...price, sourceUrl: e.target.value })} /></Field>
        <button className={primary} disabled={!selected || !writable || !isDecimal(price.input) || !isDecimal(price.output)}>Fiyat sürümü oluştur</button>
      </form>
    </section>
  </div>;
}
