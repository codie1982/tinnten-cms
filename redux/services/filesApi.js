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
      query: (params = {}) => ({ url: ENDPOINTS.files.cmsList, params }), // { q, mediaType, status, limit, skip }
      transformResponse: (res) => res?.data ?? res, // { items, total, limit, skip }
      providesTags: [{ type: 'FileAsset', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetFileStatsQuery,
  useGetFilesQuery,
} = filesApi;
