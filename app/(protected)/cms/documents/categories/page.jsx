import { permanentRedirect } from 'next/navigation';

export default function LegacyDocsCategoriesPage() {
  permanentRedirect('/cms/documents/navigation');
}
