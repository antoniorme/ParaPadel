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
  const [authStatus, setAuthStatus] = useState('Monitor de Sistema Activo');
  const [authLogs, setAuthLogs] = useState<string[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const addLog = (msg: string) => {
      console.log(`[SYS-DIAG] ${msg}`);
      setAuthLogs(prev => [...prev.slice(-15), `${new Date().toLocaleTimeString().split(' ')[0]} > ${msg}`]);
  };

  const checkUserRole = useCallback(async (uid: string, userEmail?: string): Promise<UserRole> => {
      if (!uid) {
          addLog("!!! ERROR: UID inexistente en la sesión");
          return null;
      }
      
      addLog(`INICIO: Verificando identidad [${uid.substring(0,8)}...]`);
      
      // 0. HARDCODED SUPERADMIN
      if (userEmail === 'antoniorme@gmail.com') {
          addLog("OK: SuperAdmin detectado por email fijo");
          return 'superadmin';
      }
      
      try {
          // 1. COMPROBAR TABLA CLUBS (ADMIN)
          addLog("PASO 1: ¿Eres dueño de club? Buscando en 'clubs'...");
          const { data: clubData, error: clubError } = await supabase
              .from('clubs')
              .select('id, name')
              .eq('owner_id', uid)
              .maybeSingle();

          if (clubError) {
              addLog(`!!! ERROR DB CLUBS: ${clubError.message}`);
          } else if (clubData) {
              addLog(`OK: Dueño del club '${clubData.name}' detectado`);
              return 'admin';
          }

          // 2. COMPROBAR TABLA SUPERADMINS
          addLog("PASO 2: ¿Eres SuperAdmin? Buscando en 'superadmins'...");
          const { data: saData, error: saError } = await supabase
              .from('superadmins')
              .select('id')
              .eq('email', userEmail)
              .maybeSingle();
          
          if (saData) {
              addLog("OK: Rol SuperAdmin confirmado en DB");
              return 'superadmin';
          }

          // 3. COMPROBAR TABLA PLAYERS (JUGADOR VINCULADO)
          addLog("PASO 3: ¿Tienes perfil de jugador? Buscando en 'players'...");
          const { data: playerData, error: playerError } = await supabase
              .from('players')
              .select('id, name')
              .eq('profile_user_id', uid)
              .maybeSingle();
          
          if (playerData) {
              addLog(`OK: Perfil de jugador '${playerData.name}' encontrado`);
              return 'player';
          }

          // 4. FALLBACK FINAL: JUGADOR GENÉRICO (Si no es admin ni tiene ficha, le dejamos entrar como jugador básico)
          addLog("AVISO: No eres admin ni tienes ficha previa. Rol asignado: player");
          return 'player';
          
      } catch (e: any) {
          addLog(`!!! EXCEPCIÓN CRÍTICA: ${e.message}`);
          setAuthStatus(`Error interno: ${e.message}`);
          return 'player'; // En caso de fallo crítico, dejamos que entre como player para que no se bloquee la pantalla de carga
      }
  }, []);

  useEffect(() => {
    const initSession = async () => {
        addLog("Conectando con Supabase Auth...");
        try {
            const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
                addLog(`!!! ERROR SESIÓN: ${sessionError.message}`);
                setLoading(false);
                return;
            }

            if (currentSession) {
                setSession(currentSession);
                setUser(currentSession.user);
                addLog(`Sesión: ${currentSession.user.email}`);
                const r = await checkUserRole(currentSession.user.id, currentSession.user.email);
                setRole(r);
                setLoading(false);
            } else {
                addLog("Sesión vacía. Esperando login...");
                setLoading(false);
            }
        } catch (error: any) {
            addLog(`!!! ERROR INICIO: ${error.message}`);
            setLoading(false);
        }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      addLog(`EVENTO AUTH: ${event}`);
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
    addLog("Cerrando sesión...");
    await supabase.auth.signOut();
    window.location.reload();
  };

  const loginWithDevBypass = (targetRole: 'admin' | 'player' | 'superadmin') => {
      addLog(`BYPASS: Forzando rol ${targetRole}`);
      setIsOfflineMode(true);
      const devUser = { id: `dev-${targetRole}`, email: `${targetRole}@sandbox.test` } as User;
      setUser(devUser);
      setSession({ user: devUser, access_token: 'mock' } as Session);
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