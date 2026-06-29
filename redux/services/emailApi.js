'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * Email servisi:
 *  - Şablonlar: dosya bazlı (.flt), çok dilli (email-templates/cms)
 *  - Giden mailler: maillog (maillog/cms)
 *  - Listeler/kampanya/gönderim: mevcut (kısmen mock) uçlar
 */
export const emailApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /* Mail listeleri (mevcut) */
    getEmailLists: build.query({
      query: () => ENDPOINTS.email.lists,
      transformResponse: (res) => res?.data ?? res,
      providesTags: [{ type: 'EmailList', id: 'LIST' }],
    }),

    /* Mail gönder */
    sendEmail: build.mutation({
      query: (body) => ({ url: ENDPOINTS.email.send, method: 'POST', body }),
      invalidatesTags: [{ type: 'EmailHistory', id: 'LIST' }],
    }),

    /* ── Şablonlar (dosya bazlı, çok dil) ── */
    getEmailTemplates: build.query({
      query: () => ENDPOINTS.emailTemplates.cmsList,
      transformResponse: (res) => res?.data ?? res, // { items, locales }
      providesTags: [{ type: 'EmailTemplate', id: 'LIST' }],
    }),
    getEmailTemplate: build.query({
      query: ({ name, locale }) => ({ url: ENDPOINTS.emailTemplates.cmsDetail(name), params: { locale } }),
      transformResponse: (res) => res?.data ?? res, // { name, locale, content, exists, fallback }
      providesTags: (r, e, { name }) => [{ type: 'EmailTemplate', id: name }],
    }),
    saveEmailTemplate: build.mutation({
      query: ({ name, locale, content }) => ({
        url: ENDPOINTS.emailTemplates.cmsDetail(name),
        method: 'PUT',
        params: { locale },
        body: { content },
      }),
      invalidatesTags: (r, e, { name }) => [{ type: 'EmailTemplate', id: name }, { type: 'EmailTemplate', id: 'LIST' }],
    }),
    createEmailTemplate: build.mutation({
      query: (body) => ({ url: ENDPOINTS.emailTemplates.cmsCreate, method: 'POST', body }), // { name, locale, content }
      invalidatesTags: [{ type: 'EmailTemplate', id: 'LIST' }],
    }),

    /* ── Giden mailler (maillog) ── */
    getSentMails: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.mailLog.cmsList, params }), // { page, limit, status, query, to, from }
      transformResponse: (res) => res?.data ?? res,
      providesTags: [{ type: 'EmailHistory', id: 'LIST' }],
    }),
    getSentMail: build.query({
      query: (id) => ENDPOINTS.mailLog.cmsDetail(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'EmailHistory', id }],
    }),

    /* ── Gelen mailler (S3 inbox) ── */
    getInbox: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.inbox.cmsList, params }), // { limit, token }
      transformResponse: (res) => res?.data ?? res, // { items, nextToken }
    }),
    getInboxMail: build.query({
      query: (key) => ({ url: ENDPOINTS.inbox.cmsDetail, params: { key } }),
      transformResponse: (res) => res?.data ?? res,
    }),
    setInboxRead: build.mutation({
      query: ({ key, read }) => ({ url: ENDPOINTS.inbox.cmsRead, method: 'PATCH', params: { key, read } }),
      transformResponse: (res) => res?.data ?? res,
    }),

    /* ── Mail Listeleri (mail_lists) ── */
    getCmsSubscribers: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.mailList.cmsList, params }), // { q, status, channel, category, limit, skip }
      transformResponse: (res) => res?.data ?? res, // { items, total, limit, skip }
      providesTags: [{ type: 'MailSubscriber', id: 'LIST' }],
    }),
    getCmsSubscriptionStats: build.query({
      query: () => ENDPOINTS.mailList.cmsStats,
      transformResponse: (res) => res?.data ?? res, // { total, byStatus, channels, categories, locales }
      providesTags: [{ type: 'MailSubscriber', id: 'STATS' }],
    }),
    getCmsSubscriber: build.query({
      query: (email) => ({ url: ENDPOINTS.mailList.cmsDetail, params: { email } }),
      transformResponse: (res) => res?.data ?? res, // full mail_list doc
      providesTags: (r, e, email) => [{ type: 'MailSubscriber', id: email }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEmailListsQuery,
  useSendEmailMutation,
  useGetEmailTemplatesQuery,
  useGetEmailTemplateQuery,
  useSaveEmailTemplateMutation,
  useCreateEmailTemplateMutation,
  useGetSentMailsQuery,
  useGetSentMailQuery,
  useLazyGetInboxQuery,
  useGetInboxMailQuery,
  useSetInboxReadMutation,
  useGetCmsSubscribersQuery,
  useGetCmsSubscriptionStatsQuery,
  useGetCmsSubscriberQuery,
} = emailApi;
