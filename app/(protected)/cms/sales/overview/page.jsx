import { TrendingUp } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Partnerler"
      title="Satış Özeti"
      description="Platform genelinde satış metrikleri, ciro ve trendler"
      roles={[CMS_ROLES.ADMIN]}
      icon={TrendingUp}
    />
  );
}
