'use client';

import { useState, useEffect } from 'react';
import { getStoredUser, clearAuth } from '@/lib/auth';
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
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      setLoading(false);
    } else {
      auth.me()
        .then(data => setUser(data.user))
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    }
  }, []);

  const logout = async () => {
    await auth.logout().catch(() => null);
    clearAuth();
    setUser(null);
    router.push('/login');
  };

  return { user, loading, logout };
}
