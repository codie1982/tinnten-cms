'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/** Haber kategorileri API servisi. */
export const newsCategoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCategoryTree: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.newsCategories.tree, params }), // { country }
      transformResponse: (res) => res?.data ?? res,
      providesTags: [{ type: 'NewsCategory', id: 'TREE' }],
    }),
    getCategory: build.query({
      query: (id) => ENDPOINTS.newsCategories.detail(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'NewsCategory', id }],
    }),
    getCategoryChildren: build.query({
      query: (id) => ENDPOINTS.newsCategories.children(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'NewsCategory', id: `children-${id}` }],
    }),
    createCategory: build.mutation({
      query: (body) => ({ url: ENDPOINTS.newsCategories.create, method: 'POST', body }),
      invalidatesTags: [{ type: 'NewsCategory', id: 'TREE' }],
    }),
    updateCategory: build.mutation({
      query: ({ id, ...body }) => ({
        url: ENDPOINTS.newsCategories.update(id),
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (r, e, { id }) => [{ type: 'NewsCategory', id }, { type: 'NewsCategory', id: 'TREE' }],
    }),
    deleteCategory: build.mutation({
      query: (id) => ({ url: ENDPOINTS.newsCategories.remove(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'NewsCategory', id: 'TREE' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCategoryTreeQuery,
  useGetCategoryQuery,
  useGetCategoryChildrenQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} = newsCategoryApi;
