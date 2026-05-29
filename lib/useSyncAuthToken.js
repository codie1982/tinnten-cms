'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { setAuthToken, clearAuthToken } from '@/lib/authToken';

/**
 * NextAuth oturumundaki accessToken'ı in-memory token store'a senkronize eder.
 *
 * Böylece hem axios (`lib/http.js`) hem RTK Query (`baseApi`) istekleri,
 * oturum açıkken otomatik olarak `Authorization: Bearer <token>` header'ı taşır.
 * Sayfa yenilemelerinde session yeniden yüklendiğinde token tekrar set edilir.
 *
 * Kullanım: CMS layout shell içinde bir kez çağrılır.
 */
export function useSyncAuthToken() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      setAuthToken(session.accessToken);
    } else if (status === 'unauthenticated') {
      clearAuthToken();
    }
  }, [status, session?.accessToken]);
}
