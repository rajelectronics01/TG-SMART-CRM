import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import type { Employee } from '../supabase/database.types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  employee: Employee | null;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { readonly children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchEmployee(session.user.id);
      else setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user) {
        fetchEmployee(session.user.id);
        if (event === 'SIGNED_IN') {
          // Track last login time without breaking UI flow
          (supabase.from('employees') as any).update({ last_login_at: new Date().toISOString() }).eq('id', session.user.id).then();
        }
      } else {
        setEmployee(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchEmployee(userId: string) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setEmployee(data);
    } catch (err) {
      console.error('Failed to fetch employee profile:', err);
      setEmployee(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setEmployee(null);
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    employee,
    isAdmin: employee?.role === 'admin',
    isManager: employee?.role === 'manager',
    isStaff: employee?.role === 'employee',
    isLoading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
