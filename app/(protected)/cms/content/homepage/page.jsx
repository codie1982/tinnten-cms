import { Home } from 'lucide-react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { CMS_ROLES } from '@/lib/roles';

export default function Page() {
  return (
    <PlaceholderPage
      section="İçerik"
      title="Ana Sayfa İçeriği"
      description="Ana sayfa bölümlerini, hero metinlerini ve banner'ları düzenleyin"
      roles={[CMS_ROLES.EDITOR]}
      icon={Home}
    />
  );
}
