import { redirect } from 'next/navigation';

export default function MailChannelsRedirectPage() {
  redirect('/cms/email/lists/channels');
}
