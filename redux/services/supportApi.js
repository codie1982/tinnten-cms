'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * Destek masası CMS servisi — talep kuyruğu, detay, yanıt/iç not, durum, atama
 * ve geri arama kuyruğu.
 *
 * ⚠️ `transformResponse` ZORUNLU: backend her yanıtı `ApiResponse` ile
 * `{ status, message, data }` içine sarar. Yazılmazsa `data.items` daima
 * `undefined` gelir.
 *
 * ⚠️ CMS uçları HAM doküman döndürür (kullanıcı presenter'ından geçmez) —
 * `internalNotes`, `history[].actor`, `assignedTo` burada GÖRÜNÜR ve bu
 * kasıtlıdır. Bu verinin kullanıcı arayüzüne sızmaması, ekranların yalnız
 * CMS içinde kalmasıyla sağlanır.
 */
export const supportApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ── Talepler ────────────────────────────────────────────────────────────
    getSupportTickets: build.query({
      // params: { status, priority, category, companyid, assignedTo, q, limit, cursor }
      query: (params = {}) => ({ url: ENDPOINTS.support.cmsTickets, params }),
      transformResponse: (res) => res?.data ?? res, // { tickets, nextCursor }
      providesTags: (result) =>
        result?.tickets
          ? [
              ...result.tickets.map((t) => ({ type: 'SupportTicket', id: t._id || t.id })),
              { type: 'SupportTicket', id: 'LIST' },
            ]
          : [{ type: 'SupportTicket', id: 'LIST' }],
    }),

    getSupportTicket: build.query({
      query: (id) => ENDPOINTS.support.cmsTicketDetail(id),
      transformResponse: (res) => (res?.data ?? res)?.ticket ?? res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'SupportTicket', id }],
    }),

    /**
     * Yanıt veya iç not.
     *
     * `visibility` ZORUNLU parametre olarak geçirilir — varsayılan YOKTUR.
     * Gerekçe: sessiz bir varsayılan, iç notun müşteriye gitmesi riskini
     * taşır. Arayüz de kullanıcıyı açık seçime zorlar.
     */
    replySupportTicket: build.mutation({
      query: ({ id, body, visibility }) => ({
        url: ENDPOINTS.support.cmsTicketReply(id),
        method: 'POST',
        body: { body, visibility },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, { id }) => [
        { type: 'SupportTicket', id },
        { type: 'SupportTicket', id: 'LIST' },
      ],
    }),

    updateSupportTicketStatus: build.mutation({
      query: ({ id, status, closeReason }) => ({
        url: ENDPOINTS.support.cmsTicketStatus(id),
        method: 'PATCH',
        body: { status, closeReason },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, { id }) => [
        { type: 'SupportTicket', id },
        { type: 'SupportTicket', id: 'LIST' },
      ],
    }),

    assignSupportTicket: build.mutation({
      query: ({ id, assignedTo, assignedTeam, priority }) => ({
        url: ENDPOINTS.support.cmsTicketAssign(id),
        method: 'PATCH',
        body: { assignedTo, assignedTeam, priority },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, { id }) => [
        { type: 'SupportTicket', id },
        { type: 'SupportTicket', id: 'LIST' },
      ],
    }),

    // ── Geri arama kuyruğu ──────────────────────────────────────────────────
    getSupportCallbacks: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.support.cmsCallbacks, params }),
      transformResponse: (res) => (res?.data ?? res)?.callbacks ?? [],
      providesTags: (result) =>
        Array.isArray(result)
          ? [
              ...result.map((c) => ({ type: 'SupportCallback', id: c._id || c.id })),
              { type: 'SupportCallback', id: 'LIST' },
            ]
          : [{ type: 'SupportCallback', id: 'LIST' }],
    }),

    confirmSupportCallback: build.mutation({
      query: ({ id, startsAt, endsAt, note }) => ({
        url: ENDPOINTS.support.cmsCallbackConfirm(id),
        method: 'PATCH',
        body: { startsAt, endsAt, note },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, { id }) => [
        { type: 'SupportCallback', id },
        { type: 'SupportCallback', id: 'LIST' },
      ],
    }),

    recordSupportCallbackOutcome: build.mutation({
      query: ({ id, result, outcome }) => ({
        url: ENDPOINTS.support.cmsCallbackOutcome(id),
        method: 'PATCH',
        body: { result, outcome },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, { id }) => [
        { type: 'SupportCallback', id },
        { type: 'SupportCallback', id: 'LIST' },
        // Görüşme tamamlandığında backend bağlı talebi `resolved` yapıyor —
        // talep listesi de tazelenmeli.
        { type: 'SupportTicket', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSupportTicketsQuery,
  useGetSupportTicketQuery,
  useReplySupportTicketMutation,
  useUpdateSupportTicketStatusMutation,
  useAssignSupportTicketMutation,
  useGetSupportCallbacksQuery,
  useConfirmSupportCallbackMutation,
  useRecordSupportCallbackOutcomeMutation,
} = supportApi;
