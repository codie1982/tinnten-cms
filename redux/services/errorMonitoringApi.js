'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * In-house hata izleme (tinnten-server /error-monitoring/cms).
 * Issue listesi/detayı + durum güncelleme (resolve/ignore/reopen).
 */
export const errorMonitoringApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getErrorStats: build.query({
      query: () => ENDPOINTS.errorMonitoring.cmsStats,
      transformResponse: (res) => res?.data ?? res, // { issues, events }
      providesTags: [{ type: 'ErrorIssue', id: 'STATS' }],
    }),
    getErrorIssues: build.query({
      query: ({ page = 1, limit = 25, status, level, environment, q, sort } = {}) => ({
        url: ENDPOINTS.errorMonitoring.cmsIssues,
        params: { page, limit, status, level, environment, q, sort },
      }),
      transformResponse: (res) => res?.data ?? res, // { items, total, page, limit, totalPages }
      providesTags: [{ type: 'ErrorIssue', id: 'LIST' }],
    }),
    getErrorIssueDetail: build.query({
      query: (fingerprint) => ENDPOINTS.errorMonitoring.cmsIssueDetail(fingerprint),
      transformResponse: (res) => res?.data ?? res, // { issue, events }
      providesTags: (r, e, fingerprint) => [{ type: 'ErrorIssue', id: fingerprint }],
    }),
    updateErrorIssue: build.mutation({
      query: ({ fingerprint, status }) => ({
        url: ENDPOINTS.errorMonitoring.cmsResolve(fingerprint),
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: (r, e, { fingerprint }) => [
        { type: 'ErrorIssue', id: fingerprint },
        { type: 'ErrorIssue', id: 'LIST' },
        { type: 'ErrorIssue', id: 'STATS' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetErrorStatsQuery,
  useGetErrorIssuesQuery,
  useGetErrorIssueDetailQuery,
  useUpdateErrorIssueMutation,
} = errorMonitoringApi;
