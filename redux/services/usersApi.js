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
    getUserSessions: build.query({
      query: (id) => ENDPOINTS.users.sessions(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'User', id: `sessions-${id}` }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useUpdateUserMutation,
  useGetUserSessionsQuery,
} = usersApi;
