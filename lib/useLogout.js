'use client';

import { useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { clearAuthToken } from '@/lib/authToken';
import { clearUserSession } from '@/lib/userSession';
import { logoutService } from '@/services/authService';
import { getAuthToken } from '@/lib/authToken';

// Tek noktadan çıkış: backend logout + NextAuth session + bellek + localStorage.
export function useLogout() {
  return useCallback(async () => {
    const token = getAuthToken();
    try {
      if (token) await logoutService(token);
    } catch {
      // backend logout başarısız olsa da yerel temizliğe devam et
    }
    clearAuthToken();
    clearUserSession();
    await signOut({ callbackUrl: '/login' });
  }, []);
}
