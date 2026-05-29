import { Workflow } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Yapay Zeka"
      title="İş Akışları"
      description="Otomasyon ve asistan iş akışlarını tasarlayın ve izleyin"
      roles={[CMS_ROLES.ACCESS]}
      icon={Workflow}
    />
  );
}
