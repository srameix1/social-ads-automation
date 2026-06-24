import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Auth pages: redirect logged-in users to their dashboard
const AUTH_PATHS = ['/login', '/register', '/verify-email'];
// Legal pages: always accessible regardless of auth state
const PUBLIC_PATHS = ['/privacy', '/terms'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role  = req.cookies.get('user_role')?.value;
  const token = req.cookies.get('auth_token')?.value;

  // Always-public routes (legal pages) → let through unconditionally
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Auth routes → redirect already-authenticated users to their dashboard
  if (AUTH_PATHS.some(p => pathname.startsWith(p))) {
    if (token && role) {
      const dest = role === 'admin' ? '/admin' : '/dashboard';
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  // Rutas protegidas → requieren autenticación
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Rutas /admin → solo admin
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Rutas de cliente → solo client
  if (!pathname.startsWith('/admin') && role === 'admin') {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads).*)'],
};
