import { ContractTemplatesPage } from '@/components/cms/contract-templates-page';

const MOCK_VERSIONS = [
  {
    id: 'pp-2',
    version: 'v1.8',
    publishedAt: '25.02.2025',
    status: 'active',
    updatedBy: 'Hukuk & DPO',
    content: `GİZLİLİK POLİTİKASI — v1.8

Bu Gizlilik Politikası, Tinnten A.Ş. tarafından yürütülen Tinnten B2B platformunun kullanıcı verilerini nasıl topladığını, işlediğini ve koruduğunu açıklamaktadır.

1. TOPLANAN VERİLER
Ad, e-posta, telefon, konum ve kullanım istatistikleri toplanmaktadır.

2. VERİ İŞLEME AMAÇLARI
Veriler; hizmet sunumu, güvenlik, kişiselleştirme ve yasal yükümlülükler kapsamında işlenir.

3. VERİ AKTARIMI
Veriler, açık rıza olmaksızın üçüncü ülkelere aktarılmaz. Yurt içi iş ortakları ile veri işleme sözleşmeleri imzalanmaktadır.

4. HAKLARINIZ (KVKK Md. 11)
Erişim, düzeltme, silme, itiraz ve aktarım talepleri için kvkk@tinnten.com adresine başvurabilirsiniz.

5. ÇEREZLER
Platform, işlevsel ve analitik çerezler kullanır. Tarayıcı ayarlarından devre dışı bırakılabilir.`,
  },
  {
    id: 'pp-1',
    version: 'v1.7',
    publishedAt: '01.09.2024',
    status: 'archived',
    updatedBy: 'Hukuk & DPO',
    content: 'GİZLİLİK POLİTİKASI v1.7 — Arşiv.',
  },
  {
    id: 'pp-0',
    version: 'v1.9-taslak',
    publishedAt: null,
    status: 'draft',
    updatedBy: 'DPO',
    content: 'GİZLİLİK POLİTİKASI v1.9 — TASLAK. GDPR uyum güncellemesi beklemede.',
  },
];

export default function Page() {
  return (
    <ContractTemplatesPage
      section="Sözleşmeler"
      title="Gizlilik Politikası"
      description="KVKK ve GDPR uyumlu gizlilik politikası metnini yönetin ve sürümlendirin"
      mockVersions={MOCK_VERSIONS}
    />
  );
}
