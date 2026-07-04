'use client';

/**
 * NextAuth session'ını zorla tazeleyip yeni access token'ı döndüren paylaşılan
 * yardımcı. `getSession()` çağrısı sunucuda jwt callback'i tetikler; access token
 * süresi dolmuşsa backend /auth/refresh-token ile yenilenir (bkz. auth-options.js).
 *
 * Eşzamanlı 401'ler (axios `http` + RTK Query `baseApi` aynı anda) TEK bir refresh
 * paylaşır — dedup. Oturum kalıcı olarak ölüyse (session.error) veya token yoksa
 * null döner; çağıran retry etmez, useSyncAuthToken signOut'u üstlenir.
 */
let inFlight = null;

export async function refreshSessionToken() {
  if (typeof window === 'undefined') return null;
  if (!inFlight) {
    inFlight = (async () => {
      const { getSession } = await import('next-auth/react');
      const session = await getSession();
      if (
        !session ||
        session.error === 'RefreshAccessTokenError' ||
        !session.accessToken
      ) {
        return null;
      }
      return session.accessToken;
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
