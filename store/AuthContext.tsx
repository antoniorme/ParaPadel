import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type UserRole = 'admin' | 'player' | 'superadmin' | 'pending' | null;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: UserRole;
  authStatus: string;
  authLogs: string[];
  signOut: () => Promise<void>;
  isOfflineMode: boolean;
  checkUserRole: (uid: string, email?: string) => Promise<UserRole>;
  loginWithDevBypass: (role: 'admin' | 'player' | 'superadmin') => void;
  addLog: (msg: string) => void;
  recoveryMode: boolean;
  setRecoveryMode: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  role: null,
  authStatus: 'Iniciando...',
  authLogs: [],
  signOut: async () => {},
  isOfflineMode: false,
  checkUserRole: async () => null,
  loginWithDevBypass: () => {},
  addLog: () => {},
  recoveryMode: false,
  setRecoveryMode: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState('Monitor Activo');
  const [authLogs, setAuthLogs] = useState<string[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const addLog = useCallback((msg: string) => {
      console.log(`[AUTH-SYS] ${msg}`);
      setAuthLogs(prev => [...prev.slice(-30), `${new Date().toLocaleTimeString().split(' ')[0]} > ${msg}`]);
  }, []);

  const checkUserRole = useCallback(async (uid: string, userEmail?: string): Promise<UserRole> => {
      if (!uid) return null;
      addLog(`CHECK ROL: ${userEmail}`);
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
  }, [addLog]);

  useEffect(() => {
    const initSession = async () => {
        addLog("Consultando sesión actual...");
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession) {
                setSession(currentSession);
                setUser(currentSession.user);
                const r = await checkUserRole(currentSession.user.id, currentSession.user.email);
                setRole(r);
            }
        } catch (error: any) {
            addLog(`FALLO INICIAL: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      addLog(`EVENTO_AUTH: ${event}`);
      
      // DETECCIÓN EXPLÍCITA DE RECUPERACIÓN (Protocolo Supabase)
      if (event === 'PASSWORD_RECOVERY') {
          addLog("MODO RECUPERACIÓN ACTIVADO POR SDK");
          setRecoveryMode(true);
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setSession(session);
          if (session?.user) {
              setUser(session.user);
              const r = await checkUserRole(session.user.id, session.user.email);
              setRole(r);
          }
      }
      if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setRole(null);
          setRecoveryMode(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkUserRole, addLog]);

  const signOut = async () => {
    setLoading(true);
    addLog("Cerrando sesión...");
    await supabase.auth.signOut();
    window.location.reload();
  };

  const loginWithDevBypass = (role: 'admin' | 'player' | 'superadmin') => {
      // Fix: Changed 'targetRole' to 'role' as 'targetRole' was not defined.
      addLog(`BYPASS: ${role}`);
      setIsOfflineMode(true);
      const devUser = { id: `dev-${role}`, email: `${role}@sandbox.test` } as User;
      setUser(devUser);
      setSession({ user: devUser, access_token: 'mock' } as Session);
      setRole(role);
      setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ 
        session, user, loading, role, authStatus, authLogs, signOut, 
        isOfflineMode, checkUserRole, loginWithDevBypass, addLog,
        recoveryMode, setRecoveryMode
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);