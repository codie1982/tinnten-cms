import { Boxes } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="Servisler"
      title="Embedding Servisi"
      description="tinnten-embedding servisinin durumu ve vektör işlemleri"
      roles={[CMS_ROLES.ADMIN]}
      icon={Boxes}
    />
  );
}
