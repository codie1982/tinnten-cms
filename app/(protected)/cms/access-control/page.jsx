import { KeyRound } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Erişim & Sistem"
      title="Rol & Yetkiler"
      description="CMS rollerini ve yetki matrisini yönetin"
      roles={[CMS_ROLES.ADMIN]}
      icon={KeyRound}
    />
  );
}
