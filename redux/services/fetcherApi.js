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
      query: (params = {}) => ({ url: ENDPOINTS.fetcher.domains, params }), // { status, page, limit }
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
} = fetcherApi;
