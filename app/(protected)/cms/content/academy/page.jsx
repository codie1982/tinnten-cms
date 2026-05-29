import { GraduationCap } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="İçerik"
      title="Akademi"
      description="Satıcı akademisi eğitim içeriklerini ve modüllerini yönetin"
      roles={[CMS_ROLES.EDITOR]}
      icon={GraduationCap}
    />
  );
}
