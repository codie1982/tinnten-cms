'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * Eklenen dosyalar (files koleksiyonu) → tinnten-server /files/cms.
 * Global medya kütüphanesi: medya tipine göre gruplu liste + istatistik.
 */
export const filesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getFileStats: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.files.cmsStats, params }), // { status }
      transformResponse: (res) => res?.data ?? res, // { total, totalSize, groups }
      providesTags: [{ type: 'FileAsset', id: 'STATS' }],
    }),
    getFiles: build.query({
      // { q, mediaType, source, channel, status, limit, skip }
      query: (params = {}) => ({ url: ENDPOINTS.files.cmsList, params }),
      transformResponse: (res) => res?.data ?? res, // { items, total, limit, skip }
      providesTags: [{ type: 'FileAsset', id: 'LIST' }],
    }),
    /**
     * Dosya içeriği + kaynak künyesi. Ayrı uç gerekiyor: `/files/:id/read`
     * sahiplik kontrolü yapar, admin başkasının dosyasında 404 alır.
     */
    getFileContent: build.query({
      query: (id) => ({ url: ENDPOINTS.files.cmsContent(id) }),
      // { file, inspect, content, contentError, previewUrl, document }
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'FileAsset', id }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetFileStatsQuery,
  useGetFilesQuery,
  useGetFileContentQuery,
} = filesApi;
