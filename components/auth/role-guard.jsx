'use client';

import { useSession } from 'next-auth/react';
import { Lock } from 'lucide-react';
import { canAccess } from '@/lib/roles';

// Sayfa içeriğini role göre koruyan sarmalayıcı.
// allowedRoles boşsa tüm CMS kullanıcılarına açık.
export function RoleGuard({ allowedRoles, children }) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return null;
  }

  const roles = session?.roles ?? [];

  if (!canAccess(roles, allowedRoles)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <Lock className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Bu sayfaya erişim izniniz yok
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Bu bölümü görüntülemek için gerekli role sahip değilsiniz. Erişim için
          yöneticinizle iletişime geçin.
        </p>
        {allowedRoles?.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Gerekli rol: {allowedRoles.join(' veya ')}
          </p>
        )}
      </div>
    );
  }

  return children;
}
