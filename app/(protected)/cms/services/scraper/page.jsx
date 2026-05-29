import { Globe } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Servisler"
      title="Scraper Durumları"
      description="Scraper işlerinin canlı durumu, başarı oranları ve hata kayıtları"
      roles={[CMS_ROLES.ADMIN]}
      icon={Globe}
    />
  );
}
