'use client';

import { ENDPOINTS } from '@/config/api';
import { baseApi } from './baseApi';

/**
 * Ürün kategorileri & kategori attribute'ları (CMS).
 *
 * NEDEN VAR: ürün `categories` alanı backend'de ID olarak çözülüyor
 * (enrichCategoriesWithDetails ObjectId/UUID regex'i uyguluyor,
 * productsController.js:400). CMS'in eski virgüllü serbest-metin alanı
 * çözümlenemeyen kategori yazıyordu; CategoryPicker bunun yerine ID yazar.
 *
 * DİKKAT: bunlar ürün kategorileri. Haber kategorileri newsCategoryApi.js'te,
 * connector kategorileri connectorsApi.js'te — ayrı kaynaklar.
 */

/**
 * Kategori uçları koleksiyonu birden çok şekilde dönebiliyor (backend'in kendi
 * `extractCategoryItems` yardımcısı da aynı savunmayı yapıyor,
 * categoryController.js:156). Hepsini düz diziye indiriyoruz.
 */
const toCategoryItems = (res) => {
  const data = res?.data ?? res;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

export const categoriesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // params: { limit, skip, afterId, sort }
    getGeneralCategories: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.categories.general, params }),
      transformResponse: toCategoryItems,
      providesTags: [{ type: 'ProductCategory', id: 'GENERAL' }],
    }),
    getGeneralSubcategories: build.query({
      query: (parentId) => ENDPOINTS.categories.generalSubcategories(parentId),
      transformResponse: toCategoryItems,
      providesTags: (r, e, parentId) => [
        { type: 'ProductCategory', id: `CHILDREN-${parentId}` },
      ],
    }),
    // POST — arama gövdesi CategoryService.search'e iletilir. Yazma değil,
    // bu yüzden invalidate yok.
    searchGeneralCategories: build.mutation({
      query: (body) => ({
        url: ENDPOINTS.categories.generalSearch,
        method: 'POST',
        body,
      }),
      transformResponse: toCategoryItems,
    }),
    // Kategori-bazlı attribute tanımları — AttributeEditor (Faz 3) bunu sürer.
    getCategoryAttributes: build.query({
      query: ({ companyid, categoryId }) =>
        ENDPOINTS.categories.companyCategoryAttributes(companyid, categoryId),
      transformResponse: toCategoryItems,
      providesTags: (r, e, { categoryId }) => [
        { type: 'CategoryAttribute', id: categoryId },
      ],
    }),
    getCmsServiceCategories: build.query({
      query: (params = {}) => ({
        url: ENDPOINTS.categories.cmsServices,
        params,
      }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (result) => [
        ...(result?.items || []).map((item) => ({
          type: 'ProductCategory',
          id: item.id,
        })),
        { type: 'ProductCategory', id: 'CMS-SERVICE-LIST' },
      ],
    }),
    createCmsServiceCategory: build.mutation({
      query: (body) => ({
        url: ENDPOINTS.categories.cmsServices,
        method: 'POST',
        body,
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: [{ type: 'ProductCategory', id: 'CMS-SERVICE-LIST' }],
    }),
    updateCmsServiceCategory: build.mutation({
      query: ({ id, ...body }) => ({
        url: ENDPOINTS.categories.cmsService(id),
        method: 'PATCH',
        body,
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'ProductCategory', id },
        { type: 'ProductCategory', id: 'CMS-SERVICE-LIST' },
      ],
    }),
    deleteCmsServiceCategory: build.mutation({
      query: (id) => ({
        url: ENDPOINTS.categories.cmsService(id),
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'ProductCategory', id },
        { type: 'ProductCategory', id: 'CMS-SERVICE-LIST' },
      ],
    }),
    getCmsServiceCategoryProducts: build.query({
      query: ({ id, ...params }) => ({
        url: ENDPOINTS.categories.cmsServiceProducts(id),
        params,
      }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (result, error, { id }) => [
        { type: 'ProductCategory', id: `PRODUCTS-${id}` },
      ],
    }),
    addCmsServiceCategoryAttribute: build.mutation({
      query: ({ id, ...body }) => ({
        url: ENDPOINTS.categories.cmsServiceAttributes(id),
        method: 'POST',
        body,
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'ProductCategory', id },
        { type: 'ProductCategory', id: 'CMS-SERVICE-LIST' },
      ],
    }),
    deleteCmsServiceCategoryAttribute: build.mutation({
      query: ({ id, code }) => ({
        url: ENDPOINTS.categories.cmsServiceAttribute(id, code),
        method: 'DELETE',
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'ProductCategory', id },
        { type: 'ProductCategory', id: 'CMS-SERVICE-LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetGeneralCategoriesQuery,
  useGetGeneralSubcategoriesQuery,
  useSearchGeneralCategoriesMutation,
  useGetCategoryAttributesQuery,
  useGetCmsServiceCategoriesQuery,
  useCreateCmsServiceCategoryMutation,
  useUpdateCmsServiceCategoryMutation,
  useDeleteCmsServiceCategoryMutation,
  useGetCmsServiceCategoryProductsQuery,
  useAddCmsServiceCategoryAttributeMutation,
  useDeleteCmsServiceCategoryAttributeMutation,
} = categoriesApi;
