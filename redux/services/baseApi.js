'use client';

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/config/api';
import { getAuthToken, setAuthToken } from '@/lib/authToken';
import { refreshSessionToken } from '@/lib/sessionRefresh';

/**
 * Merkezi RTK Query base API.
 *
 * - baseUrl: config/api.js → API_BASE_URL (localhost:5001/api/v10)
 * - prepareHeaders: NextAuth oturum token'ını (in-memory store üzerinden) otomatik ekler.
 *   Token, useSyncAuthToken hook'u ile session'dan senkronize edilir; Redux auth slice
 *   varsa oradan da okunur.
 * - tagTypes: cache invalidation için kaynak etiketleri. Mutasyonlar ilgili tag'i
 *   invalidate ederek otomatik refetch tetikler.
 *
 * Yeni kaynak servisleri `baseApi.injectEndpoints(...)` ile eklenir (redux/services/*).
 */
const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    // 1) in-memory token (useSyncAuthToken ile session'dan doldurulur)
    // 2) redux auth slice fallback
    const token = getAuthToken() || getState()?.auth?.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return headers;
  },
});

/**
 * Hata yanıtlarını normalize eden sarmalayıcı.
 * Backend `{ status: { description } }` veya `{ message }` döndürebilir → tek tip mesaj.
 */
const baseQueryWithNormalize = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  // 401 güvenlik ağı: access token süresi dolmuşsa NextAuth session'ını tazele
  // (jwt callback → backend refresh), in-memory token'ı güncelle ve isteği TEK
  // sefer retry et. prepareHeaders güncel token'ı otomatik alır. Oturum kalıcı
  // ölüyse (refreshSessionToken → null) retry yok; useSyncAuthToken signOut eder.
  if (
    result.error?.status === 401 &&
    typeof window !== 'undefined' &&
    !extraOptions?._retry
  ) {
    const newToken = await refreshSessionToken();
    if (newToken) {
      setAuthToken(newToken);
      result = await rawBaseQuery(args, api, { ...extraOptions, _retry: true });
    }
  }

  if (result.error) {
    const d = result.error.data;
    const message =
      (d && (d.message || d?.status?.description)) ||
      result.error.error ||
      'Sunucu hatası oluştu.';
    result.error.normalizedMessage = message;
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithNormalize,
  // Tüm CMS kaynakları için cache etiketleri
  tagTypes: [
    'News',
    'NewsCategory',
    'Assistant',
    'AssistantUsage',
    'Workflow',
    'Company',
    'CompanyApproval',
    'User',
    'EmailCampaign',
    'EmailList',
    'EmailTemplate',
    'EmailHistory',
    'MailSubscriber',
    'MailChannel',
    'MailChannelMember',
    'MailTemplate',
    'MergeVar',
    'FetcherStatus',
    'FetcherDomain',
    'FetcherUrl',
    'FetcherLog',
    'FetcherNode',
    'FetcherSubscription',
    'FetcherReport',
    'FetcherHealth',
    'FetcherConfig',
    'FetcherTuning',
    'EmbeddingStatus',
    'EmbeddingDoc',
    'EmbeddingCompany',
    'CronStatus',
    'CronJob',
    'CronList',
    'MqStatus',
    'Monitoring',
    'FileAsset',
    'Contract',
    'Doc',
    'DocCategory',
    'Package',
    'Dashboard',
    'Faq',
    'ErrorIssue',
    'Conversation',
    'Product',
    'ProductCategory',
    'CategoryAttribute',
    'ConnectorCatalog',
    'ConnectorCategory',
    'OAuthProvider',
    'SupportTicket',
    'SupportCallback',
  ],
  // Endpoint'ler ayrı servis dosyalarında injectEndpoints ile eklenir
  endpoints: () => ({}),
});

export default baseApi;
