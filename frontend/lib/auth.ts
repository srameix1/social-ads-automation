'use client';

import Cookies from 'js-cookie';

export function saveAuth(_token: string, user: { role: string; id: string; email: string }): void {
  // The JWT itself is never written here — the backend already sets it as an
  // httpOnly cookie on the login/verify-email response. Storing/duplicating
  // it anywhere JS can read (localStorage or a non-httpOnly cookie) would
  // hand a full session token to any future XSS. `user` is no longer cached
  // either (useAuth() always confirms identity via GET /auth/me against the
  // httpOnly cookie) — this function only sets the UX-routing cookie below.
  Cookies.set('user_role', user.role, { expires: 7, path: '/' });
}

export function clearAuth(): void {
  Cookies.remove('user_role');
}

export function redirectByRole(role: string): string {
  return role === 'admin' ? '/admin' : '/dashboard';
}
