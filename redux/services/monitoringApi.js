'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * Monitoring köprüsü → tinnten-server /monitoring/cms (Prometheus query API).
 * Host (node-exporter), konteyner (cAdvisor), scrape hedefleri, alarmlar, zaman serisi.
 */
export const monitoringApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMetricsHost: build.query({
      query: () => ENDPOINTS.monitoring.cmsHost,
      transformResponse: (res) => res?.data ?? res,
      providesTags: [{ type: 'Monitoring', id: 'HOST' }],
    }),
    getMetricsContainers: build.query({
      query: () => ENDPOINTS.monitoring.cmsContainers,
      transformResponse: (res) => res?.data ?? res, // { items }
      providesTags: [{ type: 'Monitoring', id: 'CONTAINERS' }],
    }),
    getMetricsTargets: build.query({
      query: () => ENDPOINTS.monitoring.cmsTargets,
      transformResponse: (res) => res?.data ?? res, // { items, summary }
      providesTags: [{ type: 'Monitoring', id: 'TARGETS' }],
    }),
    getMetricsAlerts: build.query({
      query: () => ENDPOINTS.monitoring.cmsAlerts,
      transformResponse: (res) => res?.data ?? res, // { items }
      providesTags: [{ type: 'Monitoring', id: 'ALERTS' }],
    }),
    getMetricsRange: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.monitoring.cmsQueryRange, params }), // { query, minutes, step }
      transformResponse: (res) => res?.data ?? res, // { series, start, end, step }
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMetricsHostQuery,
  useGetMetricsContainersQuery,
  useGetMetricsTargetsQuery,
  useGetMetricsAlertsQuery,
  useGetMetricsRangeQuery,
} = monitoringApi;
