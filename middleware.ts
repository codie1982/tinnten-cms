import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/home') {
    return NextResponse.redirect(new URL('/locate/c', request.url));
  }
}

export const config = {
  matcher: ['/home'],
};
