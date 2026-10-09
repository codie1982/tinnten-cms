'use client';

import { ENDPOINTS } from '@/config/api';
import { baseApi } from './baseApi';

export const partnerServicesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCmsPartnerServicePackages: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.companyPartners.cmsServicePackages, params }),
      transformResponse: (response) => response?.data ?? response,
      providesTags: (result) => result?.items
        ? [...result.items.map((item) => ({ type: 'PartnerServicePackage', id: item.id || item._id })), { type: 'PartnerServicePackage', id: 'LIST' }]
        : [{ type: 'PartnerServicePackage', id: 'LIST' }],
    }),
    archiveCmsPartnerServicePackage: build.mutation({
      query: (id) => ({ url: ENDPOINTS.companyPartners.cmsServicePackageArchive(id), method: 'POST' }),
      invalidatesTags: (result, error, id) => [{ type: 'PartnerServicePackage', id }, { type: 'PartnerServicePackage', id: 'LIST' }],
    }),
    getCmsPartnerServiceAgreements: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.companyPartners.cmsServiceAgreements, params }),
      transformResponse: (response) => response?.data ?? response,
      providesTags: [{ type: 'PartnerServiceAgreement', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetCmsPartnerServicePackagesQuery,
  useArchiveCmsPartnerServicePackageMutation,
  useGetCmsPartnerServiceAgreementsQuery,
} = partnerServicesApi;
