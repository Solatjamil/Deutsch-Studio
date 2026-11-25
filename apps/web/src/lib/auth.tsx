import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, bootstrapCsrf } from './api';

export type User = {
  id: number; name: string; role: 'student' | 'parent' | 'tutor' | 'admin';
  email?: string | null; phone?: string; level?: string | null; batch_id?: number | null;
};

type AuthState = {
  user: User | null;
  children: any[];
  institute: any;
  loading: boolean;
  refresh: () => Promise<void>;
  loginPassword: (email: string, password: string) => Promise<void>;
  loginOtp: (phone: string, code: string, name?: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;
  switchRole: (role: string) => Promise<void>;
  isStaff: boolean;
};

const Ctx = createContext<AuthState>(null as any);

export function AuthProvider({ children: kids }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [childList, setChildList] = useState<any[]>([]);
  const [institute, setInstitute] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user); setChildList(data.children || []); setInstitute(data.institute);
    } catch { setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const role = localStorage.getItem('ds-demo-role') || 'student';
    bootstrapCsrf()
      .then(() => api.post('/auth/demo', { role }))
      .then((d) => { setUser(d.user); return refresh(); })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    const expired = () => { setUser(null); document.cookie = 'ds_session=; Max-Age=0; path=/'; };
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, [refresh]);

  const value = useMemo<AuthState>(() => ({
    user, children: childList, institute, loading, refresh,
    loginPassword: async (email, password) => { const d = await api.post('/auth/password', { email, password }); setUser(d.user); await refresh(); },
    loginOtp: async (phone, code, name, role) => { const d = await api.post('/auth/otp/verify', { phone, code, name, role }); setUser(d.user); await refresh(); },
    logout: async () => { try { await api.post('/auth/logout'); } finally { setUser(null); setChildList([]); } },
    updateProfile: async (patch) => { await api.patch('/auth/profile', patch); await refresh(); },
    switchRole: async (role) => {
      localStorage.setItem('ds-demo-role', role);
      await api.post('/auth/demo', { role });
      await refresh();
    },
    isStaff: user?.role === 'tutor' || user?.role === 'admin',
  }), [user, childList, institute, loading, refresh]);

  return <Ctx.Provider value={value}>{kids}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
