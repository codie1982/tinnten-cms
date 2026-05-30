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
    reindexEmbeddingDocument: build.mutation({
      query: (id) => ({ url: ENDPOINTS.embedding.cmsReindex(id), method: 'POST' }),
      invalidatesTags: (r, e, id) => [{ type: 'EmbeddingDoc', id }, { type: 'EmbeddingDoc', id: 'LIST' }, { type: 'EmbeddingStatus', id: 'STATS' }],
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
  useReindexEmbeddingDocumentMutation,
  useEmbeddingSearchMutation,
} = embeddingApi;
