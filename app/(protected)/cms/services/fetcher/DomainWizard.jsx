'use client';

/**
 * Etkileşimli domain onboarding sihirbazı — CMS admin (kullanıcı-bağımsız).
 *
 * Dashboard'daki company-scoped sihirbazın CMS muadili: admin bir domain'i
 * ABONELİKSİZ ekler ve 4 adımda yapılandırır:
 *   0. Site    → URL + tip (+ opsiyonel firma) → analizi başlat
 *   1. Bölümler→ keşfedilen URL pattern aileleri, örnek URL'ler, seçim
 *   2. Şema    → seçili aileler için ARKA PLANDA şema üret, test et, düzelt
 *   3. Onay    → chunk ayarları + özet → taramayı başlat
 *
 * companyId GÖNDERİLMEZ → fetcher operator (admin) modu: sahiplik kısıtı yok.
 * Analiz patterns-only (hızlı); şema üretimi schema_gen daemon'ında (poll ile
 * izlenir). Stil: sayfanın overlay+Card kalıbı, inline <Alert>, native textarea.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Wand2, ArrowRight, ArrowLeft, Loader2, Sparkles, Rocket,
  FlaskConical, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  Hash, FolderTree,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  useAddFetcherDomainMutation,
  useLazyGetDomainAnalysisQuery,
  useGenerateDomainSchemasMutation,
  useTestDomainSchemaMutation,
  useCommitDomainSchemasMutation,
} from '@/redux/services';

const STEPS = ['Site', 'Bölümler', 'Şema', 'Onay'];
const SITE_TYPES = ['ecommerce', 'service', 'blog'];
const POLL_MS = 2500;
const POLL_MAX = 100; // 2.5s × 100 ≈ 4 dk

const QUALITY = {
  schema: ['Yapısal', 'bg-success/10 text-success border-success/25'],
  partial_schema: ['Kısmi', 'bg-warning/10 text-warning border-warning/25'],
  fit_markdown_only: ['Ham metin', 'bg-muted text-muted-foreground border-border'],
  degraded: ['Analiz edilemedi', 'bg-destructive/10 text-destructive border-destructive/25'],
};
const FAMILY_LABEL = { article: 'Makale', product: 'Ürün', category: 'Liste', static: 'Statik' };

function upstreamErr(e) {
  return e?.data?.message || e?.data?.data?.message || e?.error || 'İşlem başarısız.';
}
function hostFromUrl(u) {
  try { return new URL(u.trim()).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export default function DomainWizard({ onClose, onDone }) {
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);

  // Adım 0
  const [url, setUrl] = useState('');
  const [siteType, setSiteType] = useState('blog');
  const [companyId, setCompanyId] = useState('');

  // Ortak
  const [domain, setDomain] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [err, setErr] = useState(null);

  // Adım 1-2
  const [selected, setSelected] = useState(() => new Set());
  const [knowledge, setKnowledge] = useState({}); // pattern -> 'content'|'product'
  const [treePatterns, setTreePatterns] = useState({}); // URL ağacından eklenen ince pattern'ler
  const [drafts, setDrafts] = useState({}); // pattern -> { pattern, family, cssSchema, status, test, raw, jsonError }
  const [testing, setTesting] = useState(null);

  // Adım 3
  const [chunk, setChunk] = useState({}); // { chunkSize, chunkOverlap, minChars }

  const pollRef = useRef(null);
  const cancelled = useRef(false);

  const [addDomain] = useAddFetcherDomainMutation();
  const [triggerAnalysis] = useLazyGetDomainAnalysisQuery();
  const [genSchemas] = useGenerateDomainSchemasMutation();
  const [testSchema] = useTestDomainSchemaMutation();
  const [commitSchemas] = useCommitDomainSchemasMutation();

  useEffect(() => () => { cancelled.current = true; if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const urlHost = useMemo(() => hostFromUrl(url), [url]);
  const canConfigure = analysis?.access?.canConfigure ?? true;

  // Kaba kümeler + ağaçtan eklenen ince pattern'ler (pattern'e göre dedup).
  const allPatterns = useMemo(() => {
    const base = analysis?.patterns || [];
    const seen = new Set(base.map((p) => p.pattern));
    return [...base, ...Object.values(treePatterns).filter((p) => !seen.has(p.pattern))];
  }, [analysis?.patterns, treePatterns]);

  const goTo = (i) => { setStep(i); setFurthest((f) => Math.max(f, i)); };

  /* ── Analiz poll (patterns hazır olana kadar) ── */
  const pollAnalysis = useCallback(async (dom, attempt = 0) => {
    if (cancelled.current) return;
    try {
      const data = await triggerAnalysis(dom).unwrap();
      setAnalysis(data);
      const state = (data?.analysis?.state || '').toUpperCase();
      if (state === 'DONE' || state === 'READY' || !state) {
        setSelected(new Set((data.patterns || []).filter((p) => p.needsSchema).map((p) => p.pattern)));
        setBusy(false);
        return;
      }
      if (attempt >= POLL_MAX) { setBusy(false); setErr({ text: 'Analiz beklenenden uzun sürdü.' }); return; }
      setBusyLabel(`Site analiz ediliyor… (${data?.analysis?.step || 'hazırlanıyor'})`);
      pollRef.current = setTimeout(() => pollAnalysis(dom, attempt + 1), POLL_MS);
    } catch (e) { setBusy(false); setErr({ text: upstreamErr(e) }); }
  }, [triggerAnalysis]);

  /* ── Adım 0 → 1: domain ekle (patterns-only analiz) ── */
  const handleAnalyze = async () => {
    if (!urlHost) { setErr({ text: 'Geçerli bir URL girin.' }); return; }
    setBusy(true); setBusyLabel('Site ekleniyor…'); setErr(null);
    try {
      const body = {
        domain: urlHost,
        site_type: siteType,
        autoStartScraping: false,      // crawl commit'e kadar ertelenir
        extractionAnalysis: true,      // companyId yoksa analizi AÇIKÇA iste (operator)
        analysisMode: 'patterns',      // patterns-only (hızlı, şema ertelenir)
      };
      if (companyId.trim()) body.companyId = companyId.trim();
      await addDomain(body).unwrap();
      setDomain(urlHost);
      goTo(1);
      setBusyLabel('Site analiz ediliyor…');
      pollAnalysis(urlHost, 0);
    } catch (e) { setBusy(false); setErr({ text: upstreamErr(e) }); }
  };

  const togglePattern = (p) => setSelected((s) => {
    const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n;
  });

  // Şema üretimi/testi ailesi kullanıcının "Ürün/İçerik" seçiminden türer (agent'ın
  // family'sinden değil): ürün → LLM ürün alanlarını hedefler + alan-varlığı doğrulaması.
  const familyFor = (p) => {
    const src = knowledge[p.pattern] || (p.family === 'product' ? 'product' : 'content');
    return src === 'product' ? 'product' : 'article';
  };

  /* ── URL ağacı düğümü seç/kaldır (dashboard ile aynı mantık) ── */
  const toggleTreeNode = (node) => {
    const pattern = `${node.path}/*`;
    const isCluster = (analysis?.patterns || []).some((p) => p.pattern === pattern);
    setSelected((s) => { const n = new Set(s); if (n.has(pattern)) n.delete(pattern); else n.add(pattern); return n; });
    if (isCluster) return; // kaba küme — sentetik gerekmez
    setTreePatterns((tp) => {
      const next = { ...tp };
      if (next[pattern]) delete next[pattern];
      else next[pattern] = {
        pattern, count: node.count, samples: node.samples || [],
        family: 'article', needsSchema: true, hasSchema: false, schemaResult: null, label: node.path,
      };
      return next;
    });
  };

  /* ── schema_gen poll ── */
  const pollSchemaGen = useCallback(async (dom, sel, attempt = 0) => {
    if (cancelled.current) return;
    try {
      const data = await triggerAnalysis(dom).unwrap();
      setAnalysis(data);
      const state = (data?.analysis?.state || '').toUpperCase();
      if (state === 'DONE' || state === 'READY' || !state) {
        const selSet = new Set(sel);
        const next = {};
        for (const p of data.patterns || []) {
          if (!selSet.has(p.pattern)) continue;
          next[p.pattern] = {
            pattern: p.pattern, family: p.family || undefined,
            cssSchema: p.cssSchema || null,
            raw: p.cssSchema ? JSON.stringify(p.cssSchema, null, 2) : '',
            jsonError: null,
            status: p.cssSchema ? 'generated' : (p.schemaResult === 'failed_validation' ? 'generate_failed' : 'no_samples'),
          };
        }
        for (const p of sel) if (!next[p]) next[p] = { pattern: p, cssSchema: null, raw: '', status: 'no_samples' };
        setDrafts(next); setBusy(false);
        return;
      }
      if (attempt >= POLL_MAX) { setBusy(false); setErr({ text: 'Şema üretimi uzun sürdü.' }); return; }
      const done = (data.patterns || []).filter((p) => sel.includes(p.pattern) && p.hasSchema).length;
      setBusyLabel(`Şemalar arka planda üretiliyor… (${done}/${sel.length} hazır)`);
      pollRef.current = setTimeout(() => pollSchemaGen(dom, sel, attempt + 1), POLL_MS);
    } catch (e) { setBusy(false); setErr({ text: upstreamErr(e) }); }
  }, [triggerAnalysis]);

  /* ── Adım 1 → 2: şema üret (arka plan) ── */
  const handleGenerate = async () => {
    if (!domain || selected.size === 0) return;
    setErr(null);
    const sel = allPatterns.map((p) => p.pattern).filter((p) => selected.has(p));
    const pending = {}; for (const p of sel) pending[p] = { pattern: p, cssSchema: null, raw: '', status: 'pending' };
    setDrafts(pending); setBusy(true); setBusyLabel('Şema üretimi başlatılıyor…'); goTo(2);
    try {
      const patterns = allPatterns.filter((p) => selected.has(p.pattern))
        .map((p) => ({ pattern: p.pattern, family: familyFor(p) }));
      await genSchemas({ domain, patterns }).unwrap();
      setBusyLabel(`Şemalar arka planda üretiliyor… (0/${sel.length} hazır)`);
      pollSchemaGen(domain, sel, 0);
    } catch (e) { setBusy(false); setErr({ text: upstreamErr(e) }); }
  };

  const handleTest = async (pattern) => {
    const d = drafts[pattern]; if (!d?.cssSchema) return;
    setTesting(pattern); setErr(null);
    try {
      const pObj = allPatterns.find((p) => p.pattern === pattern);
      const samples = pObj?.samples || [];
      const res = await testSchema({ domain, pattern, css_schema: d.cssSchema, urls: samples.slice(0, 3), family: pObj ? familyFor(pObj) : undefined }).unwrap();
      setDrafts((prev) => ({ ...prev, [pattern]: { ...prev[pattern], test: res } }));
    } catch (e) { setErr({ text: upstreamErr(e) }); }
    finally { setTesting(null); }
  };

  const editSchema = (pattern, raw) => {
    setDrafts((prev) => {
      const next = { ...prev[pattern], raw, test: undefined };
      if (!raw.trim()) { next.cssSchema = null; next.jsonError = null; }
      else {
        try { const p = JSON.parse(raw); if (typeof p !== 'object' || Array.isArray(p)) throw new Error('nesne olmalı'); next.cssSchema = p; next.jsonError = null; }
        catch (e) { next.jsonError = e.message; }
      }
      return { ...prev, [pattern]: next };
    });
  };

  /* ── Adım 3: commit ── */
  const handleCommit = async () => {
    if (!domain) return;
    setBusy(true); setBusyLabel('Şemalar kaydediliyor, tarama başlatılıyor…'); setErr(null);
    try {
      const schemas = Object.values(drafts).filter((d) => d.cssSchema).map((d) => ({
        pattern: d.pattern, css_schema: d.cssSchema,
        knowledge_source: knowledge[d.pattern] || (d.family === 'product' ? 'product' : 'content'),
      }));
      const indexSettings = {};
      for (const k of ['chunkSize', 'chunkOverlap', 'minChars']) if (chunk[k] != null && chunk[k] !== '') indexSettings[k] = Number(chunk[k]);
      await commitSchemas({ domain, schemas, indexSettings: Object.keys(indexSettings).length ? indexSettings : undefined, startCrawl: true }).unwrap();
      onDone?.();
      onClose();
    } catch (e) { setBusy(false); setErr({ text: upstreamErr(e) }); }
  };

  const generatedCount = Object.values(drafts).filter((d) => d.cssSchema).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wand2 className="size-4 text-primary" /> Domain Ekleme Sihirbazı</CardTitle>
          <CardToolbar><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></CardToolbar>
        </CardHeader>
        <CardContent className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Adım göstergesi */}
          <ol className="flex items-center gap-1.5">
            {STEPS.map((label, i) => (
              <li key={label} className="flex-1">
                <button type="button" disabled={i > furthest} onClick={() => i <= furthest && goTo(i)}
                  className={cn('w-full text-left', i <= furthest ? 'cursor-pointer' : 'cursor-not-allowed opacity-50')}>
                  <div className={cn('h-1 rounded-full', i === step ? 'bg-primary' : i < furthest ? 'bg-primary/40' : 'bg-border')} />
                  <span className={cn('mt-1.5 block text-xs font-medium', i === step ? 'text-foreground' : 'text-muted-foreground')}>{i + 1}. {label}</span>
                </button>
              </li>
            ))}
          </ol>

          {analysis && !canConfigure && (
            <Alert variant="warning"><AlertDescription>Bu domain başka bir hesaba ait; yalnız görüntülenebilir.</AlertDescription></Alert>
          )}
          {err && <Alert variant="destructive"><AlertDescription>{err.text}</AlertDescription></Alert>}

          {/* ADIM 0 */}
          {step === 0 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-2sm font-medium">URL <span className="text-destructive">*</span></label>
                <Input type="url" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
                {urlHost && <p className="text-xs text-muted-foreground">domain: <span className="font-mono">{urlHost}</span></p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-2sm font-medium">Site tipi</label>
                  <select className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    value={siteType} onChange={(e) => setSiteType(e.target.value)}>
                    {SITE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-2sm font-medium">Firma ID (opsiyonel)</label>
                  <Input placeholder="boş = admin/bağımsız" value={companyId} onChange={(e) => setCompanyId(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Firma ID boş bırakılırsa domain <b>kullanıcı-bağımsız</b> eklenir. Analiz yalnız pattern
                çıkarır; şema ve tarama, siz onaylayana kadar başlamaz.
              </p>
            </div>
          )}

          {/* ADIM 1 */}
          {step === 1 && (
            busy && !(analysis?.patterns?.length) ? (
              <Loading label={busyLabel} sub="Site haritası taranıyor, URL aileleri çıkarılıyor." />
            ) : (
              <div className="space-y-3">
                {analysis?.siteProfile && <ProfileBadges p={analysis.siteProfile} />}
                {analysis?.quality?.label && <QualityBadge label={analysis.quality.label} coverage={analysis.quality.schemaCoverage} />}
                {!allPatterns.length ? (
                  <Alert variant="info"><AlertDescription>Pattern bulunamadı. Site haritası okunamamış olabilir.</AlertDescription></Alert>
                ) : (
                  <ul className="space-y-2">
                    {[...allPatterns].sort((a, b) => (a.needsSchema === b.needsSchema ? b.count - a.count : a.needsSchema ? -1 : 1)).map((p) => (
                      <PatternRow key={p.pattern} p={p} checked={selected.has(p.pattern)} disabled={!canConfigure}
                        onToggle={() => togglePattern(p.pattern)}
                        source={knowledge[p.pattern] || (p.family === 'product' ? 'product' : 'content')}
                        onSource={(s) => setKnowledge((k) => ({ ...k, [p.pattern]: s }))} />
                    ))}
                  </ul>
                )}

                {/* Gelişmiş: recursive URL ağacında gez, alt dal seç. */}
                {analysis?.urlTree?.children?.length > 0 && (
                  <details className="group rounded-lg border border-input">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-secondary-foreground hover:text-foreground">
                      <span>Gelişmiş — URL ağacında gez (alt bölüm seç)</span>
                      <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="border-t border-input p-2">
                      <UrlTree tree={analysis.urlTree} selected={selected} onToggleNode={toggleTreeNode} disabled={!canConfigure} />
                    </div>
                  </details>
                )}
              </div>
            )
          )}

          {/* ADIM 2 */}
          {step === 2 && (
            <div className="space-y-3">
              {Object.keys(drafts).length === 0 ? (
                <Alert variant="info"><AlertDescription>Şema taslağı yok. Geri dönüp bölüm seçin.</AlertDescription></Alert>
              ) : (
                <>
                  {busy && (
                    <div className="flex items-center gap-2.5 rounded-lg border border-primary/25 bg-primary/5 p-3">
                      <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                      <div><p className="text-xs font-medium">{busyLabel}</p>
                        <p className="text-[11px] text-muted-foreground">Her bölüm hazırlandıkça aşağıda görünecek.</p></div>
                    </div>
                  )}
                  {Object.values(drafts).map((d) => (
                    <SchemaCard key={d.pattern} d={d} testing={testing === d.pattern} disabled={!canConfigure || busy}
                      onTest={() => handleTest(d.pattern)} onEdit={(raw) => editSchema(d.pattern, raw)} />
                  ))}
                </>
              )}
            </div>
          )}

          {/* ADIM 3 */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <p className="mb-2 font-semibold text-muted-foreground">Özet</p>
                <Row k="Domain"><span className="font-mono">{domain}</span></Row>
                <Row k="Şemalı bölüm">{generatedCount} / {selected.size}</Row>
                <Row k="Doğrulanan">{Object.values(drafts).filter((d) => d.test?.verdict === 'pass').length}</Row>
              </div>
              <details className="rounded-lg border border-border">
                <summary className="cursor-pointer p-3 text-2sm font-medium">İleri ayarlar — parçalama (opsiyonel)</summary>
                <div className="grid grid-cols-3 gap-2 border-t border-border p-3">
                  {[['chunkSize', 'Parça', 1200], ['chunkOverlap', 'Örtüşme', 200], ['minChars', 'Min', 80]].map(([k, lbl, ph]) => (
                    <div key={k} className="space-y-1"><label className="text-[11px] text-muted-foreground">{lbl}</label>
                      <Input type="number" placeholder={String(ph)} value={chunk[k] ?? ''} onChange={(e) => setChunk((c) => ({ ...c, [k]: e.target.value }))} /></div>
                  ))}
                </div>
              </details>
              <p className="text-xs text-muted-foreground">
                “Taramayı başlat” ile onaylanan şemalar kaydedilir ve tarama başlar. Şemasız
                sayfalar otomatik temiz metinle indekslenir — içerik kaybı olmaz.
              </p>
            </div>
          )}
        </CardContent>

        {/* Alt bar */}
        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <div className="min-w-0 text-xs text-muted-foreground">
            {busy && busyLabel ? <span className="inline-flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> {busyLabel}</span>
              : domain ? <span className="font-mono">{domain}</span> : urlHost ? <span className="font-mono">{urlHost}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => goTo(step - 1)}><ArrowLeft className="size-4" /> Geri</Button>}
            {step === 0 && <Button size="sm" disabled={busy || !urlHost} onClick={handleAnalyze}><Sparkles className="size-4" /> Analiz Et <ArrowRight className="size-4" /></Button>}
            {step === 1 && <Button size="sm" disabled={busy || selected.size === 0 || !canConfigure} onClick={handleGenerate}>Şema Üret <ArrowRight className="size-4" /></Button>}
            {step === 2 && <Button size="sm" disabled={busy} onClick={() => goTo(3)}>Devam <ArrowRight className="size-4" /></Button>}
            {step === 3 && <Button size="sm" disabled={busy || !canConfigure} onClick={handleCommit}><Rocket className="size-4" /> Taramayı Başlat</Button>}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── Alt bileşenler ── */

function Loading({ label, sub }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Loader2 className="size-7 animate-spin text-primary" />
      <div><p className="text-sm font-medium">{label}</p>{sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}</div>
    </div>
  );
}

function QualityBadge({ label, coverage }) {
  const [txt, tone] = QUALITY[label] || QUALITY.degraded;
  const pct = typeof coverage === 'number' ? Math.round(coverage * 100) : null;
  return <div className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold', tone)}>{txt}{pct != null && <span className="font-normal opacity-80">· %{pct} kapsama</span>}</div>;
}

function ProfileBadges({ p }) {
  const items = [
    p.platform && p.platform !== 'unknown' ? p.platform : null,
    p.content_type || null,
    p.structure === 'flat' ? 'düz URL' : p.structure === 'hierarchical' ? 'kategorili' : null,
    p.url_sample_size ? `${p.url_sample_size} URL` : null,
  ].filter(Boolean);
  if (!items.length) return null;
  return <div className="flex flex-wrap gap-1.5">{items.map((x) => <span key={x} className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{x}</span>)}</div>;
}

function PatternRow({ p, checked, disabled, onToggle, source, onSource }) {
  return (
    <li className={cn('rounded-lg border p-3', checked ? 'border-primary/50 bg-primary/5' : 'border-border')}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} className="mt-1 size-4" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">{p.pattern}</code>
            {p.family && <Badge variant="secondary" className="text-[10px]">{FAMILY_LABEL[p.family] || p.family}</Badge>}
            {p.hasSchema && <Badge variant="success" className="text-[10px]">şema var</Badge>}
            {p.schemaResult === 'failed_validation' && <Badge variant="destructive" className="text-[10px]">doğrulanamadı</Badge>}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{p.count > 0 ? `${p.count} sayfa` : 'sayfa sayısı bilinmiyor'}</p>
          {(p.samples || []).slice(0, 3).map((u) => (
            <div key={u} className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground/70">
              <ChevronRight className="size-3 shrink-0" /><span className="truncate font-mono">{u}</span></div>
          ))}
          {checked && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Kaynak:</span>
              <div className="inline-flex overflow-hidden rounded-md border border-border">
                {['content', 'product'].map((s) => (
                  <button key={s} type="button" disabled={disabled} onClick={() => onSource(s)}
                    className={cn('px-2 py-1 text-[11px] font-medium', source === s ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent')}>
                    {s === 'content' ? 'İçerik' : 'Ürün'}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/* ── Recursive URL ağacı gezgini ──────────────────────────────────────────
   Backend `_build_url_tree` çıktısını açar; her düğüm seçilebilir. Düğüm pattern'i
   `${path}/*` — cluster_urls ile aynı biçim, aynı `selected` kümesinde birleşir. */
function TreeRow({ node, depth, selected, onToggle, disabled }) {
  const [open, setOpen] = useState(depth < 1);
  const hasKids = (node.children?.length || 0) > 0;
  const pattern = `${node.path}/*`;
  const isSel = selected.has(pattern);
  return (
    <li>
      <div className={cn('flex items-center gap-1.5 rounded-md py-1 pr-2', isSel ? 'bg-primary/10' : 'hover:bg-accent')}
        style={{ paddingInlineStart: 4 + depth * 16 }}>
        {hasKids ? (
          <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={open ? 'Kapat' : 'Aç'}>
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : <span className="inline-block size-4 shrink-0" />}
        <input type="checkbox" checked={isSel} disabled={disabled} onChange={() => onToggle(node)} className="size-3.5 shrink-0" aria-label={`${pattern} seç`} />
        <code className="truncate font-mono text-xs font-medium">/{node.segment}</code>
        <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground"><Hash className="size-2.5" />{node.count}</span>
      </div>
      {hasKids && open && (
        <ul>{node.children.map((k) => <TreeRow key={k.path} node={k} depth={depth + 1} selected={selected} onToggle={onToggle} disabled={disabled} />)}</ul>
      )}
    </li>
  );
}

function UrlTree({ tree, selected, onToggleNode, disabled }) {
  if (!tree || !(tree.children?.length > 0)) {
    return <Alert variant="info"><AlertDescription>URL ağacı yok — “Yeniden analiz et” ile kurulur.</AlertDescription></Alert>;
  }
  return (
    <div>
      <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] text-muted-foreground">
        <FolderTree className="size-3.5" /> Alt bölümleri açıp yalnız istediğin dalı seç (ör. yalnız <code className="mx-1 rounded bg-muted px-1 font-mono">/tr/discovery</code>).
      </p>
      <ul className={cn('max-h-72 overflow-y-auto', disabled && 'pointer-events-none opacity-60')}>
        {tree.children.map((k) => <TreeRow key={k.path} node={k} depth={0} selected={selected} onToggle={onToggleNode} disabled={disabled} />)}
      </ul>
    </div>
  );
}

function SchemaCard({ d, testing, disabled, onTest, onEdit }) {
  const [open, setOpen] = useState(false);
  const fields = Array.isArray(d.cssSchema?.fields) ? d.cssSchema.fields.map((f) => f?.name).filter(Boolean) : [];
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">{d.pattern}</code>
            {d.test && <Badge variant={d.test.verdict === 'pass' ? 'success' : 'destructive'} size="sm">
              {d.test.verdict === 'pass' ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />} {d.test.passed}/{d.test.total}</Badge>}
            {d.status === 'pending' && <span className="text-[11px] text-muted-foreground">üretiliyor…</span>}
          </div>
          {fields.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Alanlar: <span className="font-mono">{fields.join(', ')}</span></p>}
          {(d.status === 'generate_failed' || d.status === 'no_samples') && (
            <p className="mt-1 text-[11px] text-warning">{d.status === 'no_samples' ? 'Yeterli örnek bulunamadı.' : (d.error || 'Şema üretilemedi — elle tanımlayabilirsiniz.')}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={disabled || testing || !d.cssSchema || !!d.jsonError} onClick={onTest}>
            {testing ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />}<span className="ml-1 hidden sm:inline">Test</span></Button>
          <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}><ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} /></Button>
        </div>
      </div>

      {d.test && (
        <div className="space-y-2 border-t border-border px-3 py-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Çıkarılan içerik önizlemesi
            <span className="ml-1 font-normal text-muted-foreground/70">
              {d.test.threshold?.criterion === 'product'
                ? `(ürün eşiği: ≥${d.test.threshold?.minFields ?? 2} dolu alan)`
                : `(eşik: ≥${d.test.threshold?.minChars ?? 300} kar, proza ≥${d.test.threshold?.minProseRatio ?? 0.5})`}
            </span>
          </p>
          {d.test.samples.map((s) => (
            <div key={s.url} className={cn('rounded border p-2', s.ok ? 'border-success/25 bg-success/5' : 'border-destructive/25 bg-destructive/5')}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[10px] text-muted-foreground">{s.url}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{s.error ? 'hata' : (d.test.threshold?.criterion === 'product' ? `${s.fields ?? 0} alan · ${s.chars ?? 0} kar` : `${s.chars ?? 0} kar · proza ${s.proseRatio ?? 0}`)}</span>
              </div>
              {s.error ? <p className="mt-1 text-[11px] text-destructive">{s.error}</p>
                : <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] text-foreground/75">{s.preview?.trim() || '(boş — şema bu sayfada eşleşmedi)'}</p>}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="border-t border-border p-3">
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Şema (JSON) — elle düzenleyebilirsiniz</label>
          <textarea rows={9} disabled={disabled} value={d.raw || ''} onChange={(e) => onEdit(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/30 p-3 font-mono text-[11px]" placeholder='{"baseSelector":"article","fields":[...]}' />
          {d.jsonError ? <p className="mt-1 text-[11px] text-destructive">Geçersiz JSON: {d.jsonError}</p>
            : <p className="mt-1 text-[11px] text-muted-foreground">Şema bir sayfada yeterli metin çıkaramazsa sistem otomatik ham metne düşer — içerik kaybolmaz.</p>}
        </div>
      )}
    </div>
  );
}

function Row({ k, children }) {
  return <div className="flex justify-between py-0.5"><span className="text-muted-foreground">{k}</span><span className="font-medium">{children}</span></div>;
}
