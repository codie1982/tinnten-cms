'use client';

import { useLayoutEffect } from 'react';
import { useSession } from 'next-auth/react';
import { setAuthToken, clearAuthToken } from '@/lib/authToken';

/**
 * NextAuth oturumundaki accessToken'ı in-memory token store'a senkronize eder.
 *
 * useLayoutEffect kullanılır çünkü passive effect'lerden (useEffect) önce çalışır.
 * Bu sayede RTK Query'nin useEffect içindeki ilk istek ateşlenmeden token set edilmiş olur.
 */
export function useSyncAuthToken() {
  const { data: session, status } = useSession();

  useLayoutEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      setAuthToken(session.accessToken);
    } else if (status === 'unauthenticated') {
      clearAuthToken();
    }
  }, [status, session?.accessToken]);
}
