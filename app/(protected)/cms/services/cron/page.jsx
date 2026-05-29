import { Clock } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Servisler"
      title="Cron Servisi"
      description="tinnten-cron zamanlanmış görevleri ve çalışma geçmişi"
      roles={[CMS_ROLES.ADMIN]}
      icon={Clock}
    />
  );
}
