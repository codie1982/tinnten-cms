'use client';

import { use } from 'react';
import { RoleGuard } from '@/components/auth/role-guard';
import { CMS_ROLES } from '@/lib/roles';
import { PageEditor } from '@/components/cms/page-editor';

export default function EditDocumentPage({ params }) {
  const { slug: pageId } = use(params);
  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageEditor pageId={pageId} />
    </RoleGuard>
  );
}
