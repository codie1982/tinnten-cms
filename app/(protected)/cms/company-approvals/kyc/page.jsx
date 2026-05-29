import { FileCheck } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Partnerler"
      title="KYC / Evrak Kontrolü"
      description="Firma KYC belgelerini doğrulayın ve onay sürecini yönetin"
      roles={[CMS_ROLES.ADMIN]}
      icon={FileCheck}
    />
  );
}
