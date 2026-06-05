'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * Haber içerikleri (news-content) API servisi.
 * baseApi'ye endpoint enjekte eder; otomatik hook'lar üretir.
 *
 * Kullanım (sayfa içinde):
 *   const { data, isLoading } = useGetNewsListQuery({ status: 'all' });
 *   const [createNews] = useCreateNewsMutation();
 */
export const newsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /* ─── Liste ─── */
    getNewsList: build.query({
      query: (params = {}) => ({
        url: ENDPOINTS.news.list,
        params, // { status, categoryId, limit, skip, query }
      }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((n) => ({ type: 'News', id: n._id ?? n.id })),
              { type: 'News', id: 'LIST' },
            ]
          : [{ type: 'News', id: 'LIST' }],
    }),

    /* ─── Detay ─── */
    getNews: build.query({
      query: (id) => ENDPOINTS.news.detail(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'News', id }],
    }),

    /* ─── Oluştur ─── */
    createNews: build.mutation({
      query: (body) => ({ url: ENDPOINTS.news.create, method: 'POST', body }),
      invalidatesTags: [{ type: 'News', id: 'LIST' }],
    }),

    /* ─── Güncelle ─── */
    updateNews: build.mutation({
      query: ({ id, ...body }) => ({
        url: ENDPOINTS.news.update(id),
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (r, e, { id }) => [{ type: 'News', id }, { type: 'News', id: 'LIST' }],
    }),

    /* ─── Sil ─── */
    deleteNews: build.mutation({
      query: (id) => ({ url: ENDPOINTS.news.remove(id), method: 'DELETE' }),
      invalidatesTags: [{ type: 'News', id: 'LIST' }],
    }),

    /* ─── Yayınla / Taslağa al ─── */
    publishNews: build.mutation({
      query: (id) => ({ url: ENDPOINTS.news.publish(id), method: 'POST' }),
      invalidatesTags: (r, e, id) => [{ type: 'News', id }, { type: 'News', id: 'LIST' }],
    }),
    unpublishNews: build.mutation({
      query: (id) => ({ url: ENDPOINTS.news.unpublish(id), method: 'POST' }),
      invalidatesTags: (r, e, id) => [{ type: 'News', id }, { type: 'News', id: 'LIST' }],
    }),

    /* ─── AI ile içerik üret (async, 202) ─── */
    generateNews: build.mutation({
      query: (body) => ({ url: ENDPOINTS.news.generate, method: 'POST', body }),
      transformResponse: (res) => res?.data ?? res, // { status, mode, pid, jobId }
      invalidatesTags: [{ type: 'News', id: 'LIST' }],
    }),

    /* ─── Üretim işleri (canlı takip) ─── */
    getNewsJobs: build.query({
      query: (params = {}) => ({ url: ENDPOINTS.news.jobs, params }),
      transformResponse: (res) => (res?.data ?? res)?.items ?? [],
    }),
    getNewsJob: build.query({
      query: (id) => ENDPOINTS.news.job(id),
      transformResponse: (res) => res?.data ?? res, // { status, counts, social, indexNow, logs, ... }
    }),

    /* ─── Görsel yönetimi ─── */
    attachNewsImage: build.mutation({
      query: ({ id, imageId }) => ({ url: ENDPOINTS.news.images(id), method: 'POST', body: { imageId } }),
      invalidatesTags: (r, e, { id }) => [{ type: 'News', id }],
    }),
    detachNewsImage: build.mutation({
      query: ({ id, imageId }) => ({ url: ENDPOINTS.news.image(id, imageId), method: 'DELETE' }),
      invalidatesTags: (r, e, { id }) => [{ type: 'News', id }],
    }),
    setNewsCover: build.mutation({
      query: ({ id, imageUrl }) => ({ url: ENDPOINTS.news.cover(id), method: 'PATCH', body: { imageUrl } }),
      invalidatesTags: (r, e, { id }) => [{ type: 'News', id }],
    }),
    clearNewsCover: build.mutation({
      query: ({ id }) => ({ url: ENDPOINTS.news.cover(id), method: 'DELETE' }),
      invalidatesTags: (r, e, { id }) => [{ type: 'News', id }],
    }),
    generateNewsAiImage: build.mutation({
      query: ({ id, prompt, size }) => ({ url: ENDPOINTS.news.aiImage(id), method: 'POST', body: { prompt, ...(size ? { size } : {}) } }),
      transformResponse: (res) => res?.data ?? res, // { imageId, url, revisedPrompt }
      // Not: makale dokümanını değiştirmez (sadece görsel üretip URL döner; URL yerel forma uygulanır).
      // Detay tag'ini invalidate ETMİYORUZ — yoksa getNews refetch edilip useEffect formu
      // sunucu değerlerine resetler ve henüz kaydedilmemiş düzenlemeleri (yeni görsel dahil) siler.
    }),
    reorderNewsImages: build.mutation({
      query: ({ id, coverImages }) => ({ url: ENDPOINTS.news.update(id), method: 'PATCH', body: { coverImages } }),
      invalidatesTags: (r, e, { id }) => [{ type: 'News', id }],
    }),

    /* ─── Sosyal medya paylaşımları ─── */
    getSocialPosts: build.query({
      query: (id) => ENDPOINTS.news.socialPosts(id),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (r, e, id) => [{ type: 'News', id: `social-${id}` }],
    }),
    createSocialPost: build.mutation({
      query: ({ id, ...body }) => ({
        url: ENDPOINTS.news.socialPosts(id),
        method: 'POST',
        body,
      }),
      invalidatesTags: (r, e, { id }) => [{ type: 'News', id: `social-${id}` }],
    }),
    deleteSocialPost: build.mutation({
      query: ({ id, postId }) => ({ url: ENDPOINTS.news.socialPost(id, postId), method: 'DELETE' }),
      invalidatesTags: (r, e, { id }) => [{ type: 'News', id: `social-${id}` }],
    }),
    requeueSocialPost: build.mutation({
      query: ({ id, postId }) => ({ url: ENDPOINTS.news.socialPostRequeue(id, postId), method: 'POST' }),
      invalidatesTags: (r, e, { id }) => [{ type: 'News', id: `social-${id}` }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetNewsListQuery,
  useGetNewsQuery,
  useCreateNewsMutation,
  useUpdateNewsMutation,
  useDeleteNewsMutation,
  usePublishNewsMutation,
  useUnpublishNewsMutation,
  useGenerateNewsMutation,
  useGetNewsJobsQuery,
  useGetNewsJobQuery,
  useAttachNewsImageMutation,
  useDetachNewsImageMutation,
  useSetNewsCoverMutation,
  useClearNewsCoverMutation,
  useGenerateNewsAiImageMutation,
  useReorderNewsImagesMutation,
  useGetSocialPostsQuery,
  useCreateSocialPostMutation,
  useDeleteSocialPostMutation,
  useRequeueSocialPostMutation,
} = newsApi;
