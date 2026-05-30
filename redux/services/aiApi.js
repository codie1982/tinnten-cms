'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/** Yapay Zeka kaynakları — Asistanlar ve İş Akışları (CMS listeleri). */
export const aiApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAssistants: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.assistants.cmsList, params }), // { query, status, page, limit }
      transformResponse: (res) => res?.data ?? res,
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((a) => ({ type: 'Assistant', id: a.id })),
              { type: 'Assistant', id: 'LIST' },
            ]
          : [{ type: 'Assistant', id: 'LIST' }],
    }),
    getAssistant: build.query({
      query: (id) => ENDPOINTS.assistants.cmsDetail(id),
      transformResponse: (res) => (res?.data ?? res)?.assistant ?? null,
      providesTags: (r, e, id) => [{ type: 'Assistant', id }],
    }),
    getAssistantToolDefinitions: build.query({
      query: (id) => ENDPOINTS.assistants.cmsToolDefinitions(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'Assistant', id: `tools-${id}` }],
    }),
    getWorkflows: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.workflows.cmsList, params }), // { query, status, page, limit }
      transformResponse: (res) => res?.data ?? res,
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((w) => ({ type: 'Workflow', id: w.id })),
              { type: 'Workflow', id: 'LIST' },
            ]
          : [{ type: 'Workflow', id: 'LIST' }],
    }),
    getUsageSeries: build.query({
      query: (range = '7d') => ({ url: ENDPOINTS.usage.cmsSeries, params: { range } }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: [{ type: 'AssistantUsage', id: 'SERIES' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAssistantsQuery,
  useGetAssistantQuery,
  useGetAssistantToolDefinitionsQuery,
  useGetWorkflowsQuery,
  useGetUsageSeriesQuery,
} = aiApi;
