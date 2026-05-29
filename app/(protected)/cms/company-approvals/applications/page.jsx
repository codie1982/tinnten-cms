import { ClipboardList } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Partnerler"
      title="Satıcı Başvuruları"
      description="Yeni satıcı ve firma başvurularını inceleyin ve onaylayın"
      roles={[CMS_ROLES.ADMIN]}
      icon={ClipboardList}
    />
  );
}
