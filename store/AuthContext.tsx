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
      if (userEmail === 'antoniorme@gmail.com') return 'superadmin';
      try {
          const { data: saData } = await supabase.from('superadmins').select('id').eq('email', userEmail).maybeSingle();
          if (saData) return 'superadmin';
      } catch (e) {}
      try {
          const { data: clubData } = await supabase.from('clubs').select('id').eq('owner_id', uid).maybeSingle();
          if (clubData) return 'admin';
      } catch (e) {}
      return 'player';
  }, []);

  useEffect(() => {
    const initSession = async () => {
        const fullUrl = window.location.href;
        
        // HELPER: Extraer cualquier parámetro de la URL completa, ignorando los '#'
        // Esto soluciona el problema del "doble #" (ej: /#/auth#access_token=...)
        const getRawParam = (key: string) => {
            const regex = new RegExp(`[#?&]${key}=([^&]*)`);
            const match = fullUrl.match(regex);
            return match ? match[1] : null;
        };

        const accessToken = getRawParam('access_token');
        const refreshToken = getRawParam('refresh_token');

        // Si detectamos tokens, los procesamos ANTES de cualquier otra cosa
        if (accessToken && refreshToken) {
            try {
                console.log("Tokens detectados, iniciando sesión forzada...");
                const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                });
                
                if (error) throw error;

                if (data.session) {
                    setSession(data.session);
                    setUser(data.session.user);
                    const r = await checkUserRole(data.session.user.id, data.session.user.email);
                    setRole(r);
                    console.log("Sesión recuperada con éxito");
                }
            } catch (e) {
                console.error("Error crítico procesando tokens de recuperación:", e);
            }
        } else {
            // Carga normal si no hay tokens
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (currentSession) {
                    setSession(currentSession);
                    setUser(currentSession.user);
                    const r = await checkUserRole(currentSession.user.id, currentSession.user.email);
                    setRole(r);
                }
            } catch (error: any) {
                console.error("Error en carga de sesión inicial:", error);
            }
        }
        setLoading(false);
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
          setSession(session);
          setUser(session.user);
          const r = await checkUserRole(session.user.id, session.user.email);
          setRole(r);
      } else {
          setSession(null);
          setUser(null);
          setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkUserRole]);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    window.location.hash = '#/';
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