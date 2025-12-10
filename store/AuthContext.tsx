import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type UserRole = 'admin' | 'player' | 'superadmin' | null;

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
  checkUserRole: async () => 'player',
  loginWithDevBypass: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Función crítica: Determina si es Club (Admin), SuperAdmin o Jugador
  const checkUserRole = async (uid: string, userEmail?: string): Promise<UserRole> => {
      // 1. SUPER ADMIN CHECK (DB + Fallback)
      if (userEmail) {
          // Hardcoded Fallback (Seguridad por si la tabla no existe aún)
          if (userEmail === 'antoniorme@gmail.com') return 'superadmin';

          try {
              // Consultamos tabla whitelist de superadmins
              const { data: saData } = await supabase
                  .from('superadmins')
                  .select('id')
                  .eq('email', userEmail)
                  .maybeSingle();
              
              if (saData) return 'superadmin';
          } catch (e) {
              console.warn('Error checking superadmin table, falling back to basic role check');
          }
      }

      // 2. MODO LOCAL / OFFLINE
      if (isOfflineMode) {
          if (userEmail?.includes('admin') || userEmail?.includes('club')) {
              return 'admin';
          }
          return 'player';
      }

      // 3. MODO PRODUCCIÓN (Supabase - Club Check)
      try {
          // Consultamos si este usuario está en la tabla de clubs como dueño
          const { data, error } = await supabase
              .from('clubs')
              .select('id')
              .eq('owner_id', uid)
              .maybeSingle();
          
          if (error) {
              return 'player'; 
          }
          return data ? 'admin' : 'player';
      } catch (e) {
          return 'player';
      }
  };

  const loginWithDevBypass = (targetRole: 'admin' | 'player' | 'superadmin') => {
      setIsOfflineMode(true);
      const devUser = {
          id: targetRole === 'admin' ? 'dev-admin-id' : targetRole === 'superadmin' ? 'dev-super-id' : 'dev-player-id',
          email: targetRole === 'superadmin' ? 'antoniorme@gmail.com' : targetRole === 'admin' ? 'admin@padelpro.local' : 'player@padelpro.local',
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {}
      } as User;
      
      setUser(devUser);
      setSession({ user: devUser, access_token: 'mock-token' } as Session);
      setRole(targetRole);
      setLoading(false);
      
      sessionStorage.setItem('padelpro_dev_mode', 'true');
  };

  useEffect(() => {
    const initSession = async () => {
        let shouldUseOffline = false;

        // @ts-ignore
        if ((supabase as any).supabaseUrl === 'https://placeholder.supabase.co') {
             shouldUseOffline = true;
        }

        const storedDevMode = sessionStorage.getItem('padelpro_dev_mode') === 'true';
        if (storedDevMode) shouldUseOffline = true;

        if (shouldUseOffline) {
            setIsOfflineMode(true);
            setLoading(false);
            return;
        }

        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            
            setSession(session);
            setUser(session?.user ?? null);
            
            if (session?.user) {
                const r = await checkUserRole(session.user.id, session.user.email);
                setRole(r);
            }
        } catch (error) {
            setIsOfflineMode(true);
            setSession(null);
            setUser(null);
            setRole(null);
        } finally {
            setLoading(false);
        }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isOfflineMode) {
          setSession(session);
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          
          if (currentUser) {
              const r = await checkUserRole(currentUser.id, currentUser.email);
              setRole(r);
          } else {
              setRole(null);
          }
          setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [isOfflineMode]);

  const signOut = async () => {
    if (isOfflineMode) {
        sessionStorage.removeItem('padelpro_dev_mode');
        window.location.reload();
    } else {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setRole(null);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, role, signOut, isOfflineMode, checkUserRole, loginWithDevBypass }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
