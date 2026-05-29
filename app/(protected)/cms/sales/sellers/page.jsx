import { Store } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Partnerler"
      title="Satıcı Performansı"
      description="Satıcı bazlı performans, sıralama ve karşılaştırmalar"
      roles={[CMS_ROLES.ADMIN]}
      icon={Store}
    />
  );
}
