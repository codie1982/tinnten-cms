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
    // Zarfı aç: "grup oluştur ve seçili listeleri altına taşı" akışı oluşan
    // kanalın `key`'ini hemen kullanır (CMS Özel Listeler > Gruba Al).
    createMailChannel: build.mutation({
      query: (body) => ({ url: ENDPOINTS.email.channels, method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: [{ type: 'MailChannel', id: 'LIST' }],
    }),
    updateMailChannel: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.email.channel(id), method: 'PATCH', body }),
      invalidatesTags: [{ type: 'MailChannel', id: 'LIST' }],
    }),
    // `force: true` → listede üye olsa bile kalıcı sil (backend aksi halde arşivler).
    deleteMailChannel: build.mutation({
      query: (arg) => {
        const { id, force } = typeof arg === 'object' && arg !== null ? arg : { id: arg };
        return {
          url: ENDPOINTS.email.channel(id),
          method: 'DELETE',
          ...(force ? { params: { force: 'true' } } : {}),
        };
      },
      transformResponse: (res) => ({ ...(res?.data ?? {}), message: res?.message }),
      invalidatesTags: [{ type: 'MailChannel', id: 'LIST' }],
    }),

    // ── Liste üyeliği (karar #6) ──
    getChannelStats: build.query({
      query: (key) => ({ url: ENDPOINTS.email.channelStats(key) }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, key) => [{ type: 'MailChannelMember', id: key }],
    }),
    getChannelMembers: build.query({
      query: ({ key, ...params }) => ({ url: ENDPOINTS.email.channelMembers(key), params }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, { key }) => [{ type: 'MailChannelMember', id: key }],
    }),
    addChannelMembers: build.mutation({
      query: ({ key, ...body }) => ({ url: ENDPOINTS.email.channelMembers(key), method: 'POST', body }),
      // Zarfı aç: panel `added`/`suppressed`/`failed` sayaçlarını doğrudan okur.
      // (Önceden zarf açılmadığı için `r.added` hep undefined → "0 üye eklendi." idi.)
      transformResponse: (res) => ({ ...(res?.data ?? {}), message: res?.message }),
      invalidatesTags: (r, e, { key }) => [
        { type: 'MailChannelMember', id: key },
        { type: 'MailChannel', id: 'LIST' },
      ],
    }),
    // Üye güncelleme: profil bilgisi ve/veya kanal aboneliği
    // (channelStatus: 'subscribed' | 'unsubscribed' → çıkarma/geri alma).
    updateChannelMember: build.mutation({
      query: ({ key, ...body }) => ({
        url: ENDPOINTS.email.channelMembers(key),
        method: 'PATCH',
        body,
      }),
      transformResponse: (res) => res?.data ?? res,
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
    // Adresi GLOBAL bastırma listesine ekle (engelle) — tüm kanallardan çıkar.
    // Listeden çıkarmadan (removeChannelMember) farkı: kişi hiçbir listede
    // yeniden mail alamaz; reason "manual" (operatör aksiyonu) yazılır.
    blockSubscriber: build.mutation({
      query: ({ email, reason }) => ({
        url: ENDPOINTS.mailList.cmsSuppressions,
        method: 'POST',
        body: { email, reason: reason || 'manual' },
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
    // Demo/test gönderimi — şablonu her alıcı için gerçek token değerleriyle
    // ({{USER_NAME}} = profil ad+soyad) render edip gönderir. Kampanya gönderimiyle
    // aynı çözümleyici; kayıtlı şablon üzerinden çalışır.
    testSendMailTemplate: build.mutation({
      query: ({ id, to, from, sampleVars }) => ({
        url: ENDPOINTS.email.templateTestSend(id),
        method: 'POST',
        body: { to, ...(from ? { from } : {}), ...(sampleVars ? { sampleVars } : {}) },
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
    // Zamanlanmış yayın: draft → scheduled (startAt geldiğinde cron başlatır,
    // durationMinutes verilirse kitle o süreye eşit yayılır).
    scheduleMailCampaign: build.mutation({
      query: ({ id, startAt, durationMinutes }) => ({
        url: ENDPOINTS.email.campaignSchedule(id),
        method: 'POST',
        body: { startAt, durationMinutes },
      }),
      transformResponse: (res) => res?.data ?? res,
      // stats de invalidate edilir: getById 300 sn Redis cache'inden zamanlama
      // öncesi hâli göstermesin.
      invalidatesTags: (r, e, { id }) => [
        { type: 'EmailCampaign', id },
        { type: 'EmailCampaign', id: 'LIST' },
        { type: 'EmailCampaign', id: `${id}:stats` },
      ],
    }),
    unscheduleMailCampaign: build.mutation({
      query: (id) => ({ url: ENDPOINTS.email.campaignUnschedule(id), method: 'POST' }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, id) => [
        { type: 'EmailCampaign', id },
        { type: 'EmailCampaign', id: 'LIST' },
        { type: 'EmailCampaign', id: `${id}:stats` },
      ],
    }),
    pauseMailCampaign: build.mutation({
      query: (id) => ({ url: ENDPOINTS.email.campaignPause(id), method: 'POST' }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, id) => [
        { type: 'EmailCampaign', id },
        { type: 'EmailCampaign', id: 'LIST' },
        { type: 'EmailCampaign', id: `${id}:stats` },
      ],
    }),
    resumeMailCampaign: build.mutation({
      query: (id) => ({ url: ENDPOINTS.email.campaignResume(id), method: 'POST' }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, id) => [
        { type: 'EmailCampaign', id },
        { type: 'EmailCampaign', id: 'LIST' },
        { type: 'EmailCampaign', id: `${id}:stats` },
      ],
    }),
    // Kampanya önizlemesi — "önizlenen = gönderilen": şablon + konu override +
    // globalVars + gönderim anındaki header/footer chrome'u. `as` verilirse
    // token'lar o alıcının GERÇEK profil verisiyle çözülür (resolveEmailVars).
    previewMailCampaign: build.mutation({
      query: ({ id, as }) => ({
        url: ENDPOINTS.email.campaignPreview(id),
        method: 'POST',
        body: { ...(as ? { as } : {}) },
      }),
      transformResponse: (res) => res?.data ?? res,
    }),
    getMailCampaignStats: build.query({
      query: (id) => ENDPOINTS.email.campaignStats(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'EmailCampaign', id: `${id}:stats` }],
    }),
    // Dashboard: alıcı bazında açılma/tıklama listesi (sayfalı, engagement filtreli).
    getMailCampaignRecipients: build.query({
      query: ({ id, page = 1, limit = 25, engagement = 'all' }) => ({
        url: ENDPOINTS.email.campaignRecipients(id),
        params: { page, limit, engagement },
      }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, { id }) => [{ type: 'EmailCampaign', id: `${id}:recipients` }],
    }),
    // Dashboard: saatlik açılma/tıklama zaman serisi (grafik).
    getMailCampaignTimeSeries: build.query({
      query: (id) => ENDPOINTS.email.campaignTimeseries(id),
      transformResponse: (res) => res?.data?.points ?? [],
      providesTags: (r, e, id) => [{ type: 'EmailCampaign', id: `${id}:timeseries` }],
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

    // ── Merge değişken katalogu (admin) ──
    getMergeSources: build.query({
      query: () => ENDPOINTS.email.mergeSources,
      transformResponse: (res) => res?.data?.sources ?? [],
    }),
    getMergeDefs: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.email.mergeDefs, params }),
      transformResponse: (res) => res?.data?.items ?? res?.data ?? [],
      providesTags: [{ type: 'MergeVar', id: 'LIST' }],
    }),
    getMergeDef: build.query({
      query: (id) => ENDPOINTS.email.mergeDef(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'MergeVar', id }],
    }),
    createMergeDef: build.mutation({
      query: (body) => ({ url: ENDPOINTS.email.mergeDefs, method: 'POST', body }),
      invalidatesTags: [{ type: 'MergeVar', id: 'LIST' }],
    }),
    updateMergeDef: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.email.mergeDef(id), method: 'PATCH', body }),
      invalidatesTags: (r, e, { id }) => [
        { type: 'MergeVar', id },
        { type: 'MergeVar', id: 'LIST' },
      ],
    }),
    deleteMergeDef: build.mutation({
      query: (id) => ({ url: ENDPOINTS.email.mergeDef(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'MergeVar', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMailChannelsQuery,
  useCreateMailChannelMutation,
  useUpdateMailChannelMutation,
  useDeleteMailChannelMutation,
  useGetChannelStatsQuery,
  useGetChannelMembersQuery,
  useAddChannelMembersMutation,
  useUpdateChannelMemberMutation,
  useRemoveChannelMemberMutation,
  useBlockSubscriberMutation,
  useGetMailTemplatesQuery,
  useGetMailTemplateQuery,
  useCreateMailTemplateMutation,
  useUpdateMailTemplateMutation,
  useDeleteMailTemplateMutation,
  usePreviewMailTemplateMutation,
  useTestSendMailTemplateMutation,
  useGetMailCampaignsQuery,
  useGetMailCampaignQuery,
  useCreateMailCampaignMutation,
  useUpdateMailCampaignMutation,
  useDeleteMailCampaignMutation,
  useSendMailCampaignMutation,
  useScheduleMailCampaignMutation,
  useUnscheduleMailCampaignMutation,
  usePauseMailCampaignMutation,
  useResumeMailCampaignMutation,
  usePreviewMailCampaignMutation,
  useGetMailCampaignStatsQuery,
  useGetMailCampaignRecipientsQuery,
  useGetMailCampaignTimeSeriesQuery,
  useGetMergeVariablesQuery,
  useGetRecipientCountQuery,
  useLazyGetRecipientCountQuery,
  useGetMergeSourcesQuery,
  useGetMergeDefsQuery,
  useGetMergeDefQuery,
  useCreateMergeDefMutation,
  useUpdateMergeDefMutation,
  useDeleteMergeDefMutation,
} = mailCampaignApi;
