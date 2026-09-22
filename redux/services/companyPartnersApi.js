'use client';

import { ENDPOINTS } from '@/config/api';
import { baseApi } from './baseApi';

export const companyPartnersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
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
    decideCompanyPartnerRelation: build.mutation({
      query: ({ id, decision, note = '' }) => ({
        url: ENDPOINTS.companyPartners.cmsDecision(id),
        method: 'PATCH',
        body: { decision, note },
      }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (result, error, { id }) => [
        { type: 'PartnerRelation', id },
        { type: 'PartnerRelation', id: 'LIST' },
        { type: 'User', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetPendingCompanyPartnerRelationsQuery,
  useDecideCompanyPartnerRelationMutation,
} = companyPartnersApi;
