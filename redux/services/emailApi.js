'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/** Email: kampanyalar, listeler, şablonlar, geçmiş ve gönderim API servisi. */
export const emailApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /* Kampanyalar */
    getEmailCampaigns: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.email.campaigns, params }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: [{ type: 'EmailCampaign', id: 'LIST' }],
    }),

    /* Mail listeleri */
    getEmailLists: build.query({
      query: () => ENDPOINTS.email.lists,
      transformResponse: (res) => res?.data ?? res,
      providesTags: [{ type: 'EmailList', id: 'LIST' }],
    }),
    createEmailList: build.mutation({
      query: (body) => ({ url: ENDPOINTS.email.lists, method: 'POST', body }),
      invalidatesTags: [{ type: 'EmailList', id: 'LIST' }],
    }),

    /* Şablonlar */
    getEmailTemplates: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.email.templates, params }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: [{ type: 'EmailTemplate', id: 'LIST' }],
    }),
    updateEmailTemplate: build.mutation({
      query: ({ id, ...body }) => ({
        url: `${ENDPOINTS.email.templates}/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: [{ type: 'EmailTemplate', id: 'LIST' }],
    }),

    /* Mail geçmişi */
    getEmailHistory: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.email.history, params }), // { status, template, query, userId }
      transformResponse: (res) => res?.data ?? res,
      providesTags: [{ type: 'EmailHistory', id: 'LIST' }],
    }),

    /* Mail gönder (tek/çoklu alıcı) */
    sendEmail: build.mutation({
      query: (body) => ({ url: ENDPOINTS.email.send, method: 'POST', body }), // { recipients[], templateId, subject }
      invalidatesTags: [{ type: 'EmailHistory', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEmailCampaignsQuery,
  useGetEmailListsQuery,
  useCreateEmailListMutation,
  useGetEmailTemplatesQuery,
  useUpdateEmailTemplateMutation,
  useGetEmailHistoryQuery,
  useSendEmailMutation,
} = emailApi;
