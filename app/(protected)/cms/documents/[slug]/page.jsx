'use client';

import { use } from 'react';
import { RoleGuard } from '@/components/auth/role-guard';
import { CMS_ROLES } from '@/lib/roles';
import { DocEditor } from '@/components/cms/doc-editor';

export default function EditDocumentPage({ params }) {
  const { slug } = use(params);
  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <DocEditor slug={slug} />
    </RoleGuard>
  );
}
