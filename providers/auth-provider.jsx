'use client';

import { SessionProvider } from 'next-auth/react';

export function AuthProvider({ children, session }) {
  // CMS, NextAuth ile aynı origin'de (localhost:5020) çalışır; session/csrf
  // istekleri her zaman bu path'e gitmeli. NEXT_PUBLIC_BASE_PATH'e bağlamak
  // (örn. bir URL girilirse) fetch'i yanlış origine yollar → CLIENT_FETCH_ERROR.
  // refetchInterval: NextAuth session'ı periyodik olarak yeniden çeker; her çekim
  // jwt callback'i tetikler → access token süresi dolmaya yakınsa proaktif yenilenir.
  // Access token ömrü 5 dk (Keycloak accessTokenLifespan=300) olduğundan 4 dk'da bir
  // yenileyip 401'leri baştan önlüyoruz. refetchOnWindowFocus: sekmeye dönünce taze token.
  return (
    <SessionProvider
      session={session}
      basePath="/api/auth"
      refetchInterval={4 * 60}
      refetchOnWindowFocus
    >
      {children}
    </SessionProvider>
  );
}
