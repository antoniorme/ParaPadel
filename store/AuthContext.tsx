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
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState('Monitor Activo');
  const [authLogs, setAuthLogs] = useState<string[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const addLog = (msg: string) => {
      console.log(`[AUTH-SYS] ${msg}`);
      setAuthLogs(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString().split(' ')[0]} > ${msg}`]);
  };

  const checkUserRole = useCallback(async (uid: string, userEmail?: string): Promise<UserRole> => {
      if (!uid) {
          addLog("!!! ERROR: No hay UID de sesión");
          return null;
      }
      
      addLog(`RECONOCIMIENTO: UID [${uid}]`);
      
      // 0. COMPROBACIÓN MAESTRA (SuperAdmin Fijo)
      if (userEmail === 'antoniorme@gmail.com') {
          addLog("OK: SuperAdmin Maestro Concedido");
          return 'superadmin';
      }
      
      try {
          // 1. ¿ES DUEÑO DE CLUB? (ADMIN)
          addLog("CHECK 1: Buscando en 'clubs'...");
          const { data: clubData, error: clubError } = await supabase
              .from('clubs')
              .select('id, name')
              .eq('owner_id', uid)
              .maybeSingle();

          if (clubError) {
              addLog(`!!! ERROR DB CLUBS: ${clubError.message}`);
          } else if (clubData) {
              addLog(`OK: Detectado Dueño del Club '${clubData.name}'`);
              return 'admin';
          }

          // 2. ¿ES SUPERADMIN EN DB?
          addLog("CHECK 2: Buscando en 'superadmins'...");
          const { data: saData } = await supabase
              .from('superadmins')
              .select('id')
              .eq('email', userEmail)
              .maybeSingle();
          
          if (saData) {
              addLog("OK: Rol SuperAdmin validado en DB");
              return 'superadmin';
          }

          // 3. ¿ES JUGADOR VINCULADO?
          addLog("CHECK 3: Buscando ficha de jugador...");
          const { data: playerData } = await supabase
              .from('players')
              .select('id, name')
              .eq('profile_user_id', uid)
              .maybeSingle();
          
          if (playerData) {
              addLog(`OK: Ficha de jugador encontrada: ${playerData.name}`);
              return 'player';
          }

          // 4. FALLBACK FINAL: SI LLEGAMOS AQUÍ, ES UN JUGADOR NUEVO SIN FICHA
          addLog("AVISO: Usuario sin vinculación administrativa detectada.");
          addLog("RESULTADO: Acceso como Jugador Estándar.");
          return 'player';
          
      } catch (e: any) {
          addLog(`!!! FALLO CRÍTICO EN ROLE CHECK: ${e.message}`);
          return 'player'; 
      }
  }, []);

  useEffect(() => {
    const initSession = async () => {
        addLog("Conectando con Supabase Auth...");
        try {
            const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
                addLog(`!!! ERROR AL RECUPERAR SESIÓN: ${sessionError.message}`);
                setLoading(false);
                return;
            }

            if (currentSession) {
                setSession(currentSession);
                setUser(currentSession.user);
                addLog(`Sesión activa: ${currentSession.user.email}`);
                const r = await checkUserRole(currentSession.user.id, currentSession.user.email);
                setRole(r);
                setLoading(false);
            } else {
                addLog("No hay sesión. Esperando login...");
                setLoading(false);
            }
        } catch (error: any) {
            addLog(`!!! FALLO EN INICIALIZACIÓN: ${error.message}`);
            setLoading(false);
        }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      addLog(`AUTH_EVENT: ${event}`);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(session);
          if (session?.user) {
              setUser(session.user);
              const r = await checkUserRole(session.user.id, session.user.email);
              setRole(r);
              setLoading(false);
          }
      }
      if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setRole(null);
          setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkUserRole]);

  const signOut = async () => {
    setLoading(true);
    addLog("Saliendo...");
    await supabase.auth.signOut();
    window.location.reload();
  };

  const loginWithDevBypass = (targetRole: 'admin' | 'player' | 'superadmin') => {
      addLog(`BYPASS: Forzando acceso como ${targetRole.toUpperCase()}`);
      setIsOfflineMode(true);
      const devUser = { id: `dev-${targetRole}-${Date.now()}`, email: `${targetRole}@sandbox.test` } as User;
      setUser(devUser);
      setSession({ user: devUser, access_token: 'mock-jwt' } as Session);
      setRole(targetRole);
      setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, role, authStatus, authLogs, signOut, isOfflineMode, checkUserRole, loginWithDevBypass }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);