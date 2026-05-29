import { ContractTemplatesPage } from '@/components/cms/contract-templates-page';

const MOCK_VERSIONS = [
  {
    id: 'uv-2',
    version: 'v2.3',
    publishedAt: '10.03.2025',
    status: 'active',
    updatedBy: 'Hukuk Birimi',
    content: `KULLANICI SÖZLEŞME VE KULLANIM KOŞULLARI — v2.3

Bu sözleşme, Tinnten platformuna kayıtlı alıcı ve genel kullanıcılar ile Tinnten A.Ş. arasındaki hak ve yükümlülükleri düzenlemektedir.

1. KABUL
Platforma kaydolarak veya hizmetleri kullanarak bu sözleşmeyi kabul etmiş sayılırsınız.

2. HESAP GÜVENLİĞİ
Kullanıcı, hesap kimlik bilgilerinin gizliliğinden sorumludur. Yetkisiz erişim durumunda Platform'u derhal bilgilendirmelidir.

3. KULLANIM KURALLARI
Platform yalnızca yasal amaçlar için kullanılabilir. Spam, dolandırıcılık veya platform politikalarına aykırı davranışlar hesap kapatmaya yol açar.

4. FİKRİ MÜLKİYET
Platformun tüm içerikleri, logolar ve yazılım bileşenleri Tinnten A.Ş.'ye aittir.`,
  },
  {
    id: 'uv-1',
    version: 'v2.2',
    publishedAt: '01.11.2024',
    status: 'archived',
    updatedBy: 'Hukuk Birimi',
    content: 'KULLANICI SÖZLEŞMESİ v2.2 — Arşiv sürümü.',
  },
  {
    id: 'uv-0',
    version: 'v2.4-taslak',
    publishedAt: null,
    status: 'draft',
    updatedBy: 'Platform Ekibi',
    content: 'KULLANICI SÖZLEŞMESİ v2.4 — TASLAK. İki faktörlü doğrulama zorunluluğu eklenecek.',
  },
];

export default function Page() {
  return (
    <ContractTemplatesPage
      section="Sözleşmeler"
      title="Kullanıcı Sözleşmeleri"
      description="Platformu kullanan alıcı ve genel kullanıcılar için kullanım koşullarını yönetin"
      mockVersions={MOCK_VERSIONS}
    />
  );
}
