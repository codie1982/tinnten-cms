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
    /**
     * Yeni asistan — `companyId` OPSİYONEL. Verilmezse asistan firmasız
     * (atanmamış) doğar ve sonradan assignAssistantCompany ile aktarılır.
     */
    createAssistant: build.mutation({
      query: (body) => ({ url: ENDPOINTS.assistants.cmsCreate, method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res, // { assistant, scopeWarnings? }
      invalidatesTags: [{ type: 'Assistant', id: 'LIST' }],
    }),
    /**
     * Taslak asistan config'inden LLM ile tool intent metinleri üretir —
     * asistan HENÜZ OLUŞMADAN çağrılır (stateless). Sonuç create'ten sonra
     * updateAssistantToolDefinition ile kalıcılaştırılır.
     * Backend'de dakikada 5 istekle sınırlı.
     */
    previewAssistantIntents: build.mutation({
      query: (body) => ({ url: ENDPOINTS.assistants.previewIntents, method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res, // { toolDefinitions: [...] }
    }),
    /**
     * Global (orijinal) tool tanımları — sihirbazda "varsayılan intent" göstermek için.
     *
     * Query string ELLE kurulur: backend `tools[]=A&tools[]=B` bekliyor ama
     * fetchBaseQuery'nin URLSearchParams'ı diziyi virgülle birleştirip tek
     * değere çevirir ("tools=A,B") — o hâlde backend tek bir tool adı sanır.
     * `businessMode` bilinçli olarak GÖNDERİLMEZ: verilmediğinde backend
     * filtreyi atlar ve CMS tüm tool'ların varsayılanını alabilir.
     */
    getAssistantToolDefaults: build.query({
      query: (tools = []) => {
        const qs = tools
          .filter(Boolean)
          .map((t) => `tools[]=${encodeURIComponent(t)}`)
          .join('&');
        return { url: `${ENDPOINTS.assistants.toolDefaults}${qs ? `?${qs}` : ''}` };
      },
      transformResponse: (res) => res?.data ?? res, // { toolDefinitions: [...] }
    }),
    /** Asistana bağlı tool tanımı override'ı (CMS — sahiplik aranmaz). */
    updateAssistantToolDefinition: build.mutation({
      query: ({ id, toolKey, ...patch }) => ({
        url: ENDPOINTS.assistants.cmsToolDefinition(id, toolKey),
        method: 'PATCH',
        body: patch,
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, { id }) => [{ type: 'Assistant', id: `tools-${id}` }],
    }),
    /** Asistanı bir firmaya aktarır (sahiplik + faturalandırma + kapsam devri). */
    assignAssistantCompany: build.mutation({
      query: ({ id, companyId }) => ({
        url: ENDPOINTS.assistants.cmsAssignCompany(id),
        method: 'PATCH',
        body: { companyId },
      }),
      transformResponse: (res) => res?.data ?? res, // { assistant, previousCompanyId, unpublished }
      invalidatesTags: (r, e, { id }) => [
        { type: 'Assistant', id },
        { type: 'Assistant', id: 'LIST' },
      ],
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
  useCreateAssistantMutation,
  useAssignAssistantCompanyMutation,
  usePreviewAssistantIntentsMutation,
  useGetAssistantToolDefaultsQuery,
  useUpdateAssistantToolDefinitionMutation,
  useGetWorkflowsQuery,
  useGetUsageSeriesQuery,
} = aiApi;
