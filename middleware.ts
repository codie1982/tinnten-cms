import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequestWithAuth } from 'next-auth/middleware';

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl;

    // / → /login (kimlik doğrulaması withAuth tarafından zaten kontrol edildi,
    // token varsa buraya gelindi; root path'i dashboard'a yönlendir)
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/cms/dashboard', req.url));
    }

    // /home → /locate/c
    if (pathname === '/home') {
      return NextResponse.redirect(new URL('/locate/c', req.url));
    }

    // Roller üzerinden rota kısıtlaması için örnek yapı:
    // const roles: string[] = (req.nextauth.token?.roles as string[]) ?? [];
    // if (pathname.startsWith('/cms/admin') && !roles.includes('cms:admin')) {
    //   return NextResponse.redirect(new URL('/cms/dashboard', req.url));
    // }

    return NextResponse.next();
  },
  {
    secret: NEXTAUTH_SECRET,
    callbacks: {
      // token varsa oturum geçerli sayılır
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  },
);

export const config = {
  // /login, /api/auth/*, /_next/*, favicon ve statik dosyalar hariç her şeyi koru
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
