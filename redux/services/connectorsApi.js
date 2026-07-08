'use client';

/**
 * MCP connector kataloğu + kategorileri (cms:admin).
 *
 * Katalog girdileri credential TUTMAZ: OAuth secret'ları backend `.env`'de
 * (OAUTH_<KEY>_CLIENT_ID/SECRET), api_key secret'ları kullanıcının kendi
 * connector'ında yaşar. Bu yüzden burada gönderilen/gelen hiçbir alan gizli değil.
 *
 * ⚠️ İSİM ÇAKIŞMASI: `newsCategoryApi` zaten `createCategory`/`updateCategory`/
 * `deleteCategory`/`getCategory` endpoint'lerini tanımlıyor ve
 * `redux/services/index.js` hepsini `export *` ile yayıyor. RTK Query
 * `overrideExisting: false` altında aynı isimli endpoint'te THROW eder — bu
 * yüzden buradaki tüm kategori endpoint/hook adları `...ConnectorCategory`
 * son ekiyle benzersizleştirildi.
 *
 * Backend `mapCategory`/`mapCms` `_id` değil **`id`** döndürür; sayfalar `c.id`
 * kullanmalı (packages sayfasındaki `p._id`'den farklı).
 */
import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

export const connectorsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ── Katalog (CMS) ──────────────────────────────────
    getCmsConnectorCatalog: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.connectorCatalog.cmsList, params }),
      transformResponse: (res) => (res?.data ?? res)?.items ?? [],
      providesTags: [{ type: 'ConnectorCatalog', id: 'LIST' }],
    }),
    getCmsConnectorCatalogEntry: build.query({
      query: (id) => ENDPOINTS.connectorCatalog.cmsDetail(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'ConnectorCatalog', id }],
    }),
    // Backend ApiResponse zarfı döner: { status, success, message, data: <girdi> }.
    // transformResponse olmadan `.unwrap()` zarfın tamamını verir ve çağıran
    // `created.id` diye okuyunca undefined bulur — girdi oluşur ama yönlendirme olmaz.
    createConnectorCatalogEntry: build.mutation({
      query: (body) => ({ url: ENDPOINTS.connectorCatalog.cmsCreate, method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: [{ type: 'ConnectorCatalog', id: 'LIST' }],
    }),
    updateConnectorCatalogEntry: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.connectorCatalog.cmsUpdate(id), method: 'PUT', body }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, { id }) => [
        { type: 'ConnectorCatalog', id },
        { type: 'ConnectorCatalog', id: 'LIST' },
      ],
    }),
    deleteConnectorCatalogEntry: build.mutation({
      query: (id) => ({ url: ENDPOINTS.connectorCatalog.cmsDelete(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'ConnectorCatalog', id: 'LIST' }],
    }),

    // ── OAuth provider'ları (salt-okunur, provider.config.js + .env kaynaklı) ──
    getOAuthProviders: build.query({
      // ?authType=oauth2 → telegram/whatsapp gibi api_key provider'ları dropdown'a düşmesin.
      query: () => ({ url: ENDPOINTS.oauthProviders.list, params: { authType: 'oauth2' } }),
      // Bu endpoint zarfı `{ status, data }` — data doğrudan dizi.
      transformResponse: (res) => (Array.isArray(res?.data) ? res.data : []),
      providesTags: [{ type: 'OAuthProvider', id: 'LIST' }],
    }),

    // ── Kategoriler (CMS) ──────────────────────────────
    getConnectorCategories: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.connectorCategories.cmsList, params }),
      transformResponse: (res) => (res?.data ?? res)?.items ?? [],
      providesTags: [{ type: 'ConnectorCategory', id: 'LIST' }],
    }),
    createConnectorCategory: build.mutation({
      query: (body) => ({ url: ENDPOINTS.connectorCategories.cmsCreate, method: 'POST', body }),
      invalidatesTags: [{ type: 'ConnectorCategory', id: 'LIST' }],
    }),
    updateConnectorCategory: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.connectorCategories.cmsUpdate(id), method: 'PUT', body }),
      invalidatesTags: [{ type: 'ConnectorCategory', id: 'LIST' }],
    }),
    deleteConnectorCategory: build.mutation({
      query: (id) => ({ url: ENDPOINTS.connectorCategories.cmsDelete(id), method: 'DELETE' }),
      // Kategori silinince katalog listesindeki kategori etiketleri de bayatlar.
      invalidatesTags: [
        { type: 'ConnectorCategory', id: 'LIST' },
        { type: 'ConnectorCatalog', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCmsConnectorCatalogQuery,
  useGetCmsConnectorCatalogEntryQuery,
  useCreateConnectorCatalogEntryMutation,
  useUpdateConnectorCatalogEntryMutation,
  useDeleteConnectorCatalogEntryMutation,
  useGetOAuthProvidersQuery,
  useGetConnectorCategoriesQuery,
  useCreateConnectorCategoryMutation,
  useUpdateConnectorCategoryMutation,
  useDeleteConnectorCategoryMutation,
} = connectorsApi;
