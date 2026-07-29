'use client';

/**
 * Yetenekler adımı — dashboard'daki AssistantCapabilitiesForm + AssistantToolCard
 * karşılığı, KISITSIZ sürümü.
 *
 * Dashboard tool kartlarını üç kapıdan geçirir (firmanın iş modu, `comingSoon`,
 * `forAsistan`) ve bazı tool'ları katalogdan tamamen çıkarır. CMS'te bunların
 * hiçbiri yok: `TOOLS` kataloğundaki her tool açılabilir, her capability tek tek
 * seçilebilir (bkz. lib/assistant-capabilities.js başlığı).
 */

import { useState } from 'react';
import { ChevronDown, RotateCcw, Sparkles, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGetAssistantToolDefaultsQuery } from '@/redux/services';
import {
  DEFAULT_APPROVAL_EVENT,
  FILE_TYPE_OPTIONS,
  IMAGE_SIZES,
  IMAGE_STYLES,
  OFFER_SCOPE_MODES,
  SCOPE_MODES,
  TOOLS,
  isCapabilityEnabled,
  toggleCapability,
} from '@/lib/assistant-capabilities';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Field, NumberInput, SegmentPicker, TagInput, Textarea, ToggleRow } from './shared';
import { ProductPicker } from './entity-picker';

export function CapabilitiesStep({ w }) {
  const caps = w.capabilities;
  const setCaps = (patch) => w.set('capabilities', { ...caps, ...patch });

  const toolEnabled = (name) => caps.enabledTools.includes(name);

  const setToolEnabled = (name, next) => {
    const set = new Set(caps.enabledTools);
    if (next) set.add(name);
    else set.delete(name);
    set.add('DefaultTool'); // kapatılamaz
    setCaps({ enabledTools: Array.from(set) });
  };

  const primary = TOOLS.filter((t) => t.category === 'primary');
  const auxiliary = TOOLS.filter((t) => t.category === 'auxiliary');

  // Etkin tool'ların global (orijinal) intent metinleri — kartlarda "varsayılan"
  // olarak gösterilir; operatör üzerine yazdığında toolDefOverrides'a düşer.
  const { data: defaultsData } = useGetAssistantToolDefaultsQuery(w.enabledToolsPayload, {
    skip: w.enabledToolsPayload.length === 0,
  });
  const defaults = Object.fromEntries(
    (defaultsData?.toolDefinitions ?? []).map((d) => [d.toolName, d]),
  );

  return (
    <div className="space-y-5">
      <Alert variant="info">
        <AlertDescription>
          CMS'te <span className="font-medium">tüm tool'lar</span> seçilebilir — firmanın
          iş moduna göre gizleme, &quot;çok yakında&quot; kilidi ve gizli tool filtresi
          uygulanmaz. Asistan bir firmaya aktarılırken araç listesi o firmanın iş moduna
          göre yeniden süzülür.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Intent Üretimi</CardTitle>
          <CardToolbar>
            <Badge variant={caps.aiIntents ? 'success' : 'muted'}>
              {caps.aiIntents ? 'LLM açık' : 'Kapalı'}
            </Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <ToggleRow
            label="Tool intent metinlerini LLM ile üret"
            hint="Asistan oluşturulmadan önce seçili tool'lar için açıklama, anahtar kelime, örnek ve kural metinleri üretilir; kayıttan sonra asistanın tool kopyalarına yazılır. Üretim başarısız olursa asistan yine oluşur."
            checked={caps.aiIntents}
            onChange={(v) => setCaps({ aiIntents: v })}
            badge={<Badge variant="primary" className="gap-1"><Sparkles className="size-3" />LLM</Badge>}
          />
        </CardContent>
      </Card>

      <ToolGroup title="Ana Tool'lar" tools={primary} w={w} toolEnabled={toolEnabled} setToolEnabled={setToolEnabled} caps={caps} setCaps={setCaps} defaults={defaults} />
      <ToolGroup title="Yardımcı Tool'lar" tools={auxiliary} w={w} toolEnabled={toolEnabled} setToolEnabled={setToolEnabled} caps={caps} setCaps={setCaps} defaults={defaults} />

      <Card>
        <CardHeader>
          <CardTitle>Dosya Üretimi</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{caps.allowedFileTypes.length} tip</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Asistanın üretip kullanıcıya sunabileceği dosya biçimleri.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {FILE_TYPE_OPTIONS.map((f) => {
              const on = caps.allowedFileTypes.includes(f.id);
              return (
                <label
                  key={f.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition-colors',
                    on ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      setCaps({
                        allowedFileTypes: e.target.checked
                          ? [...caps.allowedFileTypes, f.id]
                          : caps.allowedFileTypes.filter((x) => x !== f.id),
                      })
                    }
                    className="mt-0.5 size-3.5 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{f.label}</span>
                    <span className="block text-xs text-muted-foreground">{f.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ToolGroup({ title, tools, w, toolEnabled, setToolEnabled, caps, setCaps, defaults }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardToolbar>
          <Badge variant="muted">
            {tools.filter((t) => toolEnabled(t.name)).length}/{tools.length} aktif
          </Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {tools.map((tool) => (
          <ToolCard
            key={tool.name}
            tool={tool}
            w={w}
            enabled={toolEnabled(tool.name)}
            onToggle={(v) => setToolEnabled(tool.name, v)}
            caps={caps}
            setCaps={setCaps}
            toolDefault={defaults[tool.name]}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ToolCard({ tool, w, enabled, onToggle, caps, setCaps, toolDefault }) {
  const Icon = tool.icon;
  const on = tool.alwaysOn || enabled;

  return (
    <div className={cn('rounded-xl border transition-colors', on ? `${tool.accentClass.border} ${tool.accentClass.bg}` : 'border-border')}>
      <div className="flex items-start gap-3 p-3">
        <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-background', tool.accentClass.icon)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn('text-sm font-semibold', on ? tool.accentClass.text : 'text-foreground')}>{tool.label}</p>
            <Badge variant="outline" className="font-mono text-[10px]">{tool.name}</Badge>
            {tool.alwaysOn && <Badge variant="muted">zorunlu</Badge>}
            {tool.shell && <Badge variant="warning">iskelet</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{tool.description}</p>
          {tool.shell && on ? (
            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
              Alan mantığı henüz yok — kayda yazılır ama runtime bu tool&apos;u çağırmaz.
            </p>
          ) : null}
        </div>
        <Switch checked={on} onCheckedChange={onToggle} disabled={tool.alwaysOn} />
      </div>

      {on ? (
        <div className="space-y-4 border-t border-border/60 p-3">
          {tool.capabilities.length > 0 && (
            <CapabilityList tool={tool} caps={caps} setCaps={setCaps} />
          )}

          {tool.defaultWebSearchScope && (
            <Field
              label="Web Araması Kısıtı"
              hint="Boş bırakılırsa kısıt yok. Site değerleri backend'de domain olarak normalize edilir (operatör enjeksiyonu elenir)."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">İzinli konular</p>
                  <TagInput
                    value={caps.defaultWebSearchScope?.allowedTopics ?? []}
                    onChange={(v) =>
                      setCaps({ defaultWebSearchScope: { ...caps.defaultWebSearchScope, allowedTopics: v } })
                    }
                    placeholder="Konu ekle…"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">İzinli siteler</p>
                  <TagInput
                    value={caps.defaultWebSearchScope?.allowedSites ?? []}
                    onChange={(v) =>
                      setCaps({ defaultWebSearchScope: { ...caps.defaultWebSearchScope, allowedSites: v } })
                    }
                    placeholder="example.com"
                  />
                </div>
              </div>
            </Field>
          )}

          {tool.inlineScope === 'product' && (
            <ScopeEditor label="Ürün Kapsamı" scopeKey="products" w={w} type="product" showGlobalToggle />
          )}
          {tool.inlineScope === 'service' && (
            <ScopeEditor label="Hizmet Kapsamı" scopeKey="services" w={w} type="services" showLocationAware />
          )}
          {tool.inlineScope === 'booking' && (
            <ScopeEditor label="Randevu / Rezervasyon Kapsamı" scopeKey="bookings" w={w} type="services" />
          )}
          {tool.inlineScope === 'image' && <ImageScopeEditor w={w} />}

          {tool.productDetailConfig && <ProductDetailSection w={w} />}
          {tool.serviceDetailConfig && <ServiceDetailSection w={w} />}
          {tool.offerToolScope && <OfferScopeSection w={w} />}
          {tool.approvalEvent && (
            <ApprovalEventSection
              w={w}
              stateKey={tool.approvalEvent === 'offer' ? 'offerApprovalEvent' : 'bookingApprovalEvent'}
            />
          )}

          <IntentSettingsSection
            toolName={tool.name}
            toolDefault={toolDefault}
            caps={caps}
            setCaps={setCaps}
            aiOn={caps.aiIntents}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Tool'un intent metinlerini elle düzenler — dashboard tool kartındaki
 * "Intent Ayarları" bölümünün karşılığı.
 *
 * Değerler `toolDefOverrides[toolName]`'e yazılır ve ANA kaydetle birlikte
 * kalıcılaştırılır (ayrı "kaydet" yok). LLM üretimi açıksa buradaki elle
 * düzenlemeler AI çıktısını EZER — sihirbaz override'ları AI'nın üstüne
 * spread eder (bkz. use-assistant-wizard.js submit).
 */
function IntentSettingsSection({ toolName, toolDefault, caps, setCaps, aiOn }) {
  const [open, setOpen] = useState(false);
  const override = caps.toolDefOverrides?.[toolName];
  const customized = Boolean(override && Object.keys(override).length);

  const val = (field, fallback) =>
    override?.[field] !== undefined ? override[field] : (toolDefault?.[field] ?? fallback);

  const setField = (field, value) =>
    setCaps({
      toolDefOverrides: {
        ...(caps.toolDefOverrides ?? {}),
        [toolName]: { ...(caps.toolDefOverrides?.[toolName] ?? {}), [field]: value },
      },
    });

  const reset = () => {
    const next = { ...(caps.toolDefOverrides ?? {}) };
    delete next[toolName];
    setCaps({ toolDefOverrides: next });
  };

  return (
    <div className="rounded-lg border border-dashed border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Intent Ayarları</span>
        {customized && <Badge variant="primary">özelleştirildi</Badge>}
        {aiOn && !customized && <Badge variant="muted">LLM üretecek</Badge>}
        <ChevronDown className={cn('ms-auto size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/60 p-3">
          {aiOn && (
            <Alert variant="info">
              <AlertDescription>
                LLM üretimi açık. Burada doldurduğunuz alanlar üretilen metinlerin
                <span className="font-medium"> yerine geçer</span>; boş bıraktıklarınızı LLM doldurur.
              </AlertDescription>
            </Alert>
          )}

          <Field label="Kullanıcı Etiketi" hint="Sohbette bu tool çalışırken gösterilen ad.">
            <Input value={val('userLabel', '')} onChange={(e) => setField('userLabel', e.target.value)} placeholder="Örn. Ürün aranıyor…" />
          </Field>

          <Field label="Açıklama" hint="Planner bu metinle tool'u ne zaman çağıracağına karar verir.">
            <Textarea rows={3} value={val('description', '')} onChange={(e) => setField('description', e.target.value)} placeholder="Kullanıcı ürün aradığında çağrılır…" />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Anahtar kelimeler">
              <TagInput value={val('keywords', [])} onChange={(v) => setField('keywords', v)} placeholder="ürün" />
            </Field>
            <Field label="Örnek mesajlar">
              <TagInput value={val('examples', [])} onChange={(v) => setField('examples', v)} placeholder="Kırmızı elbise var mı?" />
            </Field>
            <Field label="Kurallar">
              <TagInput value={val('rules', [])} onChange={(v) => setField('rules', v)} placeholder="Stok yoksa alternatif öner" />
            </Field>
          </div>

          {customized && (
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="size-3.5" />
              Varsayılana dön
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function CapabilityList({ tool, caps, setCaps }) {
  return (
    <Field label="Yetenekler" hint="Tool'un planner kayıtlarından gelen alt yetenekleri.">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {tool.capabilities.map((c) => {
          const on = isCapabilityEnabled(tool.name, c, caps.disabledCapabilities);
          return (
            <label
              key={c.id}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors',
                c.required ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                on ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-accent',
              )}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={c.required}
                onChange={(e) =>
                  setCaps({
                    disabledCapabilities: toggleCapability(
                      tool.name,
                      c,
                      caps.disabledCapabilities,
                      e.target.checked,
                    ),
                  })
                }
                className="mt-0.5 size-3.5 accent-primary"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">{c.label}</span>
                  {c.required && <Badge variant="muted">zorunlu</Badge>}
                </span>
                {c.description && (
                  <span className="block text-xs text-muted-foreground">{c.description}</span>
                )}
                <span className="block font-mono text-[10px] text-muted-foreground/70">
                  {tool.name}:{c.id}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </Field>
  );
}

function ScopeEditor({ label, scopeKey, w, type, showGlobalToggle, showLocationAware }) {
  const scope = w[scopeKey];
  const set = (patch) => w.set(scopeKey, { ...scope, ...patch });
  const needsIds = ['company', 'catalog', 'category', 'subset', 'single'].includes(scope.mode);

  return (
    <Field label={label}>
      <div className="space-y-3">
        <SegmentPicker options={SCOPE_MODES} value={scope.mode} onChange={(v) => set({ mode: v })} />

        {needsIds && (
          <div className="grid gap-2 sm:grid-cols-2">
            {scope.mode === 'company' && (
              <Field label="Firma ID'leri" className="sm:col-span-2">
                <TagInput value={scope.companyIds} onChange={(v) => set({ companyIds: v })} placeholder="companyId…" />
              </Field>
            )}
            {scope.mode === 'catalog' && (
              <Field label="Katalog ID'leri" className="sm:col-span-2">
                <TagInput value={scope.catalogIds} onChange={(v) => set({ catalogIds: v })} placeholder="catalogId…" />
              </Field>
            )}
            {scope.mode === 'category' && (
              <Field label="Kategori ID'leri" className="sm:col-span-2">
                <TagInput value={scope.categoryIds} onChange={(v) => set({ categoryIds: v })} placeholder="categoryId…" />
              </Field>
            )}
            {(scope.mode === 'subset' || scope.mode === 'single') && (
              <Field label={scope.mode === 'single' ? 'Kayıt' : 'Kayıtlar'} className="sm:col-span-2">
                <ProductPicker
                  companyId={w.companyId}
                  type={type}
                  value={scope.productIds}
                  onChange={(v) => set({ productIds: scope.mode === 'single' ? v.slice(-1) : v })}
                />
              </Field>
            )}
          </div>
        )}

        {scope.mode === 'subset' && scope.productIds.length === 0 && (
          <Alert variant="warning">
            <AlertDescription>
              Boş bir &quot;belirli kayıtlar&quot; listesi kapsamı DARALTMAZ, tam tersine
              firmanın tamamına açar. En az bir kayıt seçin.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Maks. Sonuç">
            <NumberInput value={scope.maxItems} min={1} max={1000} onChange={(v) => set({ maxItems: v })} />
          </Field>
          {showLocationAware && (
            <div className="flex items-end">
              <div className="w-full">
                <ToggleRow
                  label="Konum duyarlı"
                  hint="Sonuç sıralamasında konumu hesaba katar."
                  checked={scope.locationAware}
                  onChange={(v) => set({ locationAware: v })}
                />
              </div>
            </div>
          )}
        </div>

        {showGlobalToggle && (
          <ToggleRow
            label="Global ürün aramasına izin ver"
            hint="Firma kataloğunda sonuç yoksa Tinnten geneline düşer. Güvenlik politikasına yazılır."
            checked={scope.allowGlobalProductSearch}
            onChange={(v) => set({ allowGlobalProductSearch: v })}
          />
        )}
      </div>
    </Field>
  );
}

function ImageScopeEditor({ w }) {
  const s = w.imageScope;
  const set = (patch) => w.set('imageScope', { ...s, ...patch });
  return (
    <Field label="Görsel Üretim Ayarları">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Stil">
          <Select value={s.style} onValueChange={(v) => set({ style: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {IMAGE_STYLES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Boyut">
          <Select value={s.defaultSize} onValueChange={(v) => set({ defaultSize: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {IMAGE_SIZES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Adet">
          <NumberInput value={s.defaultCount} min={1} max={4} onChange={(v) => set({ defaultCount: v })} />
        </Field>
        <Field label="Prompt Şablonu" className="sm:col-span-3">
          <Textarea rows={2} value={s.promptTemplate} onChange={(e) => set({ promptTemplate: e.target.value })} placeholder="Ürün görselini … tarzında üret" />
        </Field>
      </div>
    </Field>
  );
}

function ProductDetailSection({ w }) {
  const s = w.productDetailScope;
  const set = (patch) => w.set('productDetailScope', { ...s, ...patch });
  return (
    <Field label="Ürün Detayı & Soru-Cevap">
      <div className="space-y-2">
        <ToggleRow
          label="Ürün detayı / soru-cevap"
          hint="Açıksa ProductDetailTool etkin tool listesine eklenir."
          checked={s.detailEnabled}
          onChange={(v) => set({ detailEnabled: v })}
        />
        {s.detailEnabled && (
          <>
            <ToggleRow
              label="Web araması"
              hint="Katalog dışı bilgi için web'e çıkar. Konu kısıtı aşağıda."
              checked={s.webSearchEnabled}
              onChange={(v) => set({ webSearchEnabled: v })}
            />
            {s.webSearchEnabled && (
              <Field label="İzinli konular" hint="Boş ise firmanın sektör/kategorileri kullanılır.">
                <TagInput value={s.allowedTopics} onChange={(v) => set({ allowedTopics: v })} placeholder="Konu ekle…" />
              </Field>
            )}
            <ToggleRow
              label="Ürün sayfası kazıma (scrape)"
              hint="Ürünün kaynak sayfasından detay çeker."
              checked={s.scrapeEnabled}
              onChange={(v) => set({ scrapeEnabled: v })}
            />
          </>
        )}
        <ToggleRow
          label="Belirsiz aramada netleştirme sorusu"
          hint="Güven eşiğin altındaysa aramadan önce soru sorar."
          checked={s.clarifyEnabled}
          onChange={(v) => set({ clarifyEnabled: v })}
        />
        {s.clarifyEnabled && (
          <Field label="Güven eşiği" hint="0–1 arası. Güven bu değerin ALTINDAysa soru sorulur.">
            <NumberInput value={s.clarifyThreshold} min={0} max={1} step={0.05} onChange={(v) => set({ clarifyThreshold: v })} className="max-w-[140px]" />
          </Field>
        )}
      </div>
    </Field>
  );
}

function ServiceDetailSection({ w }) {
  const s = w.serviceDetailScope;
  const set = (patch) => w.set('serviceDetailScope', { ...s, ...patch });
  return (
    <Field label="Hizmet Detayı & Talep">
      <div className="space-y-2">
        <ToggleRow
          label="Hizmet detayı / konfigürasyon"
          hint="Açıksa ServicesDetailTool etkin tool listesine eklenir."
          checked={s.detailEnabled}
          onChange={(v) => set({ detailEnabled: v })}
        />
        <ToggleRow
          label="Talep (lead) oluşturma"
          hint="Kullanıcı hizmet için talep bırakabilir."
          checked={s.leadSubmitEnabled}
          onChange={(v) => set({ leadSubmitEnabled: v })}
        />
      </div>
    </Field>
  );
}

function OfferScopeSection({ w }) {
  const s = w.offerToolScope;
  const set = (patch) => w.set('offerToolScope', { ...s, ...patch });
  return (
    <Field label="Teklif Kapsamı">
      <div className="space-y-3">
        <SegmentPicker options={OFFER_SCOPE_MODES} value={s.mode} onChange={(v) => set({ mode: v })} />
        {s.mode === 'product' && (
          <Field label="Hizmetler">
            <ProductPicker companyId={w.companyId} type="services" value={s.productIds} onChange={(v) => set({ productIds: v })} />
          </Field>
        )}
        {s.mode === 'subject' && (
          <Field label="Konular" hint="Ürün olmadan konu üzerinden form üretilir.">
            <TagInput value={s.subjects} onChange={(v) => set({ subjects: v })} placeholder="Konu ekle…" />
          </Field>
        )}
      </div>
    </Field>
  );
}

function ApprovalEventSection({ w, stateKey }) {
  const s = w[stateKey] ?? DEFAULT_APPROVAL_EVENT;
  const set = (patch) => w.set(stateKey, { ...s, ...patch });
  const setCh = (ch, patch) => set({ [ch]: { ...s[ch], ...patch } });
  return (
    <Field label="Onay Olayı" hint="Kullanıcı onay verdiğinde tetiklenecek kanallar.">
      <div className="space-y-2">
        <ToggleRow label="Onay olayı etkin" checked={s.enabled} onChange={(v) => set({ enabled: v })} />
        {s.enabled && (
          <div className="grid gap-2 sm:grid-cols-2">
            <ToggleRow label="E-posta" hint="Firma sahibine bildirim" checked={s.email.enabled} onChange={(v) => setCh('email', { enabled: v })} />
            <ToggleRow label="SMS" checked={s.sms.enabled} onChange={(v) => setCh('sms', { enabled: v })} />
            <ToggleRow label="İş akışı" hint="Bağlı workflow tetiklenir" checked={s.workflow.enabled} onChange={(v) => setCh('workflow', { enabled: v })} />
            <ToggleRow label="MCP" hint="Bağlı MCP connector'a olay gönderir" checked={s.mcp.enabled} onChange={(v) => setCh('mcp', { enabled: v })} />
          </div>
        )}
      </div>
    </Field>
  );
}

export default CapabilitiesStep;
