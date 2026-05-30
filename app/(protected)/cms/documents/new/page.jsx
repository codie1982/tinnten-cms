'use client';

import { RoleGuard } from '@/components/auth/role-guard';
import { CMS_ROLES } from '@/lib/roles';
import { DocEditor } from '@/components/cms/doc-editor';

export default function NewDocumentPage() {
  return (
    <RoleGuard allowedRoles={[CMS_ROLES.EDITOR]}>
      <DocEditor />
    </RoleGuard>
  );
}
