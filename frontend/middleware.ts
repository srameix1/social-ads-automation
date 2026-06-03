import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role  = req.cookies.get('user_role')?.value;
  const token = req.cookies.get('auth_token')?.value;

  // Ruta pública → dejar pasar
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    // Si ya está autenticado, redirigir al dashboard correcto
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
