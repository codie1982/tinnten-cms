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

    // ── Alt-kaynak güncellemeleri ───────────────────────────────────────────
    // Her biri kendi bölümünden bağımsız kaydeder; ürün detayını invalidate
    // ederek yeniden çekilmesini tetikler.
    updateCmsProductTimeRestriction: build.mutation({
      query: ({ id, timeRestriction }) => ({
        url: ENDPOINTS.products.cmsTimeRestriction(id),
        method: 'PUT',
        body: { timeRestriction },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [{ type: 'Product', id }],
    }),
    updateCmsProductReservationConfig: build.mutation({
      query: ({ id, reservationConfig }) => ({
        url: ENDPOINTS.products.cmsReservationConfig(id),
        method: 'PUT',
        body: { reservationConfig },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [{ type: 'Product', id }],
    }),
    updateCmsProductLocation: build.mutation({
      query: ({ id, ...location }) => ({
        url: ENDPOINTS.products.cmsLocation(id),
        method: 'PUT',
        body: location,
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [{ type: 'Product', id }],
    }),
    getCmsProductForms: build.query({
      query: ({ id, type }) => ({
        url: ENDPOINTS.products.cmsForms(id),
        params: type ? { type } : undefined,
      }),
      transformResponse: (res) => (res?.data ?? res)?.items ?? [],
      providesTags: (r, e, { id }) => [{ type: 'Product', id: `forms-${id}` }],
    }),
    // Yapay zeka ile form alanı üretir; KAYDETMEZ → invalidate yok.
    generateCmsProductForm: build.mutation({
      query: ({ id, ...body }) => ({
        url: ENDPOINTS.products.cmsFormGenerate(id),
        method: 'POST',
        body,
      }),
      transformResponse: (res) => res?.data ?? res,
    }),
    // Gözden geçirilmiş alanlardan form oluşturur ve ürüne bağlar.
    createCmsProductForm: build.mutation({
      query: ({ id, slot, ...body }) => ({
        url: ENDPOINTS.products.cmsFormCreate(id, slot),
        method: 'POST',
        body,
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Product', id },
        { type: 'Product', id: `forms-${id}` },
      ],
    }),
    associateCmsProductForm: build.mutation({
      query: ({ id, slot, formId }) => ({
        url: ENDPOINTS.products.cmsFormAssociate(id, slot),
        method: 'PUT',
        body: { formId },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [{ type: 'Product', id }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCmsProductsQuery,
  useGetCmsProductQuery,
  useUpdateCmsProductMutation,
  useNotifyCmsProductsEditedMutation,
  useUpdateCmsProductTimeRestrictionMutation,
  useUpdateCmsProductReservationConfigMutation,
  useUpdateCmsProductLocationMutation,
  useGetCmsProductFormsQuery,
  useGenerateCmsProductFormMutation,
  useCreateCmsProductFormMutation,
  useAssociateCmsProductFormMutation,
} = productsApi;
