import { Rss } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Servisler"
      title="Fetcher Servisi"
      description="tinnten-fetcher servisinin durumu, iş kuyruğu ve çalışma kayıtları"
      roles={[CMS_ROLES.ADMIN]}
      icon={Rss}
    />
  );
}
