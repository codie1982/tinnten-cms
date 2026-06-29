'use client';

import { ENDPOINTS } from '@/config/api';
import { baseApi } from './baseApi';

/**
 * Ürünler & Hizmetler (CMS).
 *
 * Tek `products` koleksiyonu hem ürünü hem hizmeti tutar (`type` ayırır).
 * - getCmsProducts: firmalar-arası genel liste (companyid verilmezse) veya
 *   tek firmaya daraltılmış liste (companyid ile). Sayfalı/filtreli/sıralı.
 * - getCmsProduct: tek ürün detayı (galeri, fiyat, firma populate'li).
 */
export const productsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCmsProducts: build.query({
      // params: { companyid, type, status, category, query, page, limit, sort, order }
      query: (params = {}) => ({ url: ENDPOINTS.products.cmsList, params }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((p) => ({ type: 'Product', id: p.id })),
              { type: 'Product', id: 'LIST' },
            ]
          : [{ type: 'Product', id: 'LIST' }],
    }),
    getCmsProduct: build.query({
      query: (id) => ENDPOINTS.products.cmsDetail(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'Product', id }],
    }),
    updateCmsProduct: build.mutation({
      query: ({ id, ...body }) => ({
        url: ENDPOINTS.products.cmsUpdate(id),
        method: 'PATCH',
        body,
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
      ],
    }),
    notifyCmsProductsEdited: build.mutation({
      query: (body) => ({
        url: ENDPOINTS.products.cmsNotifyEdited,
        method: 'POST',
        body,
      }),
      transformResponse: (res) => res?.data ?? res,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCmsProductsQuery,
  useGetCmsProductQuery,
  useUpdateCmsProductMutation,
  useNotifyCmsProductsEditedMutation,
} = productsApi;
