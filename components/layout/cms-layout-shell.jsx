'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSyncAuthToken } from '@/lib/useSyncAuthToken';
import { CmsSidebar } from './cms-sidebar';
import { CmsHeader } from './cms-header';

/**
 * CMS layout iskeletini saran client wrapper.
 * Mobile drawer state'ini sidebar ve header arasında paylaştırır.
 */
export function CmsLayoutShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // NextAuth oturum token'ını axios + RTK Query istemcilerine senkronize et
  useSyncAuthToken();

  // Rota değişince drawer kapansın
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/30">
      <CmsSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <CmsHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <div className="mx-auto w-full max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
