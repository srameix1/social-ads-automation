'use client';

import { useState, useEffect } from 'react';
import { clearAuth } from '@/lib/auth';
import { auth } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface AuthUser {
  id:    string;
  email: string;
  role:  string;
}

export function useAuth() {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Always ask the backend — it validates the httpOnly session cookie
    // server-side. No client-cached shortcut: a locally-forged or stale
    // cached identity should never substitute for a real check.
    auth.me()
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await auth.logout().catch(() => null);
    clearAuth();
    setUser(null);
    router.push('/login');
  };

  return { user, loading, logout };
}
