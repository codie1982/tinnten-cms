'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/** CMS dashboard özet istatistikleri. */
export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboardStats: build.query({
      query: () => ENDPOINTS.dashboard.stats,
      transformResponse: (res) => res?.data ?? res,
      providesTags: [{ type: 'Dashboard', id: 'STATS' }],
    }),
  }),
  overrideExisting: false,
});

export const { useGetDashboardStatsQuery } = dashboardApi;
