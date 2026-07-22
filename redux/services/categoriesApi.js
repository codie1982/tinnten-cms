'use client';

import { ENDPOINTS } from '@/config/api';
import { baseApi } from './baseApi';

/**
 * Ürün kategorileri & kategori attribute'ları (CMS).
 *
 * CMS admini bu uçları ek backend yetkisi olmadan kullanabilir:
 * /categories/general* tamamen public, /categories/company/* ve
 * /categories/attributes/company/* yalnız `ensureAuth` (üyelik kapısı yok).
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
  }),
  overrideExisting: false,
});

export const {
  useGetGeneralCategoriesQuery,
  useGetGeneralSubcategoriesQuery,
  useSearchGeneralCategoriesMutation,
  useGetCategoryAttributesQuery,
} = categoriesApi;
