
import React, { createContext, useContext, useEffect, useState } from 'react';
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
  checkUserRole: async () => 'player',
  loginWithDevBypass: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const checkUserRole = async (uid: string, userEmail?: string): Promise<UserRole> => {
      if (userEmail === 'antoniorme@gmail.com') return 'superadmin';
      if (isOfflineMode) return (userEmail?.includes('admin') || userEmail?.includes('club')) ? 'admin' : 'player';

      try {
          const { data: saData } = await supabase.from('superadmins').select('id').eq('email', userEmail).maybeSingle();
          if (saData) return 'superadmin';
          const { data: clubData } = await supabase.from('clubs').select('id').eq('owner_id', uid).maybeSingle();
          if (clubData) return 'admin';
          return 'player';
      } catch (e) {
          return 'player';
      }
  };

  const loginWithDevBypass = (targetRole: 'admin' | 'player' | 'superadmin') => {
      setIsOfflineMode(true);
      const devUser = { id: `dev-${targetRole}`, email: `${targetRole}@local.test`, aud: 'authenticated' } as User;
      setUser(devUser);
      setSession({ user: devUser, access_token: 'mock' } as Session);
      setRole(targetRole);
      setLoading(false);
      sessionStorage.setItem('padelpro_dev_mode', 'true');
  };

  useEffect(() => {
    const initSession = async () => {
        const url = window.location.href;
        
        if (url.includes('access_token=')) {
            try {
                const parts = url.split('#');
                const tokenPart = parts.find(p => p.includes('access_token='));
                
                if (tokenPart) {
                    const params = new URLSearchParams(tokenPart.startsWith('/') ? tokenPart.split('?')[1] : tokenPart);
                    const access_token = params.get('access_token');
                    const refresh_token = params.get('refresh_token');

                    if (access_token) {
                        const { data, error } = await supabase.auth.setSession({
                            access_token,
                            refresh_token: refresh_token || '',
                        });
                        
                        if (data.session) {
                            setSession(data.session);
                            setUser(data.session.user);
                            const r = await checkUserRole(data.session.user.id, data.session.user.email);
                            setRole(r);
                            
                            // LIMPIEZA CRITICA: Borramos el hash para que no interfiera con el cambio de clave
                            window.history.replaceState(null, '', window.location.origin + '/#/auth?type=recovery_verified');
                        }
                    }
                }
            } catch (e) {
                console.error("Error in manual token injection", e);
            } finally {
                setLoading(false);
                return;
            }
        }

        const storedDevMode = sessionStorage.getItem('padelpro_dev_mode') === 'true';
        // @ts-ignore
        if (storedDevMode || (supabase as any).supabaseUrl === 'https://placeholder.supabase.co') {
            setIsOfflineMode(true);
            setLoading(false);
            return;
        }

        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession) {
                setSession(currentSession);
                setUser(currentSession.user);
                const r = await checkUserRole(currentSession.user.id, currentSession.user.email);
                setRole(r);
            }
        } catch (error) {
            console.warn("Auth initialization error", error);
        } finally {
            setLoading(false);
        }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
        return;
    } 
    await supabase.auth.signOut();
    setUser(null); setSession(null); setRole(null);
    localStorage.removeItem('padel_sim_player_id');
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, role, signOut, isOfflineMode, checkUserRole, loginWithDevBypass }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
