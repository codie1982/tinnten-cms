'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * Yapay Zeka — Konuşmalar (CMS admin).
 * Tüm kullanıcılar arası konuşmaları listeler ve bir konuşmanın mesaj akışını getirir.
 * Backend uçları `cms:admin` rolü ister (tinnten-server: /conversation/cms*).
 */
export const aiConversationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // GET /conversation/cms?type=&q=&page=&limit=
    getCmsConversations: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.aiConversations.cmsList, params }),
      transformResponse: (res) => res?.data ?? res, // { items, total, page, limit, totalPages }
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((c) => ({
                type: 'Conversation',
                id: c.conversationid ?? c.id,
              })),
              { type: 'Conversation', id: 'LIST' },
            ]
          : [{ type: 'Conversation', id: 'LIST' }],
    }),

    // GET /conversation/cms/:id?page=&limit=
    getCmsConversationDetail: build.query({
      query: ({ id, ...params }) => ({
        url: ENDPOINTS.aiConversations.cmsDetail(id),
        params,
      }),
      transformResponse: (res) => res?.data ?? res, // { conversation, messages, total, page, limit }
      providesTags: (r, e, { id }) => [{ type: 'Conversation', id }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCmsConversationsQuery,
  useGetCmsConversationDetailQuery,
} = aiConversationsApi;
