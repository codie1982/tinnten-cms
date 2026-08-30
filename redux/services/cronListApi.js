'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * Cron listeleri (backend /email/cron-lists):
 *  - DB sorgusu (source + filters + relations) ile cron-kanalı mail-list besleyen
 *    "reçete" tanımları. Kaydedince backend cron-tipi kanal + tinnten-cron job oluşturur.
 *  - schema: FE sorgu kurucusu için beyaz-liste (kaynak/alan/operatör/ilişki).
 *  - preview: kaydetmeden eşleşen sayısı. run-now: hemen tetikle (async build).
 */
export const cronListApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCronListSchema: build.query({
      query: () => ENDPOINTS.email.cronListSchema,
      transformResponse: (res) => res?.data ?? res, // { sources, ops }
    }),
    getCronLists: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.email.cronLists, params }),
      transformResponse: (res) => res?.data ?? [],
      providesTags: [{ type: 'CronList', id: 'LIST' }],
    }),
    getCronList: build.query({
      query: (id) => ENDPOINTS.email.cronList(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'CronList', id }],
    }),
    createCronList: build.mutation({
      query: (body) => ({ url: ENDPOINTS.email.cronLists, method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: [{ type: 'CronList', id: 'LIST' }, { type: 'MailChannel', id: 'LIST' }],
    }),
    updateCronList: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.email.cronList(id), method: 'PATCH', body }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, { id }) => [
        { type: 'CronList', id },
        { type: 'CronList', id: 'LIST' },
        { type: 'MailChannel', id: 'LIST' },
      ],
    }),
    deleteCronList: build.mutation({
      query: (id) => ({ url: ENDPOINTS.email.cronList(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'CronList', id: 'LIST' }, { type: 'MailChannel', id: 'LIST' }],
    }),
    runCronList: build.mutation({
      query: (id) => ({ url: ENDPOINTS.email.cronListRun(id), method: 'POST' }),
      transformResponse: (res) => res?.data ?? res,
      // Tabloyu `getCronLists` besler ve o yalnız `id:'LIST'` tag'i sağlar; burada
      // sadece `{id}` invalidate edildiği için ▶ sonrası satır HİÇ tazelenmiyordu
      // → "Son üretim"/`lastError` sütunu eski kalıyor, başarısız build sessiz
      // görünüyordu. Build fire-and-forget olduğundan sonucun görünmesi için
      // birkaç saniye sonra tabloyu yenilemek gerekebilir.
      invalidatesTags: (r, e, id) => [
        { type: 'CronList', id },
        { type: 'CronList', id: 'LIST' },
        { type: 'MailChannel', id: 'LIST' },
      ],
    }),
    previewCronList: build.mutation({
      query: (body) => ({ url: ENDPOINTS.email.cronListPreview, method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res, // { count, capped }
    }),
    /**
     * Yazmasız test. `{ id }` → kayıtlı reçete; onun dışındaki gövde → formdaki
     * kaydedilmemiş taslak. Liste OLUŞTURMAZ, bu yüzden hiçbir tag invalidate
     * edilmez (aksi halde tablo boşuna yeniden çekilir).
     */
    dryRunCronList: build.mutation({
      // `cap` (tarama tavanı) QUERY STRING'e gider — backend onu req.query'den
      // okur, gövdeden değil. Gövdede kalırsa sessizce yok sayılır.
      query: ({ id, cap, ...body } = {}) => ({
        url: id ? ENDPOINTS.email.cronListDryRunById(id) : ENDPOINTS.email.cronListDryRun,
        method: 'POST',
        body: id ? {} : body,
        ...(cap ? { params: { cap } } : {}),
      }),
      transformResponse: (res) => res?.data ?? res,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCronListSchemaQuery,
  useGetCronListsQuery,
  useGetCronListQuery,
  useCreateCronListMutation,
  useUpdateCronListMutation,
  useDeleteCronListMutation,
  useRunCronListMutation,
  usePreviewCronListMutation,
  useDryRunCronListMutation,
} = cronListApi;
