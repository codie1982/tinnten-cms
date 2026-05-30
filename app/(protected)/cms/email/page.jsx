import { Megaphone } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Email"
      title="Kampanyalar"
      description="E-posta kampanyaları"
      roles={[CMS_ROLES.EDITOR]}
      icon={Megaphone}
      note="Kampanyalar modülü yakında eklenecek."
    />
  );
}
