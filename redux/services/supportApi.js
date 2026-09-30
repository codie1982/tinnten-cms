'use client';

import { ENDPOINTS } from '@/config/api';
import { baseApi } from './baseApi';

/**
 * Destek masası CMS servisi — tek talep kuyruğu, detay, yanıt/iç not, durum,
 * atama ve talebin üzerindeki telefonla iletişim durumu.
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
              ...result.tickets.map((t) => ({
                type: 'SupportTicket',
                id: t._id || t.id,
              })),
              { type: 'SupportTicket', id: 'LIST' },
            ]
          : [{ type: 'SupportTicket', id: 'LIST' }],
    }),

    getSupportTicket: build.query({
      query: (id) => ENDPOINTS.support.cmsTicketDetail(id),
      transformResponse: (res) =>
        (res?.data ?? res)?.ticket ?? res?.data ?? res,
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
      query: ({ id, status, note, closeReason }) => ({
        url: ENDPOINTS.support.cmsTicketStatus(id),
        method: 'PATCH',
        body: {
          status,
          ...(note ? { note } : {}),
          ...(closeReason ? { closeReason } : {}),
        },
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
    accessSupportTicketContact: build.mutation({
      query: ({ id, action = 'view' }) => ({
        url: ENDPOINTS.support.cmsTicketContactAccess(id),
        method: 'POST',
        body: { action },
      }),
      transformResponse: (res) => (res?.data ?? res)?.contact ?? res?.data ?? res,
    }),

    updateSupportTicketCallback: build.mutation({
      query: ({ id, status, startsAt, endsAt, outcome }) => ({
        url: ENDPOINTS.support.cmsTicketCallback(id),
        method: 'PATCH',
        body: {
          status,
          ...(startsAt ? { startsAt } : {}),
          ...(endsAt ? { endsAt } : {}),
          ...(outcome ? { outcome } : {}),
        },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, { id }) => [
        { type: 'SupportTicket', id },
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
  useAccessSupportTicketContactMutation,
  useUpdateSupportTicketCallbackMutation,
} = supportApi;
