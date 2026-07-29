/**
 * CMS asistan sihirbazı — TOOL + CAPABILITY kataloğu.
 *
 * Dashboard'daki `capabilityCatalog.ts` portudur ama KISITLAYICI ALANLARI YOKTUR.
 * Dashboard katalogu asistan tasarımcısına gösterilecekleri üç ayrı kapıdan
 * geçirir; CMS operatörü bunların hiçbirine tabi değildir:
 *
 *   1. `businessModes`  → tool'u firmanın iş moduna göre gizler. CMS'te asistan
 *      firmasız da oluşturulabildiği için iş modu bilinmez; ayrıca operatör
 *      firmanın moduna bakmaksızın tool bağlayabilmeli.
 *   2. `comingSoon`     → MakeImageTool'u disabled gösterir.
 *   3. `forAsistan:false` → WorkflowTool'u tamamen gizler.
 *
 * Ayrıca dashboard katalogunda "asistan bağlamında davranışı kararlaştırılmadı"
 * notuyla YORUMA ALINMIŞ tool'lar (ResearcherTool, LearningTool, TripPlannerTool,
 * DayPlannerTool) burada AÇIKTIR.
 *
 * Liste, backend `asistans.model.js > ASSISTANT_TOOL_NAMES` enum'u ile birebir
 * olmalı — burada olup enum'da olmayan bir ad Mongoose ValidationError verir.
 * Onay tool'ları (AppointmentConfirmTool / OfferConfirmTool) enum'da YOKTUR:
 * continuation-only bağımlılıklardır, ebeveynleriyle etkinleşirler.
 */

import {
  MessageSquare,
  Telescope,
  Map,
  GraduationCap,
  ShoppingBag,
  Workflow,
  CalendarCheck,
  Send,
  Image as ImageIcon,
  Briefcase,
  Globe,
  Users,
} from 'lucide-react';

/* ── Dosya tipleri (allowedFileTypes) ─────────────────────────────────
   Backend `buildPayloadFromBody` bu 9 değeri whitelist'ler; dışındakiler
   sessizce düşer. */
export const FILE_TYPE_OPTIONS = [
  { id: 'pdf', label: 'PDF', description: 'Profesyonel rapor, paylaşım için' },
  { id: 'html', label: 'HTML', description: 'Web önizleme + yazdırma' },
  { id: 'md', label: 'Markdown', description: 'Düz metin, kod-friendly' },
  { id: 'docx', label: 'Word (.docx)', description: 'Düzenlenebilir doküman' },
  { id: 'xlsx', label: 'Excel (.xlsx)', description: 'Tablolar, hesaplama' },
  { id: 'pptx', label: 'PowerPoint (.pptx)', description: 'Sunum slaytları' },
  { id: 'csv', label: 'CSV', description: 'Veri export, analiz' },
  { id: 'json', label: 'JSON', description: 'Yapılandırılmış veri' },
  { id: 'txt', label: 'Düz Metin', description: 'Basit text' },
];

/* ── Kapsam modları (productScope / serviceScope / bookingScope) ─────── */
export const SCOPE_MODES = [
  { value: 'all', label: 'Tümü', hint: 'Firmanın tüm kataloğu' },
  { value: 'company', label: 'Firma bazlı', hint: 'Seçili firmaların katalogları' },
  { value: 'catalog', label: 'Katalog bazlı', hint: 'Seçili kataloglar' },
  { value: 'category', label: 'Kategori bazlı', hint: 'Belirli kategoriler' },
  { value: 'subset', label: 'Belirli kayıtlar', hint: 'Tek tek seçilmiş liste' },
  { value: 'single', label: 'Tek kayıt', hint: 'Yalnızca bir kayıt' },
];

export const IMAGE_STYLES = ['auto', 'realistic', 'product-photo', 'lifestyle', 'creative'];
export const IMAGE_SIZES = ['256x256', '512x512', '1024x1024'];

/* ── Bilgi Tabanı (RAG) anahtarı ───────────────────────────────────────
   DefaultTool'un `library_rag_search`'ü enabledByDefault:false — bu yüzden
   anahtarın `disabledCapabilities` içinde OLMASI "override → AÇIK" demektir.
   Ters gibi görünen bu mantık backend sözleşmesi; dashboard da böyle okur. */
export const LIBRARY_RAG_CAPABILITY_KEY = 'DefaultTool:library_rag_search';

export const isLibraryRagEnabled = (disabledCapabilities = []) =>
  Array.isArray(disabledCapabilities) &&
  disabledCapabilities.includes(LIBRARY_RAG_CAPABILITY_KEY);

/* ── Web arama anahtarları ─────────────────────────────────────────────
   Hepsi enabledByDefault:true → listede olması "kapalı" demektir. */
export const WEB_SEARCH_CAPABILITY_KEYS = [
  'DefaultTool:web_search_text',
  'DefaultTool:web_search_image',
  'DefaultTool:web_search_video',
  'DefaultTool:web_search_places',
];

/** En az bir web_search_* açıksa true. Backend `allowWebSearch` bundan türetilir. */
export const isWebSearchEnabled = (disabledCapabilities = []) =>
  WEB_SEARCH_CAPABILITY_KEYS.some(
    (key) => !(Array.isArray(disabledCapabilities) && disabledCapabilities.includes(key)),
  );

/**
 * Bir capability açık mı? `enabledByDefault` ile `disabledCapabilities`
 * listesinin XOR'u: liste "varsayılanı TERSİNE ÇEVİR" anlamına gelir.
 */
export const isCapabilityEnabled = (toolName, cap, disabledCapabilities = []) => {
  const key = `${toolName}:${cap.id}`;
  const flipped = Array.isArray(disabledCapabilities) && disabledCapabilities.includes(key);
  return cap.enabledByDefault ? !flipped : flipped;
};

/** Capability'yi aç/kapa — `disabledCapabilities` listesini döndürür. */
export const toggleCapability = (toolName, cap, disabledCapabilities = [], next) => {
  const key = `${toolName}:${cap.id}`;
  const list = Array.isArray(disabledCapabilities) ? [...disabledCapabilities] : [];
  const shouldFlip = cap.enabledByDefault ? !next : next;
  const idx = list.indexOf(key);
  if (shouldFlip && idx === -1) list.push(key);
  if (!shouldFlip && idx !== -1) list.splice(idx, 1);
  return list;
};

const accent = (name) => ({
  primary: { border: 'border-primary/40', bg: 'bg-primary/5', icon: 'text-primary', text: 'text-primary' },
  violet: { border: 'border-violet-400/40', bg: 'bg-violet-500/5', icon: 'text-violet-600 dark:text-violet-400', text: 'text-violet-700 dark:text-violet-400' },
  emerald: { border: 'border-emerald-400/40', bg: 'bg-emerald-500/5', icon: 'text-emerald-600 dark:text-emerald-400', text: 'text-emerald-700 dark:text-emerald-400' },
  blue: { border: 'border-blue-400/40', bg: 'bg-blue-500/5', icon: 'text-blue-600 dark:text-blue-400', text: 'text-blue-700 dark:text-blue-400' },
  indigo: { border: 'border-indigo-400/40', bg: 'bg-indigo-500/5', icon: 'text-indigo-600 dark:text-indigo-400', text: 'text-indigo-700 dark:text-indigo-400' },
  orange: { border: 'border-orange-400/40', bg: 'bg-orange-500/5', icon: 'text-orange-600 dark:text-orange-400', text: 'text-orange-700 dark:text-orange-400' },
  pink: { border: 'border-pink-400/40', bg: 'bg-pink-500/5', icon: 'text-pink-600 dark:text-pink-400', text: 'text-pink-700 dark:text-pink-400' },
  rose: { border: 'border-rose-400/40', bg: 'bg-rose-500/5', icon: 'text-rose-600 dark:text-rose-400', text: 'text-rose-700 dark:text-rose-400' },
  sky: { border: 'border-sky-400/40', bg: 'bg-sky-500/5', icon: 'text-sky-600 dark:text-sky-400', text: 'text-sky-700 dark:text-sky-400' },
  amber: { border: 'border-amber-400/40', bg: 'bg-amber-500/5', icon: 'text-amber-600 dark:text-amber-400', text: 'text-amber-700 dark:text-amber-400' },
  slate: { border: 'border-border', bg: 'bg-muted/40', icon: 'text-muted-foreground', text: 'text-foreground' },
}[name]);

/**
 * `inlineScope` — kart gövdesinde hangi kapsam alanı düzenlenir:
 *   product → productScope | service → serviceScope
 *   booking → bookingScope | image   → imageScope
 */
export const TOOLS = [
  {
    name: 'DefaultTool',
    label: 'Sohbet',
    description: 'Genel sohbet, web arama, dosya analizi. Asistanın temel modu.',
    icon: MessageSquare,
    conversationMode: 'chat',
    category: 'primary',
    accentClass: accent('primary'),
    // DefaultTool kapatılamaz — backend her asistana zorla ekliyor.
    alwaysOn: true,
    capabilities: [
      { id: 'file_intelligence', label: 'Dosya analizi', description: 'Yüklenen dosyaları okur, özetler.', enabledByDefault: false },
      { id: 'web_search_text', label: 'Web arama (metin)', enabledByDefault: true },
      { id: 'web_search_image', label: 'Web arama (görsel)', enabledByDefault: true },
      { id: 'web_search_video', label: 'Web arama (video)', enabledByDefault: true },
      { id: 'web_search_places', label: 'Web arama (mekan)', enabledByDefault: true },
      { id: 'library_rag_search', label: 'Bilgi tabanı (RAG)', description: 'Library bağlandığında semantik arama.', enabledByDefault: false },
      { id: 'final_compose', label: 'Cevap derleme', enabledByDefault: true, required: true },
    ],
    defaultWebSearchScope: true,
  },
  {
    name: 'ProductSearchTool',
    label: 'Ürün Arama (Alışveriş)',
    description: 'Ürün arama, karşılaştırma, öneri. Planner/capability yok — ürün kapsamını kullanır.',
    icon: ShoppingBag,
    conversationMode: 'shopping',
    category: 'auxiliary',
    accentClass: accent('emerald'),
    scopeOnly: true,
    inlineScope: 'product',
    productDetailConfig: true,
    capabilities: [],
  },
  {
    name: 'ServicesSearchTool',
    label: 'Hizmet Arama',
    description:
      'Hizmet arama ve sunum (1-5 sonuç, sohbet içi kart) + seçili hizmet için detay, fiyat ve talep akışı. Niyet algılamasıyla tetiklenir.',
    icon: Briefcase,
    conversationMode: 'shopping',
    category: 'auxiliary',
    accentClass: accent('blue'),
    scopeOnly: true,
    inlineScope: 'service',
    serviceDetailConfig: true,
    capabilities: [],
  },
  {
    name: 'AppointmentSearchTool',
    label: 'Randevu',
    description:
      'Saat/slot bazlı randevu: müsait slot arama, alternatif saat önerisi, 5 dakikalık geçici yer tutma ve onay.',
    icon: CalendarCheck,
    category: 'auxiliary',
    accentClass: accent('indigo'),
    scopeOnly: true,
    inlineScope: 'booking',
    approvalEvent: 'booking',
    capabilities: [],
  },
  {
    name: 'BookingSearchTool',
    label: 'Rezervasyon',
    description:
      'Tarih aralığı bazlı rezervasyon: giriş/çıkış, gece veya gün sayısı, kapasite. Her gece için canlı müsaitlik ve rezervasyon birimine göre fiyat.',
    icon: CalendarCheck,
    category: 'auxiliary',
    accentClass: accent('indigo'),
    scopeOnly: true,
    inlineScope: 'booking',
    approvalEvent: 'booking',
    capabilities: [],
  },
  {
    name: 'OfferRequestTool',
    label: 'Teklif Yönetimi',
    description: 'Müşteri teklif taleplerini yönetir. ALL / PRODUCT / SUBJECT modlarıyla kapsam belirlenir.',
    icon: Send,
    category: 'auxiliary',
    accentClass: accent('orange'),
    offerToolScope: true,
    approvalEvent: 'offer',
    capabilities: [],
  },
  {
    name: 'MakeImageTool',
    label: 'Görsel Üretimi',
    // Dashboard'da `comingSoon` ile kilitli; CMS'te açık.
    description: 'Asistana özel prompt ile görsel üretir. Niyet algılamasıyla tetiklenir ("resim çiz").',
    icon: ImageIcon,
    category: 'auxiliary',
    accentClass: accent('pink'),
    inlineScope: 'image',
    capabilities: [],
  },
  {
    name: 'ResearcherTool',
    label: 'Derin Araştırma',
    description: 'Çok aşamalı araştırma raporu. Library/web kaynaklarından grounded içerik.',
    icon: Telescope,
    conversationMode: 'research',
    category: 'primary',
    accentClass: accent('violet'),
    capabilities: [
      { id: 'library_rag_search', label: 'Bilgi tabanı (RAG)', enabledByDefault: false },
      { id: 'web_search', label: 'Web araması', enabledByDefault: true },
      { id: 'deep_scrape', label: 'Derin scrape (2-pass)', enabledByDefault: false },
      { id: 'ask_user', label: 'Kullanıcıya soru sor', enabledByDefault: true },
      { id: 'dynamic_agent', label: 'Dinamik agent (özet/dönüştürme)', enabledByDefault: true },
    ],
  },
  {
    name: 'LearningTool',
    label: 'Öğrenme',
    description: 'Eğitim/öğrenme planı oluşturma ve takip.',
    icon: GraduationCap,
    conversationMode: 'learning',
    category: 'primary',
    accentClass: accent('rose'),
    capabilities: [
      { id: 'plan_builder', label: 'Plan oluşturma', enabledByDefault: true },
      { id: 'topic_scope_agent', label: 'Konu kapsamı analizi', enabledByDefault: true },
      { id: 'level_assessor', label: 'Seviye değerlendirme', enabledByDefault: false },
      { id: 'node_evaluator', label: 'Düğüm değerlendirme', enabledByDefault: false },
    ],
  },
  {
    name: 'TripPlannerTool',
    label: 'Rota Planlama',
    description: 'Lokasyon bazlı seyahat rotası — şehir/lokasyon, harita destekli.',
    icon: Map,
    conversationMode: 'planning',
    category: 'primary',
    accentClass: accent('sky'),
    capabilities: [
      { id: 'trip_clarification', label: 'Yolculuk netleştirme', enabledByDefault: true },
      { id: 'trip_planner_agent', label: 'Rota planlayıcı', enabledByDefault: true },
      { id: 'trip_finalize', label: 'Rota sonlandırma (PDF/HTML/QR)', enabledByDefault: true },
      { id: 'trip_update_loop', label: 'Rota güncelleme döngüsü', enabledByDefault: true },
    ],
  },
  {
    name: 'DayPlannerTool',
    label: 'Günlük Aktivite Planı',
    description: 'Günlük aktivite, etkinlik, ilçe-içi rota önerileri.',
    icon: CalendarCheck,
    conversationMode: 'planning',
    category: 'primary',
    accentClass: accent('sky'),
    capabilities: [
      { id: 'day_query_parser', label: 'Sorgu çözümleyici', enabledByDefault: true },
      { id: 'day_activity_searcher', label: 'Aktivite araması', enabledByDefault: false },
      { id: 'day_plan_recursion', label: 'Plan iterasyonu', enabledByDefault: false },
      { id: 'day_inter_district_route', label: 'İlçeler arası rota', enabledByDefault: false },
    ],
  },
  {
    name: 'WebSearchTool',
    label: 'Web Arama (bağımsız)',
    description: 'DefaultTool içindeki web aramasından ayrı, doğrudan çağrılabilen web arama tool\'u.',
    icon: Globe,
    category: 'auxiliary',
    accentClass: accent('slate'),
    capabilities: [],
  },
  {
    name: 'WorkflowTool',
    label: 'İş Akışı',
    // Dashboard'da `forAsistan:false` ile gizli; CMS'te açık.
    description: 'TintenAI Workflow builder tool\'u. Asistanın iş akışı tetiklemesini sağlar.',
    icon: Workflow,
    category: 'auxiliary',
    accentClass: accent('amber'),
    capabilities: [],
  },
  {
    name: 'HRAsistanTool',
    label: 'İK Asistanı',
    description: 'İK alan mantığı henüz yok — planner/capability iskeleti. Etkinleştirilse de runtime dispatch\'i engellenir.',
    icon: Users,
    category: 'auxiliary',
    accentClass: accent('slate'),
    // Enum'da var (ValidationError vermez) ama assistantToolPolicy dispatch'i
    // bloklar. Operatör yanlış beklentiye girmesin diye açıkça işaretli.
    shell: true,
    capabilities: [],
  },
];

/** Kart gösterilmeyen, ebeveyn tool'un detay toggle'ıyla yönetilen tool'lar. */
export const DETAIL_TOOLS = ['ProductDetailTool', 'ServicesDetailTool'];

export const getTool = (name) => TOOLS.find((t) => t.name === name) || null;

/* ── Varsayılan değerler ──────────────────────────────────────────────── */

export const DEFAULT_SCOPE = {
  mode: 'all',
  companyIds: [],
  catalogIds: [],
  productIds: [],
  categoryIds: [],
  maxItems: 50,
  locationAware: false,
  allowGlobalProductSearch: false,
};

export const DEFAULT_IMAGE_SCOPE = {
  style: 'auto',
  defaultSize: '1024x1024',
  defaultCount: 1,
  promptTemplate: '',
  categoryIds: [],
};

export const DEFAULT_APPROVAL_EVENT = {
  enabled: true,
  email: { enabled: false, recipientMode: 'owner' },
  sms: { enabled: false },
  workflow: { enabled: false },
  mcp: { enabled: false },
};

export const DEFAULT_OFFER_TOOL_SCOPE = { mode: 'all', productIds: [], subjects: [] };

export const OFFER_SCOPE_MODES = [
  { value: 'all', label: 'Tüm Konular', hint: 'Her konuda teklif alınabilir' },
  { value: 'product', label: 'Belirli Ürünler', hint: 'Sadece seçili hizmetler için' },
  { value: 'subject', label: 'Konu Bazlı', hint: 'Ürün olmadan konu üzerinden form üretilir' },
];

export const DEFAULT_PRODUCT_DETAIL_SCOPE = {
  detailEnabled: false,
  webSearchEnabled: false,
  scrapeEnabled: false,
  allowedTopics: [],
  clarifyEnabled: false,
  clarifyThreshold: 0.5,
};

export const DEFAULT_SERVICE_DETAIL_SCOPE = {
  detailEnabled: false,
  leadSubmitEnabled: false,
};

/* ── Embed (runtimePolicy.ui.embed) ───────────────────────────────────── */

export const DEFAULT_EMBED_CONFIG = {
  enabled: false,
  theme: 'auto',
  display: 'bubble',
  position: 'bottom-right',
  launcherColor: '#4f46e5',
  launcherIconColor: '#ffffff',
  bodyBackgroundColor: '',
  bodyTextColor: '',
  inputBackgroundColor: '',
  inputTextColor: '',
  userMessageBackgroundColor: '',
  userMessageTextColor: '',
  assistantMessageBackgroundColor: '',
  assistantMessageTextColor: '',
  userMessageSide: 'right',
  assistantMessageSide: 'left',
  messageRadius: 18,
  pageContext: true,
};

const pickOne = (value, allowed, fallback) =>
  typeof value === 'string' && allowed.includes(value) ? value : fallback;

/** Backend `normalizeAssistantEmbedConfig` ile aynı sözleşme. */
export const normalizeEmbedConfig = (raw) => {
  const r = raw && typeof raw === 'object' ? raw : {};
  const color = (v, fb = '') => (typeof v === 'string' && v.trim() ? v.trim() : fb);
  const radius = Number(r.messageRadius);
  return {
    ...DEFAULT_EMBED_CONFIG,
    ...r,
    enabled: r.enabled === true,
    theme: pickOne(r.theme, ['auto', 'light', 'dark'], 'auto'),
    display: pickOne(r.display, ['bubble', 'drawer'], 'bubble'),
    position: pickOne(r.position, ['bottom-right', 'bottom-left'], 'bottom-right'),
    launcherColor: color(r.launcherColor, DEFAULT_EMBED_CONFIG.launcherColor),
    launcherIconColor: color(r.launcherIconColor, DEFAULT_EMBED_CONFIG.launcherIconColor),
    userMessageSide: pickOne(r.userMessageSide, ['left', 'right'], 'right'),
    assistantMessageSide: pickOne(r.assistantMessageSide, ['left', 'right'], 'left'),
    messageRadius: Number.isFinite(radius) ? Math.max(8, Math.min(32, Math.round(radius))) : 18,
    pageContext: typeof r.pageContext === 'boolean' ? r.pageContext : true,
  };
};

/* ── Diğer sabitler ───────────────────────────────────────────────────── */

export const LOCALES = [
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

export const OUT_OF_SCOPE_BEHAVIORS = [
  { value: 'deny', label: 'Reddet', hint: 'Kapsam dışı soruya cevap vermez' },
  { value: 'redirect', label: 'Yönlendir', hint: 'Kapsam içine yönlendirir' },
  { value: 'general_answer', label: 'Genel cevap', hint: 'Genel bilgiyle cevaplar' },
];

// Backend enum'u yalnızca bu ikisini kabul eder (assistantIntentSettingsSchema).
export const INTENT_MODES = [
  { value: 'llm', label: 'LLM', hint: 'Niyet tamamen LLM ile çözümlenir (önerilen)' },
  { value: 'hybrid', label: 'Hibrit', hint: 'Önce anahtar kelime, kararsızsa LLM' },
];

/** Prompt adımı doğrulaması — dashboard `validatePrompt` ile aynı eşikler. */
export const validatePrompt = ({ asistan_name = '', systemPrompt = '' } = {}) => {
  const name = asistan_name.trim();
  const sys = systemPrompt.trim();
  const errors = [];
  if (!name) errors.push('Asistan adı zorunludur.');
  if (name.length > 80) errors.push('Asistan adı en fazla 80 karakter olabilir.');
  if (sys.length > 8000) errors.push('Sistem promptu en fazla 8000 karakter olabilir.');
  return { valid: errors.length === 0, errors };
};
