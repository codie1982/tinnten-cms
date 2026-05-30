'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/** Sözleşmeler (legal agreements) CMS servisi — liste, versiyonlar, taslak, yayın, onaylayanlar. */
export const legalApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAgreements: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.legal.cmsList, params }), // { locale }
      transformResponse: (res) => (res?.data ?? res)?.items ?? [],
      providesTags: [{ type: 'Contract', id: 'LIST' }],
    }),
    getAgreement: build.query({
      query: ({ slug, locale }) => ({ url: ENDPOINTS.legal.cmsDetail(slug), params: { locale } }),
      transformResponse: (res) => res?.data ?? res, // { slug, locale, title, versions }
      providesTags: (r, e, { slug }) => [{ type: 'Contract', id: slug }],
    }),
    getAcceptances: build.query({
      query: ({ slug }) => ENDPOINTS.legal.cmsAcceptances(slug),
      transformResponse: (res) => res?.data ?? res, // { slug, total, versions }
      providesTags: (r, e, { slug }) => [{ type: 'Contract', id: `acc-${slug}` }],
    }),
    saveAgreementDraft: build.mutation({
      query: (body) => ({ url: ENDPOINTS.legal.cmsSave, method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, body) => [{ type: 'Contract', id: body.slug }, { type: 'Contract', id: 'LIST' }],
    }),
    publishAgreement: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.legal.cmsPublish(id), method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res, // { agreement, notified }
      invalidatesTags: (r, e, { slug }) => [
        { type: 'Contract', id: slug },
        { type: 'Contract', id: 'LIST' },
        ...(slug ? [{ type: 'Contract', id: `acc-${slug}` }] : []),
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAgreementsQuery,
  useGetAgreementQuery,
  useGetAcceptancesQuery,
  useSaveAgreementDraftMutation,
  usePublishAgreementMutation,
} = legalApi;
