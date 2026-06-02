'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/** SSS (FAQ) CMS servisi — dil varyasyonlu (contents[]) liste + CRUD. */
export const faqApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCmsFaqs: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.faq.cmsList, params }), // { category, channel, status }
      transformResponse: (res) => (res?.data ?? res)?.items ?? [],
      providesTags: (result) =>
        Array.isArray(result)
          ? [...result.map((f) => ({ type: 'Faq', id: f.id })), { type: 'Faq', id: 'LIST' }]
          : [{ type: 'Faq', id: 'LIST' }],
    }),
    createFaq: build.mutation({
      query: (body) => ({ url: ENDPOINTS.faq.create, method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: [{ type: 'Faq', id: 'LIST' }],
    }),
    updateFaq: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.faq.update(id), method: 'PATCH', body }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, { id }) => [{ type: 'Faq', id }, { type: 'Faq', id: 'LIST' }],
    }),
    deleteFaq: build.mutation({
      query: (id) => ({ url: ENDPOINTS.faq.remove(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'Faq', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCmsFaqsQuery,
  useCreateFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
} = faqApi;
