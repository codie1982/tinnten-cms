'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * Embedding servisi (tinnten-embedding) CMS köprüsü → tinnten-server /embedding/cms.
 * Global (tüm şirketler) doküman/indeks görünümü, sağlık, istatistik ve semantik arama.
 */
export const embeddingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getEmbeddingHealth: build.query({
      query: () => ENDPOINTS.embedding.cmsHealth,
      transformResponse: (res) => res?.data ?? res, // { ok, index_size, chunk_index_size, chunk_model_name, ... }
      providesTags: [{ type: 'EmbeddingStatus', id: 'HEALTH' }],
    }),
    getEmbeddingStats: build.query({
      query: () => ENDPOINTS.embedding.cmsStats,
      transformResponse: (res) => res?.data ?? res, // { total, chunks, tokens, byState, bySource }
      providesTags: [{ type: 'EmbeddingStatus', id: 'STATS' }],
    }),
    getEmbeddingDocuments: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.embedding.cmsDocuments, params }), // { q, state, source, companyid, limit, skip }
      transformResponse: (res) => res?.data ?? res, // { items, total, limit, skip }
      providesTags: [{ type: 'EmbeddingDoc', id: 'LIST' }],
    }),
    getEmbeddingDocument: build.query({
      query: (id) => ENDPOINTS.embedding.cmsDocument(id),
      transformResponse: (res) => res?.data ?? res, // { item, logs }
      providesTags: (r, e, id) => [{ type: 'EmbeddingDoc', id }],
    }),
    getEmbeddingCompanies: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.embedding.cmsCompanies, params }), // { q, sort, order, limit, skip }
      transformResponse: (res) => res?.data ?? res, // { items, total, limit, skip }
      providesTags: (r) => (r?.items
        ? [
            ...r.items.map((c) => ({ type: 'EmbeddingCompany', id: c.companyId ?? 'NONE' })),
            { type: 'EmbeddingCompany', id: 'LIST' },
          ]
        : [{ type: 'EmbeddingCompany', id: 'LIST' }]),
    }),
    getEmbeddingCompanyIndexStats: build.query({
      query: (id) => ENDPOINTS.embedding.cmsCompanyIndexStats(id),
      transformResponse: (res) => res?.data ?? res, // { ntotal, indexBytes, mongoChunks, drift, ... }
      providesTags: (r, e, id) => [{ type: 'EmbeddingCompany', id: `STATS-${id}` }],
      keepUnusedDataFor: 120,
    }),
    getEmbeddingConfig: build.query({
      query: () => ENDPOINTS.embedding.cmsConfig,
      transformResponse: (res) => res?.data ?? res, // { per_company_faiss_enabled, hybrid_search_enabled, ... }
      providesTags: [{ type: 'EmbeddingStatus', id: 'CONFIG' }],
    }),
    reindexEmbeddingDocument: build.mutation({
      query: ({ id }) => ({ url: ENDPOINTS.embedding.cmsReindex(id), method: 'POST' }),
      // `STATS-${companyId}` BİLEREK invalidate EDİLMİYOR: reindex sırasında FAISS
      // önce yeni vektörleri ekleyip sonra eskileri düşürdüğü için ntotal geçici
      // olarak şişer; hemen refetch sahte bir drift uyarısı üretir.
      invalidatesTags: (r, e, { id, companyId }) => [
        { type: 'EmbeddingDoc', id },
        { type: 'EmbeddingDoc', id: 'LIST' },
        { type: 'EmbeddingStatus', id: 'STATS' },
        ...(companyId
          ? [{ type: 'EmbeddingCompany', id: companyId }, { type: 'EmbeddingCompany', id: 'LIST' }]
          : []),
      ],
    }),
    embeddingSearch: build.mutation({
      query: (body) => ({ url: ENDPOINTS.embedding.cmsSearch, method: 'POST', body }), // { query, companyId?, k? }
      transformResponse: (res) => res?.data ?? res, // { ok, reason, results }
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEmbeddingHealthQuery,
  useGetEmbeddingStatsQuery,
  useGetEmbeddingDocumentsQuery,
  useGetEmbeddingDocumentQuery,
  useGetEmbeddingCompaniesQuery,
  useGetEmbeddingCompanyIndexStatsQuery,
  useGetEmbeddingConfigQuery,
  useReindexEmbeddingDocumentMutation,
  useEmbeddingSearchMutation,
} = embeddingApi;
