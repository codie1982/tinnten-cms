/**
 * Merkezi API yapılandırması.
 *
 * Tüm HTTP istemcileri (axios `lib/http.js` ve RTK Query `redux/services/baseApi.js`)
 * base URL'i buradan alır — tek doğruluk kaynağı.
 *
 * Base URL `.env.local` içindeki NEXT_PUBLIC_BACKEND_URL ile override edilebilir.
 * Varsayılan: yerel backend (tinnten-server) → http://localhost:5001/api/v10
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001/api/v10';

/** Sadece host (örn. dosya/CDN URL'leri için) → http://localhost:5001 */
export const API_HOST = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

/** Varsayılan istek zaman aşımı (ms) */
export const API_TIMEOUT = 30_000;

/**
 * Backend endpoint yolları — tek yerden yönetilir.
 * Servis dosyaları (redux/services/*) bu sabitleri kullanır.
 */
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    loginCms: '/auth/login/cms',
    validate: '/auth/validate',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  news: {
    list: '/news-content/list',
    detail: (id) => `/news-content/${id}`,
    create: '/news-content',
    update: (id) => `/news-content/${id}`,
    remove: (id) => `/news-content/${id}`,
    publish: (id) => `/news-content/${id}/publish`,
    unpublish: (id) => `/news-content/${id}/unpublish`,
    generate: '/news-content/generate',
    aiImage: (id) => `/news-content/${id}/ai-image`,
    images: (id) => `/news-content/${id}/images`,
    cover: (id) => `/news-content/${id}/cover`,
    socialPosts: (id) => `/news-content/${id}/social-posts`,
  },
  newsCategories: {
    tree: '/news-categories/tree',
    detail: (id) => `/news-categories/detail/${id}`,
    children: (id) => `/news-categories/children/${id}`,
    create: '/news-categories',
    update: (id) => `/news-categories/${id}`,
    remove: (id) => `/news-categories/${id}`,
  },
  assistants: {
    list: '/assistants',
    detail: (id) => `/assistants/${id}`,
    usage: '/assistants/usage',
  },
  companies: {
    list: '/companies',
    detail: (id) => `/companies/${id}`,
    update: (id) => `/companies/${id}`,
    approve: (id) => `/companies/${id}/approve`,
    reject: (id) => `/companies/${id}/reject`,
  },
  users: {
    list: '/users',
    detail: (id) => `/users/${id}`,
    update: (id) => `/users/${id}`,
    sessions: (id) => `/users/${id}/sessions`,
  },
  email: {
    campaigns: '/email/campaigns',
    lists: '/email/lists',
    templates: '/email/templates',
    history: '/email/history',
    send: '/email/send',
  },
  contracts: {
    list: (type) => `/contracts/${type}`,
    version: (type, id) => `/contracts/${type}/${id}`,
    create: (type) => `/contracts/${type}`,
  },
  upload: {
    image: '/upload/multiple/image',
  },
};
