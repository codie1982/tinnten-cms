import {
  LayoutGrid,
  Bot,
  Workflow,
  Server,
  Mail,
  FileSignature,
  Building2,
  Users,
  Settings,
  CreditCard,
  Activity,
  Compass,
  Files,
  MoreHorizontal,
  MessagesSquare,
  Package,
} from 'lucide-react';
import { CMS_ROLES } from '@/lib/roles';

// Rol etiketli, iç içe CMS navigasyonu.
// - { heading } → bölüm başlığı (kendinden sonra görünür item varsa gösterilir)
// - item.roles → any-of mantığı; boş/undefined ise tüm CMS kullanıcılarına açık
// - item.children → açılır alt menü. Parent, en az bir görünür child'ı varsa gösterilir.
// - item.disabled + item.comingSoon → "Yakında" rozetli, tıklanamaz item.
// Sidebar bu listeyi kullanıcının rollerine göre filtreler.
export const CMS_NAV = [
  { heading: 'GENEL' },
  {
    title: 'Dashboard',
    icon: LayoutGrid,
    path: '/cms/dashboard',
    roles: [CMS_ROLES.ACCESS],
  },

  { heading: 'YAPAY ZEKA' },
  {
    title: 'Asistanlar',
    icon: Bot,
    path: '/cms/assistants',
    roles: [CMS_ROLES.ACCESS],
  },
  {
    title: 'Konuşmalar',
    icon: MessagesSquare,
    path: '/cms/ai-conversations',
    roles: [CMS_ROLES.ADMIN],
  },
  {
    title: 'İş Akışları',
    icon: Workflow,
    path: '/cms/workflows',
    roles: [CMS_ROLES.ACCESS],
  },
  {
    title: 'Kullanım',
    icon: Activity,
    path: '/cms/usage',
    roles: [CMS_ROLES.ACCESS],
  },

  { heading: 'İÇERİKLER' },
  {
    title: 'Keşfet',
    icon: Compass,
    roles: [CMS_ROLES.EDITOR],
    children: [
      { title: 'Tüm Haberler', path: '/cms/content/news', roles: [CMS_ROLES.EDITOR] },
      { title: 'Haber Kategorileri', path: '/cms/content/news-categories', roles: [CMS_ROLES.EDITOR] },
    ],
  },
  {
    title: 'Dökümanlar',
    icon: Files,
    roles: [CMS_ROLES.EDITOR],
    children: [
      { title: 'Tüm Dökümanlar', path: '/cms/documents', roles: [CMS_ROLES.EDITOR] },
      { title: 'Kategoriler', path: '/cms/documents/categories', roles: [CMS_ROLES.EDITOR] },
    ],
  },
  {
    title: 'Diğer',
    icon: MoreHorizontal,
    roles: [CMS_ROLES.EDITOR],
    children: [
      { title: 'Ana Sayfa', path: '/cms/content/homepage', roles: [CMS_ROLES.EDITOR] },
      { title: 'SSS', path: '/cms/content/faq', roles: [CMS_ROLES.EDITOR] },
    ],
  },

  { heading: 'SÖZLEŞMELER' },
  {
    title: 'Sözleşmeler',
    icon: FileSignature,
    path: '/cms/contracts',
    roles: [CMS_ROLES.EDITOR],
  },

  { heading: 'PARTNERLER' },
  {
    title: 'Firmalar',
    icon: Building2,
    roles: [CMS_ROLES.ADMIN],
    children: [
      { title: 'Tüm Firmalar', path: '/cms/companies/list', roles: [CMS_ROLES.ADMIN] },
      { title: 'Satıcı Başvuruları', path: '/cms/company-approvals/applications', roles: [CMS_ROLES.ADMIN] },
      { title: 'KYC / Evrak Kontrolü', path: '/cms/company-approvals/kyc', roles: [CMS_ROLES.ADMIN] },
    ],
  },
  {
    title: 'Ürünler & Hizmetler',
    icon: Package,
    path: '/cms/products',
    roles: [CMS_ROLES.ADMIN],
  },

  { heading: 'FİNANS' },
  {
    title: 'Faturalandırma',
    icon: CreditCard,
    roles: [CMS_ROLES.ADMIN],
    disabled: true,
    comingSoon: true,
    // Yakında: geç ödemeler, gecikmiş tahsilatlar ve fatura yönetimi.
  },

  { heading: 'KULLANICILAR' },
  {
    title: 'Kullanıcı Yönetimi',
    icon: Users,
    roles: [CMS_ROLES.ADMIN],
    children: [
      { title: 'Tüm Kullanıcılar', path: '/cms/users/list', roles: [CMS_ROLES.ADMIN] },
      { title: 'Oturumlar & Güvenlik', path: '/cms/users/sessions', roles: [CMS_ROLES.ADMIN] },
      { title: 'Rol & Yetkiler', path: '/cms/access-control', roles: [CMS_ROLES.ADMIN] },
    ],
  },

  { heading: 'ERİŞİM & SİSTEM' },
  {
    title: 'Servisler',
    icon: Server,
    roles: [CMS_ROLES.ADMIN],
    children: [
      { title: 'Fetcher Servisi', path: '/cms/services/fetcher', roles: [CMS_ROLES.ADMIN] },
      { title: 'Embedding Servisi', path: '/cms/services/embedding', roles: [CMS_ROLES.ADMIN] },
      { title: 'Cron Servisi', path: '/cms/services/cron', roles: [CMS_ROLES.ADMIN] },
      { title: 'Mesaj Kuyruğu', path: '/cms/services/queues', roles: [CMS_ROLES.ADMIN] },
      { title: 'Sistem İzleme', path: '/cms/services/monitoring', roles: [CMS_ROLES.ADMIN] },
      { title: 'Hata İzleme', path: '/cms/services/errors', roles: [CMS_ROLES.ADMIN] },
      { title: 'Scraper Durumları', path: '/cms/services/scraper', roles: [CMS_ROLES.ADMIN] },
    ],
  },
  {
    title: 'Sistem Ayarları',
    icon: Settings,
    roles: [CMS_ROLES.ADMIN],
    children: [
      { title: 'Genel Ayarlar', path: '/cms/settings', roles: [CMS_ROLES.ADMIN] },
      { title: 'Eklenen Dosyalar', path: '/cms/settings/files', roles: [CMS_ROLES.ADMIN] },
      { title: 'Tool Listesi', path: '/cms/settings/tools', roles: [CMS_ROLES.ADMIN] },
      { title: 'Paketler', path: '/cms/settings/packages', roles: [CMS_ROLES.ADMIN] },
      { title: 'Log & Denetim', path: '/cms/settings/logs', roles: [CMS_ROLES.ADMIN] },
    ],
  },
  {
    title: 'Email',
    icon: Mail,
    roles: [CMS_ROLES.EDITOR],
    children: [
      { title: 'Gelen Mailler', path: '/cms/email/inbox', roles: [CMS_ROLES.EDITOR] },
      { title: 'Giden Mailler', path: '/cms/email/history', roles: [CMS_ROLES.EDITOR] },
      { title: 'Mail Abonelikleri', path: '/cms/email/lists', roles: [CMS_ROLES.EDITOR] },
      { title: 'Kanallar', path: '/cms/email/channels', roles: [CMS_ROLES.EDITOR] },
      { title: 'Cron Listeleri', path: '/cms/email/cron-lists', roles: [CMS_ROLES.EDITOR] },
      { title: 'Kampanyalar', path: '/cms/email/campaigns', roles: [CMS_ROLES.EDITOR] },
      { title: 'Kampanya Şablonları', path: '/cms/email/campaign-templates', roles: [CMS_ROLES.EDITOR] },
      { title: 'Şablonlar (.flt)', path: '/cms/email/templates', roles: [CMS_ROLES.EDITOR] },
    ],
  },
];
