import { redirect } from 'next/navigation';

/** Eski bağlantıları tek talep kuyruğundaki telefon filtresine taşır. */
export default function LegacySupportCallbacksPage() {
  redirect('/cms/support/tickets?contactPreference=phone');
}
