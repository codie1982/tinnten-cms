/**
 * Kullanıcılar bölümü — paylaşılan sabit veriler.
 * list/page.jsx ve [id]/page.jsx bu dosyadan import eder.
 */

/* ─── mock ─── */
export const usersMock = [
  {
    id: 'usr-1',
    name: 'Ayşe Demir',
    email: 'ayse@tinnten.ai',
    roles: ['cms:editor'],
    status: 'active',
    blocked: false,
    memberSince: '14.01.2024',
    company: { id: 'COMP-1023', name: 'ABC Temizlik Hizmetleri' },
    lastSession: { device: 'Chrome 124 / macOS', ip: '88.245.12.33', time: '28.05.2026 · 14:32' },
    sessions: [
      { id: 's1', device: 'Chrome 124 / macOS', ip: '88.245.12.33', time: '28.05.2026 · 14:32', location: 'İstanbul, TR' },
      { id: 's2', device: 'Safari / iOS 17', ip: '88.245.12.34', time: '25.05.2026 · 09:11', location: 'Ankara, TR' },
      { id: 's3', device: 'Firefox 126 / Windows', ip: '85.104.18.77', time: '20.05.2026 · 16:45', location: 'İzmir, TR' },
    ],
    libraries: [
      { id: 'lib-1', name: 'Hukuki Belgeler Kütüphanesi' },
      { id: 'lib-2', name: 'Satıcı SSS Koleksiyonu' },
    ],
    emails: [
      { id: 'em-1', subject: 'Hoş Geldiniz', sentAt: '14.01.2024', status: 'opened' },
      { id: 'em-2', subject: 'Şifre Sıfırlama', sentAt: '02.03.2025', status: 'delivered' },
      { id: 'em-3', subject: 'Kampanya Bildirimi', sentAt: '15.04.2025', status: 'opened' },
    ],
    emailCount: 3,
  },
  {
    id: 'usr-2',
    name: 'Mehmet Kaya',
    email: 'mehmet@tinnten.ai',
    roles: ['cms:admin'],
    status: 'active',
    blocked: false,
    memberSince: '03.06.2023',
    company: null,
    lastSession: { device: 'Chrome 124 / Windows', ip: '195.20.14.11', time: '29.05.2026 · 08:54' },
    sessions: [
      { id: 's1', device: 'Chrome 124 / Windows', ip: '195.20.14.11', time: '29.05.2026 · 08:54', location: 'İstanbul, TR' },
    ],
    libraries: [],
    emails: [
      { id: 'em-1', subject: 'Hoş Geldiniz', sentAt: '03.06.2023', status: 'opened' },
    ],
    emailCount: 1,
  },
  {
    id: 'usr-3',
    name: 'Zeynep Ak',
    email: 'zeynep@tinnten.ai',
    roles: ['cms:access', 'cms:editor'],
    status: 'active',
    blocked: false,
    memberSince: '22.09.2023',
    company: { id: 'COMP-1042', name: 'Yılmaz Teknoloji Ltd.' },
    lastSession: { device: 'Safari / macOS', ip: '217.23.98.42', time: '27.05.2026 · 11:20' },
    sessions: [
      { id: 's1', device: 'Safari / macOS', ip: '217.23.98.42', time: '27.05.2026 · 11:20', location: 'İstanbul, TR' },
      { id: 's2', device: 'Chrome / Android', ip: '217.23.98.43', time: '22.05.2026 · 18:05', location: 'Bursa, TR' },
    ],
    libraries: [{ id: 'lib-3', name: 'Teknoloji Ürünleri Kataloğu' }],
    emails: [
      { id: 'em-1', subject: 'Hoş Geldiniz', sentAt: '22.09.2023', status: 'opened' },
      { id: 'em-2', subject: 'Aylık Özet', sentAt: '01.05.2026', status: 'delivered' },
    ],
    emailCount: 2,
  },
  {
    id: 'usr-4',
    name: 'Can Yıldız',
    email: 'can@tinnten.ai',
    roles: ['cms:access'],
    status: 'invited',
    blocked: false,
    memberSince: '10.05.2026',
    company: null,
    lastSession: null,
    sessions: [],
    libraries: [],
    emails: [
      { id: 'em-1', subject: 'Davet E-postası', sentAt: '10.05.2026', status: 'opened' },
    ],
    emailCount: 1,
  },
  {
    id: 'usr-5',
    name: 'Elif Şahin',
    email: 'elif@tinnten.ai',
    roles: ['cms:access'],
    status: 'suspended',
    blocked: true,
    memberSince: '15.02.2024',
    company: { id: 'COMP-0891', name: 'Perla Yapı & İnşaat' },
    lastSession: { device: 'Chrome 120 / Windows', ip: '78.188.44.21', time: '01.03.2025 · 09:30' },
    sessions: [
      { id: 's1', device: 'Chrome 120 / Windows', ip: '78.188.44.21', time: '01.03.2025 · 09:30', location: 'Ankara, TR' },
    ],
    libraries: [],
    emails: [
      { id: 'em-1', subject: 'Hoş Geldiniz', sentAt: '15.02.2024', status: 'opened' },
      { id: 'em-2', subject: 'Hesap Askıya Alındı', sentAt: '05.03.2025', status: 'delivered' },
    ],
    emailCount: 2,
  },
];

/* ─── meta ─── */
export const statusMeta = {
  active: { label: 'Aktif', variant: 'success' },
  invited: { label: 'Davetli', variant: 'primary' },
  suspended: { label: 'Askıda', variant: 'destructive' },
  passive: { label: 'Pasif', variant: 'muted' },
};

export const roleMeta = {
  'cms:access': { label: 'Erişim', variant: 'muted' },
  'cms:editor': { label: 'Editör', variant: 'secondary' },
  'cms:admin': { label: 'Admin', variant: 'primary' },
};

export const emailStatusMeta = {
  opened: { label: 'Açıldı', variant: 'success' },
  delivered: { label: 'İletildi', variant: 'muted' },
  bounced: { label: 'Geri Döndü', variant: 'destructive' },
};

export const statusOptions = [
  { value: 'all', label: 'Tüm Durumlar' },
  { value: 'active', label: 'Aktif' },
  { value: 'invited', label: 'Davetli' },
  { value: 'suspended', label: 'Askıda' },
];
