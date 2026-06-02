'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/** Firmalar & firma onayları (KYC) API servisi. */
export const companiesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCompanies: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.companies.list, params }), // { status, type, membership, query, limit, skip }
      transformResponse: (res) => res?.data ?? res,
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((c) => ({ type: 'Company', id: c._id ?? c.id })),
              { type: 'Company', id: 'LIST' },
            ]
          : [{ type: 'Company', id: 'LIST' }],
    }),
    getCompany: build.query({
      query: (id) => ENDPOINTS.companies.detail(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'Company', id }],
    }),
    updateCompany: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.companies.update(id), method: 'PATCH', body }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Company', id }, { type: 'Company', id: 'LIST' }],
    }),
    updateCompanyLimits: build.mutation({
      query: ({ id, limits }) => ({ url: ENDPOINTS.companies.limits(id), method: 'PATCH', body: { limits } }),
      transformResponse: (res) => res?.data ?? res, // { limitUsage }
      invalidatesTags: (r, e, { id }) => [{ type: 'Company', id }],
    }),
    updateCompanyUsage: build.mutation({
      query: ({ id, usage }) => ({ url: ENDPOINTS.companies.usage(id), method: 'PATCH', body: { usage } }),
      transformResponse: (res) => res?.data ?? res, // { limitUsage }
      invalidatesTags: (r, e, { id }) => [{ type: 'Company', id }],
    }),
    resetCompanyUsage: build.mutation({
      query: ({ id }) => ({ url: ENDPOINTS.companies.usageReset(id), method: 'POST' }),
      transformResponse: (res) => res?.data ?? res, // { limitUsage }
      invalidatesTags: (r, e, { id }) => [{ type: 'Company', id }],
    }),
    setCompanyAdminActive: build.mutation({
      query: ({ id, active, reason }) => ({
        url: ENDPOINTS.companies.adminActive(id),
        method: 'PATCH',
        body: { active, ...(reason ? { reason } : {}) },
      }),
      transformResponse: (res) => res?.data ?? res, // { adminActive, adminActiveAt, adminActiveReason, status }
      invalidatesTags: (r, e, { id }) => [{ type: 'Company', id }, { type: 'Company', id: 'LIST' }],
    }),
    approveCompany: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.companies.approve(id), method: 'POST', body }),
      invalidatesTags: (r, e, { id }) => [
        { type: 'Company', id },
        { type: 'Company', id: 'LIST' },
        { type: 'CompanyApproval', id: 'LIST' },
      ],
    }),
    rejectCompany: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.companies.reject(id), method: 'POST', body }),
      invalidatesTags: (r, e, { id }) => [
        { type: 'Company', id },
        { type: 'CompanyApproval', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCompaniesQuery,
  useGetCompanyQuery,
  useUpdateCompanyMutation,
  useUpdateCompanyLimitsMutation,
  useUpdateCompanyUsageMutation,
  useResetCompanyUsageMutation,
  useSetCompanyAdminActiveMutation,
  useApproveCompanyMutation,
  useRejectCompanyMutation,
} = companiesApi;
