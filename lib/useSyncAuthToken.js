'use client';

import { useLayoutEffect, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { setAuthToken, clearAuthToken } from '@/lib/authToken';

/**
 * NextAuth oturumundaki accessToken'ı in-memory token store'a senkronize eder.
 *
 * useLayoutEffect kullanılır çünkü passive effect'lerden (useEffect) önce çalışır.
 * Bu sayede RTK Query'nin useEffect içindeki ilk istek ateşlenmeden token set edilmiş olur.
 *
 * Ayrıca jwt callback'teki refresh KALICI olarak başarısız olursa (refresh token
 * süresi dolmuş/geçersiz → session.error === 'RefreshAccessTokenError') kullanıcıyı
 * temiz şekilde login'e yönlendirir. Diğer geçici hatalarda oturum korunur.
 */
export function useSyncAuthToken() {
  const { data: session, status } = useSession();
  const signingOutRef = useRef(false);

  useLayoutEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      setAuthToken(session.accessToken);
    } else if (status === 'unauthenticated') {
      clearAuthToken();
    }
  }, [status, session?.accessToken]);

  useEffect(() => {
    if (session?.error === 'RefreshAccessTokenError' && !signingOutRef.current) {
      signingOutRef.current = true;
      clearAuthToken();
      signOut({ callbackUrl: '/login' });
    }
  }, [session?.error]);
}
