'use client';

import { ENDPOINTS } from '@/config/api';
import { baseApi } from './baseApi';

/**
 * Partner Programı ön başvuruları — CMS servisi.
 *
 * ⚠️ `transformResponse` ZORUNLU: backend her yanıtı `ApiResponse` ile
 * `{ status, message, data }` içine sarar. Yazılmazsa `data.applications`
 * daima `undefined` gelir.
 *
 * Public form anonimdir; listedeki kayıtların bir kullanıcı hesabı yoktur.
 * `meta.ip` / `userAgent` gibi kötüye kullanım alanlarını backend zaten
 * `select` ile düşürür, bu yüzden burada ayrıca maskeleme yapılmaz.
 */
export const partnerApplicationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPartnerApplications: build.query({
      // params: { status, partnerType, search, limit, cursor }
      query: (params = {}) => ({
        url: ENDPOINTS.partner.cmsApplications,
        params,
      }),
      transformResponse: (res) => res?.data ?? res, // { applications, nextCursor }
      providesTags: (result) =>
        result?.applications
          ? [
              ...result.applications.map((a) => ({
                type: 'PartnerApplication',
                id: a._id || a.id,
              })),
              { type: 'PartnerApplication', id: 'LIST' },
            ]
          : [{ type: 'PartnerApplication', id: 'LIST' }],
    }),

    updatePartnerApplicationStatus: build.mutation({
      query: ({ id, status, note }) => ({
        url: ENDPOINTS.partner.cmsApplicationStatus(id),
        method: 'PATCH',
        body: { status, note },
      }),
      transformResponse: (res) => res?.data ?? res,
      // Satır + LIST birlikte invalidate edilir: durum değişimi listenin
      // aktif durum filtresinden düşmesine yol açabiliyor.
      invalidatesTags: (result, error, { id }) => [
        { type: 'PartnerApplication', id },
        { type: 'PartnerApplication', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetPartnerApplicationsQuery,
  useUpdatePartnerApplicationStatusMutation,
} = partnerApplicationsApi;
