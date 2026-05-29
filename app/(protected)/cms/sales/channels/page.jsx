import { Share2 } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Partnerler"
      title="Kanal Bazlı Satışlar"
      description="Satış kanallarına göre dağılım, dönüşüm ve analiz"
      roles={[CMS_ROLES.ADMIN]}
      icon={Share2}
    />
  );
}
