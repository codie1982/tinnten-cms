import { ContractTemplatesPage } from '@/components/cms/contract-templates-page';

const MOCK_VERSIONS = [
  {
    id: 'tos-2',
    version: 'v4.0',
    publishedAt: '01.03.2025',
    status: 'active',
    updatedBy: 'Hukuk Birimi',
    content: `HİZMET ŞARTLARI — v4.0

Bu Hizmet Şartları, Tinnten platformunun tüm kullanıcılarına yönelik genel kullanım koşullarını tanımlar.

1. PLATFORMUN AMACI
Tinnten, alıcı ve satıcılar arasında B2B ticareti kolaylaştıran dijital bir aracıdır.

2. KABUL KOŞULLARI
Platforma kaydolan veya hizmetlerden yararlanan herkes bu şartları kabul etmiş sayılır.

3. SORUMLULUK SINIRI
Platform, aracı sıfatıyla taraflar arasındaki anlaşmazlıklarda doğrudan sorumluluk taşımaz.

4. DEĞİŞİKLİKLER
Tinnten, bu şartları önceden bildirmeksizin değiştirme hakkını saklı tutar. Değişiklikler yayınlandığı tarihten itibaren geçerlidir.

5. YÜRÜRLÜK VE YETKİLİ MAHKEME
İşbu şartlar Türk Hukuku'na tabidir; uyuşmazlıklarda İstanbul Anadolu Mahkemeleri yetkilidir.`,
  },
  {
    id: 'tos-1',
    version: 'v3.5',
    publishedAt: '15.07.2024',
    status: 'archived',
    updatedBy: 'Hukuk Birimi',
    content: 'HİZMET ŞARTLARI v3.5 — Arşiv.',
  },
  {
    id: 'tos-0',
    version: 'v4.1-taslak',
    publishedAt: null,
    status: 'draft',
    updatedBy: 'Hukuk Birimi',
    content: 'HİZMET ŞARTLARI v4.1 — TASLAK. Yapay zeka hizmetleri maddesi eklenecek.',
  },
];

export default function Page() {
  return (
    <ContractTemplatesPage
      section="Sözleşmeler"
      title="Hizmet Şartları"
      description="Platform genelinde geçerli hizmet şartları metnini yönetin ve sürümlendirin"
      mockVersions={MOCK_VERSIONS}
    />
  );
}
