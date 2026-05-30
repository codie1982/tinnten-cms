'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * Cron servisi (tinnten-cron) CMS köprüsü → tinnten-server /cron/cms.
 * Zamanlanmış görevler (cron_jobs), çalışma geçmişi (cron_job_logs), dashboard.
 */
export const cronApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCronHealth: build.query({
      query: () => ENDPOINTS.cron.cmsHealth,
      transformResponse: (res) => res?.data ?? res, // { ok, status, requiredJobs, scheduledJobCount, ... }
      providesTags: [{ type: 'CronStatus', id: 'HEALTH' }],
    }),
    getCronStats: build.query({
      query: () => ENDPOINTS.cron.cmsStats,
      transformResponse: (res) => res?.data ?? res, // { summary, jobs }
      providesTags: [{ type: 'CronStatus', id: 'STATS' }],
    }),
    getCronJobs: build.query({
      query: () => ENDPOINTS.cron.cmsJobs,
      transformResponse: (res) => res?.data ?? res, // CronJob[]
      providesTags: [{ type: 'CronJob', id: 'LIST' }],
    }),
    getCronJob: build.query({
      query: (id) => ENDPOINTS.cron.cmsJob(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'CronJob', id }],
    }),
    getCronJobLogs: build.query({
      query: ({ id, page = 1, limit = 20 }) => ({ url: ENDPOINTS.cron.cmsJobLogs(id), params: { page, limit } }),
      transformResponse: (res) => res?.data ?? res, // { jobId, jobName, pagination, logs }
      providesTags: (r, e, { id }) => [{ type: 'CronJob', id: `${id}:logs` }],
    }),
    createCronJob: build.mutation({
      query: (body) => ({ url: ENDPOINTS.cron.cmsJobs, method: 'POST', body }),
      invalidatesTags: [{ type: 'CronJob', id: 'LIST' }, { type: 'CronStatus', id: 'STATS' }],
    }),
    updateCronJob: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.cron.cmsJob(id), method: 'PUT', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'CronJob', id }, { type: 'CronJob', id: 'LIST' }, { type: 'CronStatus', id: 'STATS' }],
    }),
    deleteCronJob: build.mutation({
      query: (id) => ({ url: ENDPOINTS.cron.cmsJob(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'CronJob', id: 'LIST' }, { type: 'CronStatus', id: 'STATS' }],
    }),
    runCronJob: build.mutation({
      query: (id) => ({ url: ENDPOINTS.cron.cmsJobRun(id), method: 'POST' }),
      invalidatesTags: (r, e, id) => [{ type: 'CronJob', id: `${id}:logs` }, { type: 'CronStatus', id: 'STATS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCronHealthQuery,
  useGetCronStatsQuery,
  useGetCronJobsQuery,
  useGetCronJobQuery,
  useGetCronJobLogsQuery,
  useCreateCronJobMutation,
  useUpdateCronJobMutation,
  useDeleteCronJobMutation,
  useRunCronJobMutation,
} = cronApi;
