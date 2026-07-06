import { redirect } from 'next/navigation';

// Cron listeleri yönetimi artık "Mail Listeleri > Cron" sekmesi altında.
export default function CronListsRedirectPage() {
  redirect('/cms/email/lists?tab=cron');
}
