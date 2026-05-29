# API Altyapısı (RTK Query)

CMS'in backend (`tinnten-server`) ile konuşan veri katmanı. **RTK Query** üzerine kuruludur:
otomatik cache, hook üretimi, token enjeksiyonu ve hata normalizasyonu.

## Base URL

Tek doğruluk kaynağı: `config/api.js` → `API_BASE_URL`
```
http://localhost:5001/api/v10   (varsayılan)
```
`.env.local` içindeki `NEXT_PUBLIC_BACKEND_URL` ile override edilir. Hem axios
(`lib/http.js`) hem RTK Query (`baseApi`) bu değeri kullanır.

## Mimari

```
config/api.js              → API_BASE_URL + ENDPOINTS (tüm yollar tek yerde)
redux/services/baseApi.js  → createApi: baseQuery, token, tagTypes
redux/services/*Api.js     → injectEndpoints ile kaynak servisleri + hook'lar
redux/store.js             → baseApi.reducer + baseApi.middleware bağlı
lib/useSyncAuthToken.js    → NextAuth session token'ını istemcilere senkronize eder
```

Token akışı: NextAuth oturumu → `useSyncAuthToken` → in-memory store (`lib/authToken.js`)
→ `baseApi` her isteğe `Authorization: Bearer <token>` ekler.

## Kullanım

### Veri okuma (query)
```jsx
'use client';
import { useGetNewsListQuery } from '@/redux/services';

export default function Page() {
  const { data, isLoading, isError, error } = useGetNewsListQuery({ status: 'all' });
  if (isLoading) return <Skeleton />;
  if (isError) return <p>{error?.normalizedMessage}</p>;
  return data.items.map((n) => <Row key={n._id} news={n} />);
}
```

### Veri yazma (mutation)
```jsx
import { useCreateNewsMutation } from '@/redux/services';

const [createNews, { isLoading }] = useCreateNewsMutation();
await createNews({ title, categoryId, contentType }).unwrap();
// İlgili tag invalidate edilir → liste otomatik refetch
```

## Mevcut servisler & hook'lar

| Servis | Hook'lar |
|---|---|
| `newsApi` | `useGetNewsListQuery`, `useGetNewsQuery`, `useCreateNewsMutation`, `useUpdateNewsMutation`, `useDeleteNewsMutation`, `usePublishNewsMutation`, `useUnpublishNewsMutation`, `useGenerateNewsMutation`, `useGetSocialPostsQuery`, `useCreateSocialPostMutation` |
| `newsCategoryApi` | `useGetCategoryTreeQuery`, `useGetCategoryQuery`, `useGetCategoryChildrenQuery`, `useCreateCategoryMutation`, `useUpdateCategoryMutation`, `useDeleteCategoryMutation` |
| `companiesApi` | `useGetCompaniesQuery`, `useGetCompanyQuery`, `useUpdateCompanyMutation`, `useApproveCompanyMutation`, `useRejectCompanyMutation` |
| `usersApi` | `useGetUsersQuery`, `useGetUserQuery`, `useUpdateUserMutation`, `useGetUserSessionsQuery` |
| `emailApi` | `useGetEmailCampaignsQuery`, `useGetEmailListsQuery`, `useCreateEmailListMutation`, `useGetEmailTemplatesQuery`, `useUpdateEmailTemplateMutation`, `useGetEmailHistoryQuery`, `useSendEmailMutation` |

## Yeni servis ekleme

1. `config/api.js` → `ENDPOINTS` altına yolları ekle.
2. `redux/services/xApi.js` oluştur:
```js
'use client';
import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

export const xApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getX: build.query({ query: () => ENDPOINTS.x.list, providesTags: ['X'] }),
  }),
  overrideExisting: false,
});
export const { useGetXQuery } = xApi;
```
3. `baseApi.js` → `tagTypes` listesine `'X'` ekle.
4. `redux/services/index.js` → `export * from './xApi';`

Store veya provider'a dokunmaya gerek yok — `injectEndpoints` çalışma anında bağlanır.

## Notlar

- **Mock data**: Sayfalar şu an mock veriyle çalışıyor. Backend ayağa kalkınca ilgili
  mock'lar yukarıdaki hook'larla değiştirilir (UI bileşenleri aynen kalır).
- **Auth**: Backend kapalıyken istekler hata döner; geçici dev girişi için
  `.env.local` → `DEV_MOCK_AUTH=true` (admin@tinnten.ai / cms2025) NextAuth oturumu açar.
- **Cache invalidation**: Mutasyonlar `invalidatesTags` ile ilgili query'leri otomatik
  tazeler; manuel refetch genelde gerekmez.
