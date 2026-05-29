import { ContractTemplatesPage } from '@/components/cms/contract-templates-page';

const MOCK_VERSIONS = [
  {
    id: 'sv-3',
    version: 'v3.1',
    publishedAt: '01.04.2025',
    status: 'active',
    updatedBy: 'Hukuk Birimi',
    content: `SATICI SÖZLEŞME VE KULLANIM KOŞULLARI — v3.1

Bu sözleşme, Tinnten platformu üzerinden hizmet veya ürün sunan satıcılar ile Tinnten A.Ş. arasındaki ticari ilişkiyi düzenlemektedir.

1. TARAFLAR
İşbu Satıcı Sözleşmesi; Tinnten A.Ş. ("Platform") ile Tinnten platformuna kayıtlı satıcı hesabı sahibi ("Satıcı") arasında akdedilmiştir.

2. PLATFORM HİZMETLERİ
Platform; satıcılara B2B pazaryeri erişimi, sipariş yönetim altyapısı, ödeme güvencesi (escrow), AI destekli müşteri eşleştirme ve analitik araçları sunar.

3. SATICI YÜKÜMLÜLÜKLERİ
3.1 Satıcı, sunduğu hizmet ve ürünlerin gerçek özelliklerini doğru şekilde beyan eder.
3.2 Sipariş kabul ettiğinde, belirlenen süre ve kalitede teslimata uymayı taahhüt eder.
3.3 Platforma sağlanan belgeler ve kimlik bilgileri doğru ve güncel olmalıdır.

4. KOMİSYON VE ÖDEME
Platform, gerçekleşen işlemler üzerinden belirlenen komisyon oranını (%2 - %8 arasında, üyelik paketine göre değişir) tahsil eder.

5. HESAP ASKIYA ALMA VE FESİH
Sözleşme ihlali durumunda Platform, bildirim yapmaksızın hesabı askıya alabilir veya sözleşmeyi feshedebilir.`,
  },
  {
    id: 'sv-2',
    version: 'v3.0',
    publishedAt: '15.01.2025',
    status: 'archived',
    updatedBy: 'Hukuk Birimi',
    content: 'SATICI SÖZLEŞMESİ v3.0 — Arşiv sürümü. Komisyon oranları güncellenmeden önceki versiyondur.',
  },
  {
    id: 'sv-1',
    version: 'v2.5',
    publishedAt: '03.09.2024',
    status: 'archived',
    updatedBy: 'Platform Ekibi',
    content: 'SATICI SÖZLEŞMESİ v2.5 — Arşiv sürümü. KYC gereksinimleri eklenmeden önceki versiyondur.',
  },
  {
    id: 'sv-0',
    version: 'v3.2-taslak',
    publishedAt: null,
    status: 'draft',
    updatedBy: 'Hukuk Birimi',
    content: 'SATICI SÖZLEŞMESİ v3.2 — TASLAK. Yeni escrow politikası eklenecek.',
  },
];

export default function Page() {
  return (
    <ContractTemplatesPage
      section="Sözleşmeler"
      title="Satıcı Sözleşmeleri"
      description="Platforma kayıtlı satıcılar için kullanım koşulları ve sözleşme şablonlarını yönetin"
      mockVersions={MOCK_VERSIONS}
    />
  );
}
