'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * Fetcher servisi (tinnten-fetcher) köprüsü → tinnten-server /fetcher.
 * Tüm uçlar ApiResponse.success ile sarılı döner; transformResponse ile data açılır.
 */
export const fetcherApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /* ── Sistem durumu ── */
    getFetcherStatus: build.query({
      query: () => ENDPOINTS.fetcher.status,
      transformResponse: (res) => res?.data ?? res, // { active_nodes, total_nodes, inflight_urls, scheduling_paused, message }
      providesTags: [{ type: 'FetcherStatus', id: 'STATUS' }],
    }),
    stopAllScraping: build.mutation({
      query: () => ({ url: ENDPOINTS.fetcher.stopAll, method: 'POST' }),
      invalidatesTags: [{ type: 'FetcherStatus', id: 'STATUS' }, { type: 'FetcherDomain', id: 'LIST' }],
    }),

    /* ── Domainler ── */
    getFetcherDomains: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.fetcher.domains, params }), // { status, page, limit, sort, order }
      transformResponse: (res) => res?.data ?? res, // { domains, total, page, limit }
      providesTags: [{ type: 'FetcherDomain', id: 'LIST' }],
    }),
    getFetcherDomain: build.query({
      query: (domain) => ENDPOINTS.fetcher.domain(domain),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, domain) => [{ type: 'FetcherDomain', id: domain }],
    }),
    getFetcherDomainStats: build.query({
      query: (domain) => ENDPOINTS.fetcher.domainStats(domain),
      transformResponse: (res) => res?.data ?? res, // { domain, stats: {READY, DONE, ...} }
      providesTags: (r, e, domain) => [{ type: 'FetcherDomain', id: `${domain}:stats` }],
    }),
    getFetcherDomainUrls: build.query({
      query: ({ domain, ...params }) => ({ url: ENDPOINTS.fetcher.domainUrls(domain), params }), // { status, page, limit }
      transformResponse: (res) => res?.data ?? res, // { domain, urls, total, page, limit }
      providesTags: (r, e, arg) => [{ type: 'FetcherUrl', id: arg?.domain }],
    }),

    /* ── Scraping kontrolü (domain bazında) ── */
    startDomainScraping: build.mutation({
      query: (domain) => ({ url: ENDPOINTS.fetcher.scrapingStart(domain), method: 'POST' }),
      invalidatesTags: (r, e, domain) => [{ type: 'FetcherDomain', id: domain }, { type: 'FetcherDomain', id: 'LIST' }, { type: 'FetcherStatus', id: 'STATUS' }],
    }),
    stopDomainScraping: build.mutation({
      query: (domain) => ({ url: ENDPOINTS.fetcher.scrapingStop(domain), method: 'POST' }),
      invalidatesTags: (r, e, domain) => [{ type: 'FetcherDomain', id: domain }, { type: 'FetcherDomain', id: 'LIST' }, { type: 'FetcherStatus', id: 'STATUS' }],
    }),
    restartDomainScraping: build.mutation({
      query: (domain) => ({ url: ENDPOINTS.fetcher.scrapingRestart(domain), method: 'POST' }),
      invalidatesTags: (r, e, domain) => [{ type: 'FetcherDomain', id: domain }, { type: 'FetcherDomain', id: 'LIST' }, { type: 'FetcherStatus', id: 'STATUS' }],
    }),

    /* ── Global URL'ler ── */
    getFetcherUrls: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.fetcher.urls, params }), // { domain, status, page, limit }
      transformResponse: (res) => res?.data ?? res, // { urls, total, page, limit }
      providesTags: [{ type: 'FetcherUrl', id: 'LIST' }],
    }),

    /* ── Crawl logları ── */
    getFetcherLogs: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.fetcher.logs, params }), // { domain, url, page, limit }
      transformResponse: (res) => res?.data ?? res, // { logs, total, page, limit }
      providesTags: [{ type: 'FetcherLog', id: 'LIST' }],
    }),

    /* ── Scraper node'ları ── */
    getFetcherNodes: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.fetcher.nodes, params }), // { include_disabled, include_offline, all }
      transformResponse: (res) => res?.data ?? res, // { nodes: [...] }
      providesTags: [{ type: 'FetcherNode', id: 'LIST' }],
    }),
    createFetcherNode: build.mutation({
      query: (body) => ({ url: ENDPOINTS.fetcher.nodes, method: 'POST', body }), // { node_url, node_id?, enabled?, ip_pool? }
      invalidatesTags: [{ type: 'FetcherNode', id: 'LIST' }],
    }),
    updateFetcherNode: build.mutation({
      query: ({ nodeId, ...body }) => ({ url: ENDPOINTS.fetcher.node(nodeId), method: 'PATCH', body }),
      invalidatesTags: [{ type: 'FetcherNode', id: 'LIST' }],
    }),
    deleteFetcherNode: build.mutation({
      query: (nodeId) => ({ url: ENDPOINTS.fetcher.node(nodeId), method: 'DELETE' }),
      invalidatesTags: [{ type: 'FetcherNode', id: 'LIST' }, { type: 'FetcherStatus', id: 'STATUS' }],
    }),
    nodeAction: build.mutation({
      query: ({ nodeId, action }) => ({ url: ENDPOINTS.fetcher.nodeAction(nodeId, action), method: 'POST' }), // action: start|stop|restart
      invalidatesTags: [{ type: 'FetcherNode', id: 'LIST' }, { type: 'FetcherStatus', id: 'STATUS' }],
    }),

    /* ── Abonelikler (admin: izle + yönet) ── */
    getFetcherSubscriptions: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.fetcher.subscriptions, params }), // { companyId?, domain?, includeRemoved? } hepsi opsiyonel
      transformResponse: (res) => res?.data ?? res, // { subscriptions, total }
      providesTags: [{ type: 'FetcherSubscription', id: 'LIST' }],
    }),
    getFetcherSubscription: build.query({
      query: (id) => ENDPOINTS.fetcher.subscription(id),
      transformResponse: (res) => res?.data ?? res, // { subscription }
      providesTags: (r, e, id) => [{ type: 'FetcherSubscription', id }],
    }),
    updateFetcherSubscription: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.fetcher.subscription(id), method: 'PATCH', body }), // { state?: 'paused'|'live', contract? }
      invalidatesTags: (r, e, { id }) => [{ type: 'FetcherSubscription', id }, { type: 'FetcherSubscription', id: 'LIST' }],
    }),
    reindexFetcherSubscription: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.fetcher.subscriptionReindex(id), method: 'POST', body }), // { chunk?, clean? }
      invalidatesTags: (r, e, { id }) => [{ type: 'FetcherSubscription', id }, { type: 'FetcherSubscription', id: 'LIST' }],
    }),
    deleteFetcherSubscription: build.mutation({
      query: ({ id, mode }) => ({ url: ENDPOINTS.fetcher.subscription(id), method: 'DELETE', params: mode ? { mode } : undefined }), // mode: deactivate|hard
      invalidatesTags: (r, e, { id }) => [{ type: 'FetcherSubscription', id }, { type: 'FetcherSubscription', id: 'LIST' }],
    }),

    /* ── Raporlar & sağlık ── */
    getRestrictedDomains: build.query({
      query: () => ENDPOINTS.fetcher.restrictedDomains,
      transformResponse: (res) => res?.data ?? res, // { domains: [{ domain, robots, updatedAt }] }
      providesTags: [{ type: 'FetcherReport', id: 'RESTRICTED' }],
    }),
    getRabbitmqHealth: build.query({
      // NOT: bilinçli olarak pollingInterval YOK — polling anti-pattern; manuel yenile.
      query: () => ENDPOINTS.fetcher.rabbitmqHealth,
      transformResponse: (res) => res?.data ?? res, // { status, connected, queues }
      providesTags: [{ type: 'FetcherHealth', id: 'RABBITMQ' }],
    }),

    /* ── Domain yaşam döngüsü (admin) ── */
    addFetcherDomain: build.mutation({
      query: (body) => ({ url: ENDPOINTS.fetcher.domains, method: 'POST', body }), // { domain, companyId?, site_type?, autoStartScraping?, sitemap? }
      invalidatesTags: [{ type: 'FetcherDomain', id: 'LIST' }],
    }),
    updateFetcherDomain: build.mutation({
      query: ({ domain, ...body }) => ({ url: ENDPOINTS.fetcher.domain(domain), method: 'PATCH', body }), // { companyId?, site_type?, seedWeight?, autoStartScraping? }
      invalidatesTags: (r, e, { domain }) => [{ type: 'FetcherDomain', id: domain }, { type: 'FetcherDomain', id: 'LIST' }],
    }),
    deleteFetcherDomain: build.mutation({
      query: (domain) => ({ url: ENDPOINTS.fetcher.domain(domain), method: 'DELETE' }), // KALICI + kademeli (ürün purge) — UI güçlü onay ile çağırır
      invalidatesTags: (r, e, domain) => [{ type: 'FetcherDomain', id: domain }, { type: 'FetcherDomain', id: 'LIST' }],
    }),
    verifyFetcherDomain: build.mutation({
      query: ({ domain, ...body }) => ({ url: ENDPOINTS.fetcher.domainVerification(domain), method: 'PATCH', body }), // { isVerified, verifiedBy?, note? }
      invalidatesTags: (r, e, { domain }) => [{ type: 'FetcherDomain', id: domain }, { type: 'FetcherDomain', id: 'LIST' }],
    }),

    /* ── Domain URL CRUD + içerik (admin) ── */
    createFetcherDomainUrl: build.mutation({
      query: ({ domain, ...body }) => ({ url: ENDPOINTS.fetcher.domainUrls(domain), method: 'POST', body }), // { url, status?, priority?, depth?, schema_label? }
      invalidatesTags: (r, e, { domain }) => [{ type: 'FetcherUrl', id: domain }, { type: 'FetcherUrl', id: 'LIST' }, { type: 'FetcherDomain', id: `${domain}:stats` }],
    }),
    updateFetcherDomainUrl: build.mutation({
      query: ({ domain, urlId, ...body }) => ({ url: ENDPOINTS.fetcher.domainUrl(domain, urlId), method: 'PATCH', body }), // { status?, priority?, depth? } — url immutable
      invalidatesTags: (r, e, { domain }) => [{ type: 'FetcherUrl', id: domain }, { type: 'FetcherUrl', id: 'LIST' }, { type: 'FetcherDomain', id: `${domain}:stats` }],
    }),
    deleteFetcherDomainUrl: build.mutation({
      query: ({ domain, urlId }) => ({ url: ENDPOINTS.fetcher.domainUrl(domain, urlId), method: 'DELETE' }),
      invalidatesTags: (r, e, { domain }) => [{ type: 'FetcherUrl', id: domain }, { type: 'FetcherUrl', id: 'LIST' }, { type: 'FetcherDomain', id: `${domain}:stats` }],
    }),
    getFetcherUrlContent: build.query({
      query: ({ domain, urlId }) => ENDPOINTS.fetcher.domainUrlContent(domain, urlId),
      transformResponse: (res) => res?.data ?? res, // { title, markdown, clean_markdown, has_content, ... }
    }),

    /* ── Scraping config + reset (admin) ── */
    getScrapingConfig: build.query({
      query: (domain) => ENDPOINTS.fetcher.scrapingConfig(domain),
      transformResponse: (res) => res?.data ?? res, // { domain, scraping_config } — 404 = config yok
      providesTags: (r, e, domain) => [{ type: 'FetcherConfig', id: domain }],
    }),
    saveScrapingConfig: build.mutation({
      // NOT: fetcher config'i TAM değiştirir (replace) — panel tüm objeyi gönderir.
      query: ({ domain, ...body }) => ({ url: ENDPOINTS.fetcher.scrapingConfig(domain), method: 'POST', body }), // { strategy, url_schemas, ... }
      invalidatesTags: (r, e, { domain }) => [{ type: 'FetcherConfig', id: domain }, { type: 'FetcherDomain', id: domain }],
    }),
    deleteScrapingConfig: build.mutation({
      query: (domain) => ({ url: ENDPOINTS.fetcher.scrapingConfig(domain), method: 'DELETE' }),
      invalidatesTags: (r, e, domain) => [{ type: 'FetcherConfig', id: domain }, { type: 'FetcherDomain', id: domain }],
    }),
    resetDomainScraping: build.mutation({
      // HARD reset — purge_s3 HER ZAMAN açıkça gönderilir (fetcher varsayılanı true).
      query: ({ domain, ...body }) => ({ url: ENDPOINTS.fetcher.scrapingReset(domain), method: 'POST', body }), // { sitemap?, purge_s3 }
      invalidatesTags: (r, e, { domain }) => [{ type: 'FetcherDomain', id: domain }, { type: 'FetcherDomain', id: `${domain}:stats` }, { type: 'FetcherUrl', id: domain }, { type: 'FetcherConfig', id: domain }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetFetcherStatusQuery,
  useStopAllScrapingMutation,
  useGetFetcherDomainsQuery,
  useGetFetcherDomainQuery,
  useGetFetcherDomainStatsQuery,
  useGetFetcherDomainUrlsQuery,
  useStartDomainScrapingMutation,
  useStopDomainScrapingMutation,
  useRestartDomainScrapingMutation,
  useGetFetcherUrlsQuery,
  useGetFetcherLogsQuery,
  useGetFetcherNodesQuery,
  useCreateFetcherNodeMutation,
  useUpdateFetcherNodeMutation,
  useDeleteFetcherNodeMutation,
  useNodeActionMutation,
  useGetFetcherSubscriptionsQuery,
  useGetFetcherSubscriptionQuery,
  useUpdateFetcherSubscriptionMutation,
  useReindexFetcherSubscriptionMutation,
  useDeleteFetcherSubscriptionMutation,
  useGetRestrictedDomainsQuery,
  useGetRabbitmqHealthQuery,
  useAddFetcherDomainMutation,
  useUpdateFetcherDomainMutation,
  useDeleteFetcherDomainMutation,
  useVerifyFetcherDomainMutation,
  useCreateFetcherDomainUrlMutation,
  useUpdateFetcherDomainUrlMutation,
  useDeleteFetcherDomainUrlMutation,
  useGetFetcherUrlContentQuery,
  useGetScrapingConfigQuery,
  useSaveScrapingConfigMutation,
  useDeleteScrapingConfigMutation,
  useResetDomainScrapingMutation,
} = fetcherApi;
