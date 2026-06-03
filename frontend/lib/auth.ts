'use client';

export function saveAuth(token: string, user: { role: string; id: string; email: string }): void {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_user',  JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
}

export function getStoredUser(): { id: string; email: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('auth_user');
  if (!raw) return null;
  try { return JSON.parse(raw) as { id: string; email: string; role: string }; }
  catch { return null; }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function redirectByRole(role: string): string {
  return role === 'admin' ? '/admin' : '/dashboard';
}
