'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/** Kullanıcı yönetimi API servisi. */
export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.users.list, params }), // { status, query, limit, skip }
      transformResponse: (res) => res?.data ?? res,
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((u) => ({ type: 'User', id: u._id ?? u.id })),
              { type: 'User', id: 'LIST' },
            ]
          : [{ type: 'User', id: 'LIST' }],
    }),
    getUser: build.query({
      query: (id) => ENDPOINTS.users.detail(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'User', id }],
    }),
    updateUser: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.users.update(id), method: 'PATCH', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'User', id }, { type: 'User', id: 'LIST' }],
    }),
    resetUserPassword: build.mutation({
      query: (id) => ({ url: ENDPOINTS.users.resetPassword(id), method: 'POST' }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, id) => [{ type: 'User', id }, { type: 'User', id: 'LIST' }],
    }),
    getUserSessions: build.query({
      query: (id) => ENDPOINTS.users.sessions(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'User', id: `sessions-${id}` }],
    }),
    getUserAccount: build.query({
      query: (id) => ENDPOINTS.users.account(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'User', id: `account-${id}` }],
    }),
    getUserConversations: build.query({
      query: ({ id, ...params }) => ({ url: ENDPOINTS.users.conversations(id), params }), // { page, limit }
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, { id }) => [{ type: 'User', id: `conversations-${id}` }],
    }),
    updateUserAccountLimits: build.mutation({
      query: ({ id, limits }) => ({ url: ENDPOINTS.users.accountLimits(id), method: 'PATCH', body: { limits } }),
      transformResponse: (res) => res?.data ?? res, // { limitUsage }
      invalidatesTags: (r, e, { id }) => [{ type: 'User', id: `account-${id}` }],
    }),
    updateUserAccountUsage: build.mutation({
      query: ({ id, usage }) => ({ url: ENDPOINTS.users.accountUsage(id), method: 'PATCH', body: { usage } }),
      transformResponse: (res) => res?.data ?? res, // { limitUsage }
      invalidatesTags: (r, e, { id }) => [{ type: 'User', id: `account-${id}` }],
    }),
    resetUserAccountUsage: build.mutation({
      query: ({ id }) => ({ url: ENDPOINTS.users.accountUsageReset(id), method: 'POST' }),
      transformResponse: (res) => res?.data ?? res, // { limitUsage }
      invalidatesTags: (r, e, { id }) => [{ type: 'User', id: `account-${id}` }],
    }),
    getAllSessions: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.users.sessionsAll, params }), // { page, limit }
      transformResponse: (res) => res?.data ?? res,
      providesTags: [{ type: 'User', id: 'SESSIONS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useUpdateUserMutation,
  useResetUserPasswordMutation,
  useGetUserSessionsQuery,
  useGetUserAccountQuery,
  useGetUserConversationsQuery,
  useGetAllSessionsQuery,
  useUpdateUserAccountLimitsMutation,
  useUpdateUserAccountUsageMutation,
  useResetUserAccountUsageMutation,
} = usersApi;
