'use client';

import { RoleGuard } from '@/components/auth/role-guard';
import { CMS_ROLES } from '@/lib/roles';
import { PageEditor } from '@/components/cms/page-editor';

export default function NewDocumentPage() {
  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <PageEditor />
    </RoleGuard>
  );
}
