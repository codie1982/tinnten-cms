# Tinnten CMS — Yönelim & Devam Notları

> Bu doküman, projeye başka bir oturumda kaldığı yerden devam etmek için hazırlanmıştır.
> Son güncelleme: 2026-05-29

---

## 1. Proje Özeti

**Tinnten CMS** — B2B pazaryeri için iç operasyon yönetim paneli (Next.js 15, React 19,
Tailwind CSS v4, Redux Toolkit + RTK Query, NextAuth). Türkçe arayüz, açık/koyu tema,
masaüstü öncelikli responsive yapı.

- **Repo:** `/Users/nilayerol/developer/tinnten/tinnten-cms`
- **Backend:** `tinnten-server` → `http://localhost:5001/api/v10`
- **Çalıştırma:** `npm run dev:stable -- -p 3001` (Turbopack sorun çıkarırsa stable)
- **Dev giriş:** `.env.local` içinde `DEV_MOCK_AUTH=true` → `admin@tinnten.ai` / `cms2025`

---

## 2. Şu Ana Kadar Yapılanlar (Tamamlandı)

### A. Sayfa Tasarımları (mock data ile)
- **Haber Kategorileri** — `app/(protected)/cms/content/news-categories/` (ağaç + form paneli)
- **Haberler listesi** — `content/news/` (filtre + AI ile oluştur modalı)
- **Haber detay editörü** — `content/news/[id]/` (4 format: richSections/sections/html/markdown,
  görsel galeri, sosyal medya sekmesi). `new/` rotası alias.
- **Sözleşme Şablonları (4)** — `contracts/{seller,user,privacy-policy,terms-of-service}/`
  ortak bileşen: `components/cms/contract-templates-page.jsx` (sürüm tablosu + önizleme/düzenleme)
- **Mail Listeleri** — `email/lists/` (kart grid + sparkline trend)
- **Mail Şablonları** — `email/templates/` (tablo + iframe HTML önizleme)
- **Mail Geçmişi** — `email/history/` (log + detay paneli + çoklu alıcı "Mail Gönder" modalı)
- **Token Kullanımı** — `assistants/usage/` (KPI + asistan bazlı tüketim tablosu)

### B. Tasarım Sistemi
- Primary renk **#6366F1 (indigo)** — `css/config.reui.css`
- Metronic'ten 11 UI bileşeni getirildi: `accordion-menu, dropdown-menu, tooltip, dialog,
  sheet, select-radix, popover, progress, switch, scroll-area, separator`
- **Sidebar** → AccordionMenu tabanlı (animasyonlu, rol filtreli, aktif state otomatik)
- **Header** → DropdownMenu + Tooltip (portal-based kullanıcı menüsü)

### C. Kritik CSS/Responsive Düzeltmesi ⚠️
- **Kök sorun:** `.gitignore`'da hatalı `/components` satırı → Tailwind v4 `components/`'i
  taramıyordu → layout'a özgü `lg:*` class'ları üretilmiyordu → sidebar içeriğe biniyordu.
- **Çözüm:** `.gitignore`'dan `/components` kaldırıldı + `css/styles.css`'e
  `@source "../components"` eklendi. CSS 62KB→104KB. Responsive artık çalışıyor.
- Geçersiz utility'ler düzeltildi (`outline-ring`, `rounded-xs`, `end-0.25`, `size-3.25`).

### D. Menü Yapısı (yeniden düzenlendi) — `config/cms-nav.js`
- GENEL → Dashboard
- YAPAY ZEKA → Asistanlar (Tüm Asistanlar, **Kullanım**), İş Akışları
- KEŞFET → İçerikler (+ **Kütüphaneler**), Haberler
- SÖZLEŞMELER → Sözleşmeler
- PARTNERLER → Firmalar, Firma Onayları *(Satış Yönetimi kaldırıldı)*
- FİNANS → **Faturalandırma** *(Yakında — disabled)*
- KULLANICILAR → Kullanıcı Yönetimi (+ **Rol & Yetkiler** child olarak)
- ERİŞİM & SİSTEM → Servisler, Sistem Ayarları, Email

### E. API Altyapısı (RTK Query) — yeni kuruldu
- `config/api.js` → `API_BASE_URL` (localhost:5001) + `ENDPOINTS`
- `redux/services/baseApi.js` → createApi (token enjeksiyonu, hata normalize, cache tag'leri)
- `redux/services/{news,newsCategory,companies,users,email}Api.js` → endpoint + hook'lar
- `redux/store.js` → baseApi reducer + middleware bağlı
- `lib/useSyncAuthToken.js` → session token'ı istemcilere senkronize eder
- Dokümantasyon: `redux/services/README.md`

---

## 3. Sıradaki Adımlar (Yapılacaklar)

### Öncelik 1 — Mock → Gerçek API geçişi
Backend (`localhost:5001`) ayağa kalkınca, sayfalardaki mock data'lar RTK Query hook'larıyla
değiştirilecek. UI bileşenleri **aynen kalır**, sadece veri kaynağı değişir.

**Sıralı geçiş önerisi** (en olgun backend endpoint'lerinden başla):
1. Haberler + Haber Kategorileri → `useGetNewsListQuery`, `useGetCategoryTreeQuery` (backend hazır)
2. Kullanıcılar → `useGetUsersQuery`, `useGetUserQuery`
3. Firmalar + KYC → `useGetCompaniesQuery`, `useApproveCompanyMutation`
4. Email (liste/şablon/geçmiş/gönderim)
5. Sözleşmeler

**Her sayfada izlenecek desen:**
```jsx
// ÖNCE (mock):
import { newsMock } from './_data';
const filtered = newsMock.filter(...);

// SONRA (API):
import { useGetNewsListQuery } from '@/redux/services';
const { data, isLoading, error } = useGetNewsListQuery({ status, categoryId, query });
// isLoading → Skeleton, error → Alert, data.items → tablo
```
Mock dosyaları (`_data.js`) endpoint şekli netleşene kadar referans olarak kalabilir.

### Öncelik 2 — Backend response şeması doğrulama
`config/api.js`'teki endpoint yolları ve `transformResponse` (`res.data ?? res`)
gerçek backend cevabına göre teyit edilmeli. `tinnten-server/src/domains/` incelenmeli:
- `newscontent`, `news-category` domain'leri (yollar büyük ölçüde biliniyor)
- Companies/users/email domain yolları **varsayımsal** — gerçek route'larla eşleştir.

### Öncelik 3 — Eksik/placeholder sayfalar
Hâlâ `PlaceholderPage` olanlar: `content/homepage`, `content/academy`, `workflows`,
`services/*`, `sales/*` (artık nav'da yok), `settings`, `settings/logs`,
`company-approvals/applications`, `company-approvals/kyc`, `users/sessions`,
`assistants/libraries`, `access-control`, `email` (kampanyalar).
→ İhtiyaca göre tasarlanacak.

### Öncelik 4 — Faturalandırma (Billing) modülü
Şu an "Yakında" (disabled). Kapsam: **geç ödemeler, gecikmiş tahsilatlar, fatura yönetimi.**
Aktif edilince `config/cms-nav.js`'te `disabled/comingSoon` kaldırılıp alt sayfalar + API eklenecek.

### Öncelik 5 — Kullanıcı Detayı 8 sekme
`users/[id]/` şu an 4 sekme (Genel, Oturumlar, Kütüphaneler, Email). Brief'teki 8 sekmeye
tamamlanacak: + Firmalar, Asistanlar, Ürün/Hizmetler, Cüzdan, Sözleşmeler, Aktivite.

---

## 4. Önemli Teknik Notlar

- **Tailwind v4 + .gitignore tuzağı:** `components/` git-ignore EDİLMEMELİ. Yeni bir kaynak
  klasörü eklenirse `css/styles.css`'e `@source` eklemeyi unutma.
- **Auth bypass geçici:** `auth-options.js`'teki `DEV_MOCK_AUTH` bloğu yalnızca geliştirme
  içindir. Prod'a çıkmadan kaldırılmalı/kapatılmalı.
- **NEXTAUTH_URL:** Yerelde `http://localhost:3001` olmalı (port'la eşleşmeli).
- **Token akışı:** NextAuth session → `useSyncAuthToken` → in-memory store → axios & RTK Query.
- **Preview giriş:** Tarayıcı otomatik-doldurma alanları bozuyor; `/api/auth/callback/...`
  üzerinden programatik giriş güvenilir.

---

## 5. Hızlı Başlangıç (yeni oturum)

```bash
cd /Users/nilayerol/developer/tinnten/tinnten-cms
npm run dev:stable -- -p 3001          # CMS
# (ayrı terminal) tinnten-server'ı 5001'de çalıştır
# Giriş: admin@tinnten.ai / cms2025  (DEV_MOCK_AUTH=true ise)
```

İlk iş önerisi: **Haberler sayfasını gerçek API'ye bağlamak** (`content/news/page.jsx` →
`useGetNewsListQuery`), çünkü backend endpoint'leri en net olan domain bu.
