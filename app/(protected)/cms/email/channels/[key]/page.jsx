import { redirect } from 'next/navigation';

export default async function ChannelMembersRedirectPage({ params }) {
  const { key } = await params;

  redirect(`/cms/email/lists/channels/${encodeURIComponent(key)}`);
}
