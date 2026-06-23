'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/** Sistem ayarları — genel tool tanımları ve sistem paketleri (salt-okunur listeler). */
export const settingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getToolDefinitions: build.query({
      query: () => ENDPOINTS.assistants.cmsToolList,
      transformResponse: (res) => (res?.data ?? res)?.items ?? [],
      providesTags: [{ type: 'Assistant', id: 'TOOLS' }],
    }),
    getSystemPackages: build.query({
      query: () => ENDPOINTS.systemPackages.list,
      transformResponse: (res) => {
        const d = res?.data ?? res;
        return Array.isArray(d) ? d : d?.items ?? [];
      },
      providesTags: [{ type: 'Assistant', id: 'PACKAGES' }],
    }),

    // ── Paket yönetimi (CMS, ham veri) ──
    getCmsPackages: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.systemPackages.cmsList, params }), // { forCompany, status }
      transformResponse: (res) => (res?.data ?? res)?.items ?? [],
      providesTags: [{ type: 'Package', id: 'LIST' }],
    }),
    getCmsPackage: build.query({
      query: (id) => ENDPOINTS.systemPackages.cmsDetail(id),
      transformResponse: (res) => (res?.data ?? res)?.package ?? null,
      providesTags: (r, e, id) => [{ type: 'Package', id }],
    }),
    createPackage: build.mutation({
      query: (body) => ({ url: ENDPOINTS.systemPackages.cmsCreate, method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: [{ type: 'Package', id: 'LIST' }],
    }),
    updatePackage: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.systemPackages.cmsUpdate(id), method: 'PUT', body }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, { id }) => [{ type: 'Package', id }, { type: 'Package', id: 'LIST' }],
    }),
    deletePackage: build.mutation({
      query: (id) => ({ url: ENDPOINTS.systemPackages.cmsDelete(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'Package', id: 'LIST' }],
    }),
    assignPrivatePackage: build.mutation({
      query: ({ id, companyId }) => ({ url: ENDPOINTS.systemPackages.assignToCompany(id), method: 'POST', body: { companyId } }),
      transformResponse: (res) => res?.data ?? res,
      invalidatesTags: (r, e, { id }) => [{ type: 'Package', id }, { type: 'Package', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetToolDefinitionsQuery,
  useGetSystemPackagesQuery,
  useGetCmsPackagesQuery,
  useGetCmsPackageQuery,
  useCreatePackageMutation,
  useUpdatePackageMutation,
  useDeletePackageMutation,
  useAssignPrivatePackageMutation,
} = settingsApi;
