import { Library } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Yapay Zeka"
      title="Kütüphaneler"
      description="Asistan bilgi tabanları, dokümanlar ve embedding kaynakları"
      roles={[CMS_ROLES.ACCESS]}
      icon={Library}
    />
  );
}
