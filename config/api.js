/**
 * Merkezi API yapılandırması.
 *
 * Tüm HTTP istemcileri (axios `lib/http.js` ve RTK Query `redux/services/baseApi.js`)
 * base URL'i buradan alır — tek doğruluk kaynağı.
 *
 * Base URL `.env.local` içindeki NEXT_PUBLIC_BACKEND_URL ile override edilebilir.
 * Varsayılan: yerel backend (tinnten-server) → http://localhost:5001/api/v10
 */
const DEFAULT_API_VERSION = 'v10';

/**
 * Env değişkeni nasıl set edilirse edilsin (`https://api.tinnten.com`,
 * `https://api.tinnten.com/`, `https://api.tinnten.com/api/v10`,
 * `https://api.tinnten.com/api/v10/` …) hep `<origin>/api/v10` haline getir.
 * Production'da `/api/v10` suffix'i unutulduğunda istekler 404'e düşmesin.
 */
export const normalizeApiBaseUrl = (raw, version = DEFAULT_API_VERSION) => {
  if (!raw) return `http://localhost:5001/api/${version}`;
  // Sondaki slash'leri at
  const trimmed = String(raw).trim().replace(/\/+$/, '');
  // /api/vN ile bitiyorsa olduğu gibi bırak
  if (/\/api\/v\d+$/.test(trimmed)) return trimmed;
  // Yolda /api/vN varsa (örn .../api/v10/extra) o noktaya kadar al
  const match = trimmed.match(/^(.*?\/api\/v\d+)(?:\/|$)/);
  if (match) return match[1];
  return `${trimmed}/api/${version}`;
};

export const API_BASE_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_BACKEND_URL,
);

/** Sadece host (örn. dosya/CDN URL'leri için) → http://localhost:5001 */
export const API_HOST = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

/** Varsayılan istek zaman aşımı (ms) */
export const API_TIMEOUT = 30_000;

/**
 * Haber sistemi desteklenen ülkeler — tinnten-server COUNTRY_MAP /
 * ALLOWED_COUNTRIES ile birebir. CMS ülke seçicileri bunu kullanır.
 */
export const NEWS_COUNTRIES = [
  { code: 'TR', name: 'Türkiye' },
  { code: 'US', name: 'ABD' },
  { code: 'GB', name: 'Birleşik Krallık' },
  { code: 'DE', name: 'Almanya' },
  { code: 'FR', name: 'Fransa' },
  { code: 'ES', name: 'İspanya' },
  { code: 'IT', name: 'İtalya' },
  { code: 'AR', name: 'Suudi Arabistan' },
  { code: 'GR', name: 'Yunanistan' },
  { code: 'RU', name: 'Rusya' },
  { code: 'GLOBAL', name: 'Global' },
];
export const DEFAULT_NEWS_COUNTRY = 'TR';

/** İçerik dilleri (tinnten-nextjs i18n ile aynı) — paket i18n, doküman vb. için. */
export const CONTENT_LOCALES = [
  { code: 'tr', name: 'Türkçe' },
  { code: 'en', name: 'İngilizce' },
  { code: 'de', name: 'Almanca' },
  { code: 'fr', name: 'Fransızca' },
  { code: 'es', name: 'İspanyolca' },
  { code: 'it', name: 'İtalyanca' },
  { code: 'el', name: 'Yunanca' },
  { code: 'ru', name: 'Rusça' },
  { code: 'ar', name: 'Arapça' },
];

/**
 * Backend endpoint yolları — tek yerden yönetilir.
 * Servis dosyaları (redux/services/*) bu sabitleri kullanır.
 */
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    loginCms: '/auth/login/cms',
    validate: '/auth/validate',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  news: {
    list: '/news-content/list',
    detail: (id) => `/news-content/detail/${id}`,
    create: '/news-content',
    update: (id) => `/news-content/${id}`,
    remove: (id) => `/news-content/${id}`,
    publish: (id) => `/news-content/${id}/publish`,
    unpublish: (id) => `/news-content/${id}/unpublish`,
    generate: '/news-content/generate',
    jobs: '/news-content/generate/jobs',
    job: (id) => `/news-content/generate/jobs/${id}`,
    aiImage: (id) => `/news-content/${id}/ai-image`,
    images: (id) => `/news-content/${id}/images`,
    image: (id, imageId) => `/news-content/${id}/images/${imageId}`,
    cover: (id) => `/news-content/${id}/cover`,
    socialPosts: (id) => `/news-content/${id}/social-posts`,
    socialPost: (id, postId) => `/news-content/${id}/social-posts/${postId}`,
    socialPostRequeue: (id, postId) => `/news-content/${id}/social-posts/${postId}/requeue`,
  },
  newsCategories: {
    tree: (countryCode) => `/news-categories/${countryCode}/tree`,
    detail: (id) => `/news-categories/detail/${id}`,
    children: (id) => `/news-categories/children/${id}`,
    create: '/news-categories',
    update: (id) => `/news-categories/${id}`,
    remove: (id) => `/news-categories/${id}`,
  },
  assistants: {
    list: '/assistants',
    detail: (id) => `/assistants/${id}`,
    usage: '/assistants/usage',
    cmsList: '/asistans/cms',
    cmsDetail: (id) => `/asistans/cms/${id}`,
    cmsToolDefinitions: (id) => `/asistans/cms/${id}/tool-definitions`,
    cmsToolList: '/asistans/cms/tool-definitions',
    // CMS: firmasız asistan oluşturma + sonradan bir firmaya aktarma.
    cmsCreate: '/asistans/cms',
    cmsAssignCompany: (id) => `/asistans/cms/${id}/company`,
  },
  aiConversations: {
    // CMS admin: tüm kullanıcılar arası konuşmalar (genel + asistan).
    cmsList: '/conversation/cms',
    cmsDetail: (id) => `/conversation/cms/${id}`,
  },
  systemPackages: {
    list: '/system-packages',
    cmsList: '/system-packages/cms',
    cmsDetail: (id) => `/system-packages/cms/${id}`,
    cmsCreate: '/system-packages/cms',
    cmsUpdate: (id) => `/system-packages/cms/${id}`,
    cmsDelete: (id) => `/system-packages/cms/${id}`,
    assignToCompany: (id) => `/system-packages/cms/${id}/assign-to-company`,
    creditConfig: '/system-packages/cms/credit-config',
  },
  // MCP connector kataloğu — admin'in yayınladığı, kullanıcıya "Bağla" olarak
  // görünen şablonlar. Secret tutmaz (backend .env'de yaşar).
  connectorCatalog: {
    list: '/connector-catalog',
    cmsList: '/connector-catalog/cms',
    cmsDetail: (id) => `/connector-catalog/cms/${id}`,
    cmsCreate: '/connector-catalog/cms',
    cmsUpdate: (id) => `/connector-catalog/cms/${id}`,
    cmsDelete: (id) => `/connector-catalog/cms/${id}`,
  },
  connectorCategories: {
    list: '/connector-categories',
    cmsList: '/connector-categories/cms',
    cmsCreate: '/connector-categories/cms',
    cmsUpdate: (id) => `/connector-categories/cms/${id}`,
    cmsDelete: (id) => `/connector-categories/cms/${id}`,
  },
  // Salt-okunur: provider.config.js'te tanımlı VE env'de CLIENT_ID/SECRET'ı olan
  // provider'lar. Katalog formunun oauthProviderKey dropdown'ını doldurur.
  oauthProviders: {
    list: '/oauth/providers',
  },
  workflows: {
    cmsList: '/workflows/cms',
  },
  usage: {
    cmsSeries: '/llm-usage/cms/series',
  },
  docs: {
    meta: '/docs/cms/meta',
    categories: '/docs/cms/categories',
    category: (id) => `/docs/cms/categories/${id}`,
    list: '/docs/cms/list',
    save: '/docs/cms',
    detail: (slug) => `/docs/cms/${slug}`,
    translate: (slug) => `/docs/cms/${slug}/translate`,
  },
  dashboard: {
    stats: '/cms/dashboard/stats',
  },
  faq: {
    cmsList: '/faq/cms',
    create: '/faq/cms',
    update: (id) => `/faq/cms/${id}`,
    remove: (id) => `/faq/cms/${id}`,
  },
  companies: {
    list: '/company/cms/list',
    detail: (id) => `/company/cms/${id}`,
    limits: (id) => `/company/cms/${id}/limits`,
    usage: (id) => `/company/cms/${id}/usage`,
    usageReset: (id) => `/company/cms/${id}/usage/reset`,
    adminActive: (id) => `/company/cms/${id}/admin-active`,
    owner: (id) => `/company/cms/${id}/owner`,
    packages: (id) => `/company/cms/${id}/packages`,
    update: (id) => `/companies/${id}`,
    approve: (id) => `/companies/${id}/approve`,
    reject: (id) => `/companies/${id}/reject`,
  },
  products: {
    cmsList: '/products/cms/list',
    cmsDetail: (id) => `/products/cms/${id}`,
    cmsUpdate: (id) => `/products/cms/${id}`,
    cmsNotifyEdited: '/products/cms/notify-edited',
    // Alt-kaynaklar (zamanlama / rezervasyon / konum / formlar) — cms:admin
    cmsTimeRestriction: (id) => `/products/cms/${id}/time-restriction`,
    cmsReservationConfig: (id) => `/products/cms/${id}/reservation-config`,
    cmsLocation: (id) => `/products/cms/${id}/location`,
    cmsForms: (id) => `/products/cms/${id}/forms`,
    cmsFormGenerate: (id) => `/products/cms/${id}/form/generate`,
    cmsFormCreate: (id, slot) => `/products/cms/${id}/form/${slot}/create`,
    cmsFormAssociate: (id, slot) => `/products/cms/${id}/form/${slot}`,
    // Firma adına oluşturma — `companyid` GÖVDEDE gider (addProduct sözleşmesi).
    cmsCreate: '/products/cms/create',
    // Alt-kaynak yazma — üç-segmentli "/cms/product/:pid" şekli bilinçli:
    // iki-segmentli "/cms/:id", backend'deki "DELETE /:cid/:pid" tarafından
    // cid="cms" ile yutulurdu (bkz. productRouters.js yorumları).
    // Kalıcı silme — backend deleteProductCascade ile bağlı basePrice/gallery/
    // images'ı temizler ve firmanın kota sayacını iade eder.
    cmsDelete: (id) => `/products/cms/product/${id}`,
    cmsStatus: (id) => `/products/cms/product/${id}/status`,
    cmsBasePrice: (id) => `/products/cms/product/${id}/base-price`,
    cmsBasePriceItem: (id, prid) => `/products/cms/product/${id}/base-price/${prid}`,
    cmsGallery: (id) => `/products/cms/product/${id}/gallery`,
    cmsGalleryImage: (id, imageid) => `/products/cms/product/${id}/gallery/image/${imageid}`,
    cmsVariants: (id) => `/products/cms/product/${id}/variants`,
  },
  /**
   * Ürün kategorileri & kategori attribute'ları.
   *
   * CMS admini için ek backend işi GEREKMEZ: /categories/general* uçları tamamen
   * public, company uçları yalnız `ensureAuth` (üyelik kapısı yok).
   * DİKKAT: bunlar ürün kategorileri — news-categories ve connector-categories
   * ayrı kaynaklar.
   */
  categories: {
    general: '/categories/general',
    generalSearch: '/categories/general/search',
    generalSubcategories: (parentId) => `/categories/general/${parentId}/subcategories`,
    generalDetail: (idOrSlug) => `/categories/general/${idOrSlug}`,
    companyList: (companyid) => `/categories/company/${companyid}`,
    companyCategoryAttributes: (companyid, categoryId) =>
      `/categories/attributes/company/${companyid}/category/${categoryId}`,
  },
  users: {
    list: '/users',
    detail: (id) => `/users/${id}`,
    account: (id) => `/users/${id}/account`,
    accountLimits: (id) => `/users/${id}/account/limits`,
    accountUsage: (id) => `/users/${id}/account/usage`,
    accountUsageReset: (id) => `/users/${id}/account/usage/reset`,
    conversations: (id) => `/users/${id}/conversations`,
    update: (id) => `/users/${id}`,
    resetPassword: (id) => `/users/${id}/reset-password`,
    sessions: (id) => `/users/${id}/sessions`,
    sessionsAll: '/users/sessions',
  },
  email: {
    // Eski mock uçlar (kullanılmıyor ama referansta kalsın)
    lists: '/email/lists',
    history: '/email/history',
    send: '/email/send',
    // Tek seferlik (ad-hoc) mail gönderimi + önizleme + dosya eki upload'ı
    sendDirect: '/email/send-direct',
    previewDirect: '/email/preview-direct',
    attachmentUpload: '/email/attachments/upload',
    // Kanallar (dinamik liste)
    channels: '/email/channels',
    channel: (id) => `/email/channels/${id}`,
    channelMembers: (key) => `/email/channels/${key}/members`,
    // DB kampanya şablonları (dosya .flt editöründen AYRI)
    templates: '/email/templates',
    template: (id) => `/email/templates/${id}`,
    templatePreview: (id) => `/email/templates/${id}/preview`,
    templateTestSend: (id) => `/email/templates/${id}/test-send`,
    // Kampanyalar
    campaigns: '/email/campaigns',
    campaign: (id) => `/email/campaigns/${id}`,
    campaignSend: (id) => `/email/campaigns/${id}/send`,
    campaignStats: (id) => `/email/campaigns/${id}/stats`,
    // Yardımcı
    mergeVariables: '/email/merge-variables',
    // Merge değişken katalogu (admin)
    mergeSources: '/email/merge-variables/sources',
    mergeDefs: '/email/merge-variables/defs',
    mergeDef: (id) => `/email/merge-variables/defs/${id}`,
    recipientCount: '/email/recipient-count',
    // Cron listeleri (DB sorgusu → cron-kanalı mail-list besleyen reçeteler)
    cronLists: '/email/cron-lists',
    cronList: (id) => `/email/cron-lists/${id}`,
    cronListRun: (id) => `/email/cron-lists/${id}/run-now`,
    cronListPreview: '/email/cron-lists/preview',
    cronListSchema: '/email/cron-lists/schema',
  },
  emailTemplates: {
    cmsList: '/email-templates/cms',
    cmsDetail: (name) => `/email-templates/cms/${name}`,
    cmsCreate: '/email-templates/cms',
  },
  mailLog: {
    cmsList: '/maillog/cms',
    cmsDetail: (id) => `/maillog/cms/${id}`,
  },
  mailList: {
    cmsList: '/mail-list/cms',
    cmsStats: '/mail-list/cms/stats',
    cmsDetail: '/mail-list/cms/detail',
  },
  files: {
    cmsStats: '/files/cms/stats',
    cmsList: '/files/cms/list',
  },
  monitoring: {
    cmsHost: '/monitoring/cms/host',
    cmsContainers: '/monitoring/cms/containers',
    cmsTargets: '/monitoring/cms/targets',
    cmsAlerts: '/monitoring/cms/alerts',
    cmsQueryRange: '/monitoring/cms/query_range',
  },
  errorMonitoring: {
    cmsStats: '/error-monitoring/cms/stats',
    cmsIssues: '/error-monitoring/cms/issues',
    cmsIssueDetail: (fp) => `/error-monitoring/cms/issues/${fp}`,
    cmsResolve: (fp) => `/error-monitoring/cms/issues/${fp}`,
  },
  mq: {
    cmsOverview: '/mq/cms/overview',
    cmsQueues: '/mq/cms/queues',
    cmsConsumers: '/mq/cms/consumers',
    cmsConnections: '/mq/cms/connections',
  },
  cron: {
    cmsHealth: '/cron/cms/health',
    cmsStats: '/cron/cms/stats',
    cmsLogs: '/cron/cms/logs',
    cmsJobs: '/cron/cms/jobs',
    cmsJob: (id) => `/cron/cms/jobs/${id}`,
    cmsJobLogs: (id) => `/cron/cms/jobs/${id}/logs`,
    cmsJobRun: (id) => `/cron/cms/jobs/${id}/run-now`,
  },
  embedding: {
    cmsHealth: '/embedding/cms/health',
    cmsStats: '/embedding/cms/stats',
    cmsDocuments: '/embedding/cms/documents',
    cmsDocument: (id) => `/embedding/cms/documents/${id}`,
    cmsReindex: (id) => `/embedding/cms/documents/${id}/reindex`,
    cmsSearch: '/embedding/cms/search',
    // Firma bazlı indeks görünümü. index-stats ve config, tinnten-server üzerinden
    // tinnten-embedding'e proxy'lenir (CMS embedding servisine doğrudan erişemez).
    cmsCompanies: '/embedding/cms/companies',
    cmsCompanyIndexStats: (id) => `/embedding/cms/companies/${encodeURIComponent(id)}/index-stats`,
    cmsConfig: '/embedding/cms/config',
  },
  fetcher: {
    status: '/fetcher/scraping/status',
    stopAll: '/fetcher/scraping/stop',
    domains: '/fetcher/domains',
    domain: (d) => `/fetcher/domains/${encodeURIComponent(d)}`,
    domainStats: (d) => `/fetcher/domains/${encodeURIComponent(d)}/stats`,
    domainUrls: (d) => `/fetcher/domains/${encodeURIComponent(d)}/urls`,
    domainUrl: (d, id) => `/fetcher/domains/${encodeURIComponent(d)}/urls/${encodeURIComponent(id)}`,
    domainUrlContent: (d, id) => `/fetcher/domains/${encodeURIComponent(d)}/urls/${encodeURIComponent(id)}/content`,
    domainVerification: (d) => `/fetcher/domains/${encodeURIComponent(d)}/verification`,
    scrapingStart: (d) => `/fetcher/domains/${encodeURIComponent(d)}/scraping/start`,
    scrapingStop: (d) => `/fetcher/domains/${encodeURIComponent(d)}/scraping/stop`,
    scrapingRestart: (d) => `/fetcher/domains/${encodeURIComponent(d)}/scraping/restart`,
    urls: '/fetcher/urls',
    logs: '/fetcher/logs',
    nodes: '/fetcher/scraper-nodes',
    node: (id) => `/fetcher/scraper-nodes/${encodeURIComponent(id)}`,
    nodeAction: (id, action) => `/fetcher/scraper-nodes/${encodeURIComponent(id)}/${action}`,
    // Abonelikler (admin: izle + yönet)
    subscriptions: '/fetcher/subscriptions',
    subscription: (id) => `/fetcher/subscriptions/${encodeURIComponent(id)}`,
    subscriptionReindex: (id) => `/fetcher/subscriptions/${encodeURIComponent(id)}/reindex`,
    // Domain başına abone dökümü (abonelik koleksiyonu boşsa legacy
    // informationOwners üzerinden aynı şekli döner — satırdaki `source` söyler).
    subscriptionStats: '/fetcher/subscriptions/stats/by-domain',
    // Canlı hız kontrolü (scheduler tuning; Redis override + env varsayılanları)
    schedulerTuning: '/fetcher/scheduler/tuning',
    // Raporlar & sağlık
    restrictedDomains: '/fetcher/reports/restricted-domains',
    rabbitmqHealth: '/fetcher/health/rabbitmq',
    // Scraping config + reset
    scrapingConfig: (d) => `/fetcher/domains/${encodeURIComponent(d)}/scraping-config`,
    scrapingReset: (d) => `/fetcher/domains/${encodeURIComponent(d)}/scraping/reset`,
    // Etkileşimli onboarding sihirbazı (admin, kullanıcı-bağımsız)
    domainAnalysis: (d) => `/fetcher/domains/${encodeURIComponent(d)}/analysis`,
    domainAnalysisStart: (d) => `/fetcher/domains/${encodeURIComponent(d)}/analysis/start`,
    domainSchemasGenerate: (d) => `/fetcher/domains/${encodeURIComponent(d)}/schemas/generate`,
    domainSchemasTest: (d) => `/fetcher/domains/${encodeURIComponent(d)}/schemas/test`,
    domainSchemasCommit: (d) => `/fetcher/domains/${encodeURIComponent(d)}/schemas/commit`,
  },
  inbox: {
    cmsList: '/inbox/cms',
    cmsDetail: '/inbox/cms/detail',
    cmsRead: '/inbox/cms/read',
  },
  contracts: {
    list: (type) => `/contracts/${type}`,
    version: (type, id) => `/contracts/${type}/${id}`,
    create: (type) => `/contracts/${type}`,
  },
  legal: {
    cmsList: '/legal/cms/agreements',
    cmsDetail: (slug) => `/legal/cms/agreements/${slug}`,
    cmsSave: '/legal/cms/agreements',
    cmsPublish: (id) => `/legal/cms/agreements/${id}/publish`,
    cmsAcceptances: (slug) => `/legal/cms/agreements/${slug}/acceptances`,
  },
  upload: {
    image: '/upload/multiple/image',
  },
  // Destek masası. Backend `requireAnyPermission("cms:support", "cms:admin")`
  // ile korur — `requirePermission` DEĞİL, çünkü o ALL-OF semantiğinde ve admin
  // bypass'ı yok; CMS `cms:admin`'i süper rol saydığı için admin menüyü görüp
  // API'den 403 yerdi.
  support: {
    cmsTickets: '/support/cms/tickets',
    cmsTicketDetail: (id) => `/support/cms/tickets/${id}`,
    cmsTicketReply: (id) => `/support/cms/tickets/${id}/reply`,
    cmsTicketStatus: (id) => `/support/cms/tickets/${id}/status`,
    cmsTicketAssign: (id) => `/support/cms/tickets/${id}/assign`,
    cmsCallbacks: '/support/cms/callbacks',
    cmsCallbackConfirm: (id) => `/support/cms/callbacks/${id}/confirm`,
    cmsCallbackOutcome: (id) => `/support/cms/callbacks/${id}/outcome`,
  },
  // Partner Programı ön başvuruları. Backend
  // `requireAnyPermission("cms:editor", "cms:admin")` ile korur — ALL-OF olan
  // `requirePermission` DEĞİL, yoksa admin menüyü görür ama API'den 403 alır.
  partner: {
    cmsApplications: '/partner/cms/applications',
    cmsApplicationStatus: (id) => `/partner/cms/applications/${id}/status`,
  },
};
