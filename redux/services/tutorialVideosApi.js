'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/** Ekran kaydı eğitim videoları — yalnız cms:admin yönetebilir. */
export const tutorialVideosApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCmsTutorialVideos: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.tutorialVideos.cmsList, params }),
      transformResponse: (res) => res?.data ?? res ?? { items: [], pagination: null },
      providesTags: (result) => {
        const items = Array.isArray(result?.items) ? result.items : [];
        return [
          ...items.map((item) => ({ type: 'TutorialVideo', id: item.id })),
          { type: 'TutorialVideo', id: 'LIST' },
        ];
      },
    }),
    getCmsTutorialVideo: build.query({
      query: (id) => ({ url: ENDPOINTS.tutorialVideos.cmsDetail(id) }),
      transformResponse: (res) => (res?.data ?? res)?.tutorialVideo ?? null,
      providesTags: (_result, _error, id) => [{ type: 'TutorialVideo', id }],
    }),
    createTutorialVideo: build.mutation({
      query: (body) => ({ url: ENDPOINTS.tutorialVideos.create, method: 'POST', body }),
      transformResponse: (res) => (res?.data ?? res)?.tutorialVideo ?? null,
      invalidatesTags: [{ type: 'TutorialVideo', id: 'LIST' }],
    }),
    updateTutorialVideo: build.mutation({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.tutorialVideos.update(id), method: 'PATCH', body }),
      transformResponse: (res) => (res?.data ?? res)?.tutorialVideo ?? null,
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'TutorialVideo', id },
        { type: 'TutorialVideo', id: 'LIST' },
      ],
    }),
    deleteTutorialVideo: build.mutation({
      query: (id) => ({ url: ENDPOINTS.tutorialVideos.remove(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'TutorialVideo', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCmsTutorialVideosQuery,
  useGetCmsTutorialVideoQuery,
  useCreateTutorialVideoMutation,
  useUpdateTutorialVideoMutation,
  useDeleteTutorialVideoMutation,
} = tutorialVideosApi;
