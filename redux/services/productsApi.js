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
/**
 * addProduct başarı yanıtından ürünü çıkarır.
 *
 * DİKKAT — backend hatası: addProduct `ApiResponse.success({ message, product })`
 * çağırıyor ama imza `(code, message, data)` (helpers/response.js:42). Bu yüzden
 * ürün `data`'ya DEĞİL `status.code.product`'a düşüyor ve `data` boş `{}` kalıyor
 * (productsController.js:5948). Dashboard da aynı hatadan etkileniyor —
 * `data.product` bekliyor, boş nesne alıyor.
 *
 * Burada her iki şekli de tolere ediyoruz: backend düzeltildiğinde bu fonksiyon
 * değişmeden doğru dalı kullanmaya devam eder.
 */
const extractCreatedProduct = (res) => {
  const data = res?.data;
  if (data && typeof data === 'object' && Object.keys(data).length) {
    return data.product ?? data;
  }
  const buggy = res?.status?.code;
  if (buggy && typeof buggy === 'object' && buggy.product) {
    return buggy.product;
  }
  return null;
};

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

    // ── Firma adına oluşturma ───────────────────────────────────────────────
    // Gövde şekli tipe göre değişir; tek doğruluk kaynağı
    // app/(protected)/cms/products/_form/productFormModel.js → toCreatePayload.
    // Hizmette `stock`/`shipping` GÖNDERİLMEZ, `quote`'ta pozitif fiyat
    // gönderilmez — backend bunları 400 ile reddediyor.
    createCmsProduct: build.mutation({
      query: (body) => ({
        url: ENDPOINTS.products.cmsCreate,
        method: 'POST',
        body,
      }),
      transformResponse: extractCreatedProduct,
      invalidatesTags: [{ type: 'Product', id: 'LIST' }],
    }),

    // Kalıcı silme. Yanıtta `cleanup` özeti döner
    // ({ prices, images, gallery, failures, usage }) — temizlik eksikse
    // çağıran bunu görebilsin diye sessizce yutulmuyor.
    deleteCmsProduct: build.mutation({
      query: (id) => ({
        url: ENDPOINTS.products.cmsDelete(id),
        method: 'DELETE',
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, id) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
      ],
    }),

    // ── Alt-kaynak yazma ────────────────────────────────────────────────────
    // status / priceAmount listede kolon olduğu için LIST de invalidate edilir.
    updateCmsProductStatus: build.mutation({
      query: ({ id, status }) => ({
        url: ENDPOINTS.products.cmsStatus(id),
        method: 'PUT',
        body: { status },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
      ],
    }),
    // basePrice yazımı backend'de `priceAmount`/`currency`'yi de resync eder →
    // liste fiyat kolonu tazelenmeli.
    // DİKKAT: gövde `{ basePrice: ... }` DEĞİL, fiyat yükünün KENDİSİ —
    // backend `validateUpdateProductBasePriceBody(req.body)` sonucunu doğrudan
    // buildBasePriceDocs'a veriyor. Dizi gönderilirse tam plan seti olarak
    // yorumlanır ve `pricetype` ondan TÜRETİLİR (birden çok plan veya period
    // taşıyan plan → recurring).
    updateCmsProductBasePrice: build.mutation({
      query: ({ id, basePrice }) => ({
        url: ENDPOINTS.products.cmsBasePrice(id),
        method: 'PUT',
        body: basePrice,
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
      ],
    }),
    deleteCmsProductBasePriceItem: build.mutation({
      query: ({ id, priceId }) => ({
        url: ENDPOINTS.products.cmsBasePriceItem(id, priceId),
        method: 'DELETE',
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
      ],
    }),
    updateCmsProductGallery: build.mutation({
      query: ({ id, gallery }) => ({
        url: ENDPOINTS.products.cmsGallery(id),
        method: 'PUT',
        body: { gallery },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [{ type: 'Product', id }],
    }),
    // Toplu PUT en az 1 görsel istiyor (validateUpdateProductGalleryBody) →
    // son görseli ancak bu uçla silebilirsin.
    deleteCmsProductGalleryImage: build.mutation({
      query: ({ id, imageId }) => ({
        url: ENDPOINTS.products.cmsGalleryImage(id, imageId),
        method: 'DELETE',
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [{ type: 'Product', id }],
    }),
    updateCmsProductVariants: build.mutation({
      query: ({ id, variants }) => ({
        url: ENDPOINTS.products.cmsVariants(id),
        method: 'PUT',
        body: { variants },
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
  useCreateCmsProductMutation,
  useDeleteCmsProductMutation,
  useUpdateCmsProductStatusMutation,
  useUpdateCmsProductBasePriceMutation,
  useDeleteCmsProductBasePriceItemMutation,
  useUpdateCmsProductGalleryMutation,
  useDeleteCmsProductGalleryImageMutation,
  useUpdateCmsProductVariantsMutation,
} = productsApi;
