import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type UserRole = 'admin' | 'player' | 'superadmin' | 'pending' | null;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: UserRole;
  signOut: () => Promise<void>;
  isOfflineMode: boolean;
  checkUserRole: (uid: string, email?: string) => Promise<UserRole>;
  loginWithDevBypass: (role: 'admin' | 'player' | 'superadmin') => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  role: null,
  signOut: async () => {},
  isOfflineMode: false,
  checkUserRole: async () => null,
  loginWithDevBypass: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const checkUserRole = useCallback(async (uid: string, userEmail?: string): Promise<UserRole> => {
      if (!uid) return null;
      
      // 1. Check SuperAdmin (Hardcoded + DB)
      if (userEmail === 'antoniorme@gmail.com') return 'superadmin';
      try {
          const { data: saData } = await supabase.from('superadmins').select('id').eq('email', userEmail).maybeSingle();
          if (saData) return 'superadmin';
      } catch (e) {}

      // 2. Check Club Owner (Standard)
      try {
          const { data: clubData } = await supabase.from('clubs').select('id').eq('owner_id', uid).maybeSingle();
          if (clubData) return 'admin';
      } catch (e) {}

      // 3. Fallback: Check Player Profile for 'Admin' category
      // Esto soluciona casos donde la recuperación de cuenta o invitaciones rápidas
      // asignan permisos vía la tabla de players en lugar de la tabla clubs directamente.
      try {
          const { data: playerData } = await supabase
            .from('players')
            .select('categories')
            .eq('user_id', uid)
            .maybeSingle();
            
          if (playerData && playerData.categories && Array.isArray(playerData.categories)) {
              // Si tiene la categoría especial 'Admin', le damos rol de admin
              if (playerData.categories.includes('Admin')) return 'admin';
          }
      } catch (e) {}

      // Default to player
      return 'player';
  }, []);

  useEffect(() => {
    // Escuchar cambios de estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
          setSession(session);
          setUser(session.user);
          // Forzamos un pequeño delay para asegurar que triggers de DB (si los hay) hayan corrido
          const r = await checkUserRole(session.user.id, session.user.email);
          setRole(r);
      } else {
          setSession(null);
          setUser(null);
          setRole(null);
      }
      setLoading(false);
    });

    // Check inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
            setSession(session);
            setUser(session.user);
            const r = await checkUserRole(session.user.id, session.user.email);
            setRole(r);
        }
        setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkUserRole]);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    // Usamos reload para limpiar completamente el estado de la memoria
    window.location.reload();
  };

  const loginWithDevBypass = (role: 'admin' | 'player' | 'superadmin') => {
      setIsOfflineMode(true);
      const devUser = { id: `dev-${role}`, email: `${role}@sandbox.test` } as User;
      setUser(devUser);
      setSession({ user: devUser, access_token: 'mock' } as Session);
      setRole(role);
      setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ 
        session, user, loading, role, signOut, 
        isOfflineMode, checkUserRole, loginWithDevBypass
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);