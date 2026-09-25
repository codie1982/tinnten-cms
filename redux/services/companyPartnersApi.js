'use client';

import { ENDPOINTS } from '@/config/api';
import { baseApi } from './baseApi';

export const companyPartnersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCmsEligiblePartners: build.query({
      query: (params) => ({
        url: ENDPOINTS.companyPartners.cmsEligible,
        params,
      }),
      transformResponse: (res) => res?.data ?? res,
    }),
    assignCmsCompanyPartner: build.mutation({
      query: (body) => ({
        url: ENDPOINTS.companyPartners.cmsAssign,
        method: 'POST',
        body,
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { companyId, partnerCompanyId, partnerUserIds = [] }) => [
        { type: 'PartnerRelation', id: 'LIST' },
        { type: 'Company', id: companyId },
        ...(partnerCompanyId ? [{ type: 'Company', id: partnerCompanyId }] : []),
        { type: 'Company', id: 'LIST' },
        ...partnerUserIds.map((id) => ({ type: 'User', id })),
      ],
    }),
    updateCmsCompanyPartnerEligibility: build.mutation({
      query: ({ id, partner, note = '' }) => ({
        url: ENDPOINTS.companyPartners.cmsCompanyEligibility(id),
        method: 'PATCH',
        body: { partner, note },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Company', id },
        { type: 'Company', id: 'LIST' },
        { type: 'PartnerRelation', id: 'LIST' },
      ],
    }),
    getPendingCompanyPartnerRelations: build.query({
      query: (params = {}) => ({
        url: ENDPOINTS.companyPartners.cmsPending,
        params,
      }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (result) => [
        ...(result?.items ?? []).map((item) => ({
          type: 'PartnerRelation',
          id: item.id || item._id,
        })),
        { type: 'PartnerRelation', id: 'LIST' },
      ],
    }),
    getCompanyPartnerRevenueSharePreview: build.query({
      query: ({ commissionPercent, costPercent, grossAmount = 1000, currency = 'USD' }) => ({
        url: ENDPOINTS.companyPartners.cmsRevenueSharePreview,
        params: { commissionPercent, costPercent, grossAmount, currency },
      }),
      transformResponse: (res) => res?.data ?? res,
    }),
    decideCompanyPartnerRelation: build.mutation({
      query: ({ id, decision, note = '', capabilities, revenueSharePercent, revenueShareCostPercent }) => ({
        url: ENDPOINTS.companyPartners.cmsDecision(id),
        method: 'PATCH',
        body: {
          decision,
          note,
          ...(capabilities ? { capabilities } : {}),
          ...(revenueSharePercent !== undefined ? { revenueSharePercent } : {}),
          ...(revenueShareCostPercent !== undefined ? { revenueShareCostPercent } : {}),
        },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'PartnerRelation', id },
        { type: 'PartnerRelation', id: 'LIST' },
        { type: 'User', id: 'LIST' },
      ],
    }),
    updateCompanyPartnerCapabilities: build.mutation({
      query: ({ id, canEarnRevenue, revenueSharePercent, revenueShareCostPercent }) => ({
        url: ENDPOINTS.companyPartners.cmsCapabilities(id),
        method: 'PATCH',
        body: {
          capabilities: {
            canManageAccount: true,
            canEarnRevenue,
          },
          ...(revenueSharePercent !== undefined ? { revenueSharePercent } : {}),
          ...(revenueShareCostPercent !== undefined ? { revenueShareCostPercent } : {}),
        },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'PartnerRelation', id },
        { type: 'PartnerRelation', id: 'LIST' },
        { type: 'User', id: 'LIST' },
      ],
    }),
    removeCompanyPartnerRelation: build.mutation({
      query: ({ id, note = '' }) => ({
        url: ENDPOINTS.companyPartners.cmsRemove(id),
        method: 'DELETE',
        body: { note },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'PartnerRelation', id },
        { type: 'PartnerRelation', id: 'LIST' },
        { type: 'Company', id: 'LIST' },
        { type: 'User', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetCmsEligiblePartnersQuery,
  useAssignCmsCompanyPartnerMutation,
  useUpdateCmsCompanyPartnerEligibilityMutation,
  useGetPendingCompanyPartnerRelationsQuery,
  useGetCompanyPartnerRevenueSharePreviewQuery,
  useDecideCompanyPartnerRelationMutation,
  useUpdateCompanyPartnerCapabilitiesMutation,
  useRemoveCompanyPartnerRelationMutation,
} = companyPartnersApi;
