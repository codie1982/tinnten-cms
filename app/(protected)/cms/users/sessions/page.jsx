import { MonitorSmartphone } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Kullanıcılar"
      title="Oturumlar & Güvenlik"
      description="Aktif oturumlar, cihazlar ve güvenlik olaylarını izleyin"
      roles={[CMS_ROLES.ADMIN]}
      icon={MonitorSmartphone}
    />
  );
}
