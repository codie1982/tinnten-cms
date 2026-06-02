import { baseApi } from './baseApi';

const ALL_LOCALES = ['tr', 'en', 'de', 'ar', 'el', 'es', 'fr', 'it', 'ru'];

/**
 * Çeviri API servisi.
 *
 * Kullanım:
 *   const [translate, { isLoading }] = useTranslateMutation();
 *   const result = await translate({ text: 'Merhaba', locales: ['en', 'de'] }).unwrap();
 *   // result.translations → { en: 'Hello', de: 'Hallo' }
 */
export const translationApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    translate: build.mutation({
      query: ({ text, locales = ALL_LOCALES, context = '' }) => ({
        url: '/translate',
        method: 'POST',
        body: { text, locales, context },
      }),
      transformResponse: (res) => res?.data ?? res,
    }),
  }),
  overrideExisting: false,
});

export const { useTranslateMutation } = translationApi;
