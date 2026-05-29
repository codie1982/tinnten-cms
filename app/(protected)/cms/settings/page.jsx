import { Settings } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Erişim & Sistem"
      title="Genel Ayarlar"
      description="Platform genel yapılandırma ve entegrasyon ayarları"
      roles={[CMS_ROLES.ADMIN]}
      icon={Settings}
    />
  );
}
