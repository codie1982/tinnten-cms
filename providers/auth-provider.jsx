'use client';

import { SessionProvider } from 'next-auth/react';

export function AuthProvider({ children, session }) {
  // CMS, NextAuth ile aynı origin'de (localhost:5020) çalışır; session/csrf
  // istekleri her zaman bu path'e gitmeli. NEXT_PUBLIC_BASE_PATH'e bağlamak
  // (örn. bir URL girilirse) fetch'i yanlış origine yollar → CLIENT_FETCH_ERROR.
  return (
    <SessionProvider session={session} basePath="/api/auth">
      {children}
    </SessionProvider>
  );
}
