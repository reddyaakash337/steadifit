import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { AuthServiceError, SignUpData, authRepository } from '@/data/repositories/auth';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
type AuthContextValue = {
  status: AuthStatus;
  loading: boolean;
  authenticated: boolean;
  unauthenticated: boolean;
  session: Session | null;
  user: User | null;
  signUp: (email: string, password: string) => Promise<{ data: SignUpData | null; error: AuthServiceError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthServiceError | null }>;
  signOut: () => Promise<{ error: AuthServiceError | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribe = authRepository.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    void authRepository.getSession().then((result) => {
      if (!active) return;
      if (!result.error) setSession(result.data.session);
      else setSession(null);
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const status: AuthStatus = loading ? 'loading' : session ? 'authenticated' : 'unauthenticated';
    return {
      status,
      loading,
      authenticated: status === 'authenticated',
      unauthenticated: status === 'unauthenticated',
      session,
      user: session?.user ?? null,
      signUp: async (email, password) => {
        const result = await authRepository.signUp(email, password);
        return { data: result.data, error: result.error };
      },
      signIn: async (email, password) => {
        const result = await authRepository.signIn(email, password);
        return { error: result.error };
      },
      signOut: async () => {
        const result = await authRepository.signOut();
        return { error: result.error };
      },
    };
  }, [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
