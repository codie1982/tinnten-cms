'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * Toplu mail kampanya sistemi (backend /email/*):
 *  - Kanallar (dinamik liste) + üye yönetimi
 *  - DB kampanya şablonları (dosya .flt'den AYRI)
 *  - Kampanyalar (taslak + hemen gönder) + sendConfig güvenlik parametreleri
 *  - Merge değişkenleri + alıcı sayısı önizleme
 */
export const mailCampaignApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ── Kanallar ──
    getMailChannels: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.email.channels, params }),
      transformResponse: (res) => res?.data?.items ?? res?.data ?? [],
      providesTags: [{ type: 'MailChannel', id: 'LIST' }],
    }),
    createMailChannel: build.mutation({
      query: (body) => ({ url: ENDPOINTS.email.channels, method: 'POST', body }),
      invalidatesTags: [{ type: 'MailChannel', id: 'LIST' }],
    }),
    updateMailChannel: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.email.channel(id), method: 'PATCH', body }),
      invalidatesTags: [{ type: 'MailChannel', id: 'LIST' }],
    }),
    deleteMailChannel: build.mutation({
      query: (id) => ({ url: ENDPOINTS.email.channel(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'MailChannel', id: 'LIST' }],
    }),

    // ── Liste üyeliği (karar #6) ──
    getChannelMembers: build.query({
      query: ({ key, ...params }) => ({ url: ENDPOINTS.email.channelMembers(key), params }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, { key }) => [{ type: 'MailChannelMember', id: key }],
    }),
    addChannelMembers: build.mutation({
      query: ({ key, ...body }) => ({ url: ENDPOINTS.email.channelMembers(key), method: 'POST', body }),
      invalidatesTags: (r, e, { key }) => [
        { type: 'MailChannelMember', id: key },
        { type: 'MailChannel', id: 'LIST' },
      ],
    }),
    removeChannelMember: build.mutation({
      query: ({ key, email }) => ({
        url: ENDPOINTS.email.channelMembers(key),
        method: 'DELETE',
        body: { email },
      }),
      invalidatesTags: (r, e, { key }) => [
        { type: 'MailChannelMember', id: key },
        { type: 'MailChannel', id: 'LIST' },
      ],
    }),

    // ── Şablonlar (DB kampanya) ──
    getMailTemplates: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.email.templates, params }),
      transformResponse: (res) => res?.data?.items ?? res?.data ?? [],
      providesTags: [{ type: 'MailTemplate', id: 'LIST' }],
    }),
    getMailTemplate: build.query({
      query: (id) => ENDPOINTS.email.template(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'MailTemplate', id }],
    }),
    createMailTemplate: build.mutation({
      query: (body) => ({ url: ENDPOINTS.email.templates, method: 'POST', body }),
      invalidatesTags: [{ type: 'MailTemplate', id: 'LIST' }],
    }),
    updateMailTemplate: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.email.template(id), method: 'PATCH', body }),
      invalidatesTags: (r, e, { id }) => [
        { type: 'MailTemplate', id },
        { type: 'MailTemplate', id: 'LIST' },
      ],
    }),
    deleteMailTemplate: build.mutation({
      query: (id) => ({ url: ENDPOINTS.email.template(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'MailTemplate', id: 'LIST' }],
    }),
    previewMailTemplate: build.mutation({
      query: ({ id, sampleVars }) => ({
        url: ENDPOINTS.email.templatePreview(id),
        method: 'POST',
        body: { sampleVars },
      }),
      transformResponse: (res) => res?.data ?? res,
    }),

    // ── Kampanyalar ──
    getMailCampaigns: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.email.campaigns, params }),
      transformResponse: (res) => res?.data?.items ?? res?.data ?? [],
      providesTags: [{ type: 'EmailCampaign', id: 'LIST' }],
    }),
    getMailCampaign: build.query({
      query: (id) => ENDPOINTS.email.campaign(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'EmailCampaign', id }],
    }),
    createMailCampaign: build.mutation({
      query: (body) => ({ url: ENDPOINTS.email.campaigns, method: 'POST', body }),
      invalidatesTags: [{ type: 'EmailCampaign', id: 'LIST' }],
    }),
    updateMailCampaign: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.email.campaign(id), method: 'PATCH', body }),
      invalidatesTags: (r, e, { id }) => [
        { type: 'EmailCampaign', id },
        { type: 'EmailCampaign', id: 'LIST' },
      ],
    }),
    deleteMailCampaign: build.mutation({
      query: (id) => ({ url: ENDPOINTS.email.campaign(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'EmailCampaign', id: 'LIST' }],
    }),
    sendMailCampaign: build.mutation({
      query: (id) => ({ url: ENDPOINTS.email.campaignSend(id), method: 'POST' }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, id) => [
        { type: 'EmailCampaign', id },
        { type: 'EmailCampaign', id: 'LIST' },
      ],
    }),
    getMailCampaignStats: build.query({
      query: (id) => ENDPOINTS.email.campaignStats(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'EmailCampaign', id: `${id}:stats` }],
    }),

    // ── Yardımcı ──
    getMergeVariables: build.query({
      query: () => ENDPOINTS.email.mergeVariables,
      transformResponse: (res) => res?.data?.variables ?? res?.data ?? [],
    }),
    getRecipientCount: build.query({
      query: (channelKey) => ({ url: ENDPOINTS.email.recipientCount, params: { channelKey } }),
      transformResponse: (res) => res?.data ?? res,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMailChannelsQuery,
  useCreateMailChannelMutation,
  useUpdateMailChannelMutation,
  useDeleteMailChannelMutation,
  useGetChannelMembersQuery,
  useAddChannelMembersMutation,
  useRemoveChannelMemberMutation,
  useGetMailTemplatesQuery,
  useGetMailTemplateQuery,
  useCreateMailTemplateMutation,
  useUpdateMailTemplateMutation,
  useDeleteMailTemplateMutation,
  usePreviewMailTemplateMutation,
  useGetMailCampaignsQuery,
  useGetMailCampaignQuery,
  useCreateMailCampaignMutation,
  useUpdateMailCampaignMutation,
  useDeleteMailCampaignMutation,
  useSendMailCampaignMutation,
  useGetMailCampaignStatsQuery,
  useGetMergeVariablesQuery,
  useGetRecipientCountQuery,
  useLazyGetRecipientCountQuery,
} = mailCampaignApi;
