'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/** Dökümanlar (docs) CMS servisi — kategoriler, dökümanlar, çok-dil + çeviri. */
export const docsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDocsMeta: build.query({
      query: () => ENDPOINTS.docs.meta,
      transformResponse: (res) => res?.data ?? res,
    }),

    // ── Kategoriler ──
    getDocCategories: build.query({
      query: () => ENDPOINTS.docs.categories,
      transformResponse: (res) => (res?.data ?? res)?.items ?? [],
      providesTags: [{ type: 'DocCategory', id: 'LIST' }],
    }),
    createDocCategory: build.mutation({
      query: (body) => ({ url: ENDPOINTS.docs.categories, method: 'POST', body }),
      invalidatesTags: [{ type: 'DocCategory', id: 'LIST' }],
    }),
    updateDocCategory: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.docs.category(id), method: 'PUT', body }),
      invalidatesTags: [{ type: 'DocCategory', id: 'LIST' }],
    }),
    deleteDocCategory: build.mutation({
      query: (id) => ({ url: ENDPOINTS.docs.category(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'DocCategory', id: 'LIST' }, { type: 'Doc', id: 'LIST' }],
    }),

    // ── Dökümanlar ──
    getDocsList: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.docs.list, params }), // { category, locale, query, page, limit }
      transformResponse: (res) => res?.data ?? res,
      providesTags: [{ type: 'Doc', id: 'LIST' }],
    }),
    getDoc: build.query({
      query: ({ slug, locale }) => ({ url: ENDPOINTS.docs.detail(slug), params: { locale } }),
      transformResponse: (res) => res?.data ?? res, // { doc, locale, locales }
      providesTags: (r, e, { slug }) => [{ type: 'Doc', id: slug }],
    }),
    saveDoc: build.mutation({
      query: (body) => ({ url: ENDPOINTS.docs.save, method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, body) => [{ type: 'Doc', id: body.slug }, { type: 'Doc', id: 'LIST' }],
    }),
    deleteDoc: build.mutation({
      query: ({ slug, locale }) => ({ url: ENDPOINTS.docs.detail(slug), method: 'DELETE', params: locale ? { locale } : undefined }),
      invalidatesTags: (r, e, { slug }) => [{ type: 'Doc', id: slug }, { type: 'Doc', id: 'LIST' }],
    }),
    translateDoc: build.mutation({
      query: ({ slug, ...body }) => ({ url: ENDPOINTS.docs.translate(slug), method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res, // { translated, failed }
      invalidatesTags: (r, e, { slug }) => [{ type: 'Doc', id: slug }, { type: 'Doc', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDocsMetaQuery,
  useGetDocCategoriesQuery,
  useCreateDocCategoryMutation,
  useUpdateDocCategoryMutation,
  useDeleteDocCategoryMutation,
  useGetDocsListQuery,
  useGetDocQuery,
  useSaveDocMutation,
  useDeleteDocMutation,
  useTranslateDocMutation,
} = docsApi;
