import { redirect } from 'next/navigation';

export default function CronListsRedirectPage() {
  redirect('/cms/email/lists/cron-lists');
}
