
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
  authLogs: string[]; // Nuevo: Cola de logs para depuración visual
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
  checkUserRole: async () => 'player',
  loginWithDevBypass: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState('Esperando conexión...');
  const [authLogs, setAuthLogs] = useState<string[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const timeoutRef = useRef<any>(null);

  const addLog = (msg: string) => {
      console.log(`[AUTH] ${msg}`);
      setAuthLogs(prev => [...prev.slice(-10), `> ${msg}`]);
  };

  const checkUserRole = useCallback(async (uid: string, userEmail?: string): Promise<UserRole> => {
      if (!uid) {
          addLog("Error: UID no proporcionado");
          return null;
      }
      
      addLog(`Depurando UID: ${uid}`);
      addLog(`Email detectado: ${userEmail || 'Desconocido'}`);
      
      // Superadmin por Hardcode
      if (userEmail === 'antoniorme@gmail.com') {
          addLog("Identificado como SuperAdmin (Hardcoded)");
          return 'superadmin';
      }
      
      try {
          addLog("Consultando tabla 'superadmins'...");
          const { data: saData, error: saError } = await supabase.from('superadmins').select('id').eq('email', userEmail).maybeSingle();
          if (saData) {
              addLog("Rol encontrado en DB: SuperAdmin");
              return 'superadmin';
          }
          if (saError) addLog(`Error SuperAdmin: ${saError.message}`);

          addLog(`Consultando tabla 'clubs' buscando owner_id = ${uid}...`);
          const { data: clubData, error: clubError } = await supabase
              .from('clubs')
              .select('id, name, owner_id')
              .eq('owner_id', uid)
              .maybeSingle();
          
          if (clubData) {
              addLog(`¡ÉXITO! Club encontrado: ${clubData.name}`);
              addLog(`ID de Club: ${clubData.id}`);
              return 'admin';
          }

          if (clubError) {
              addLog(`ERROR DB CLUBS: ${clubError.message}`);
              setAuthStatus("Error de base de datos al buscar club");
          } else {
              addLog("RESULTADO: No hay club registrado para este UID");
          }

          // Si llegamos aquí, no es admin. Verificamos si es un jugador con cuenta.
          addLog("Verificando si es jugador registrado...");
          const { data: playerData } = await supabase.from('players').select('id').eq('profile_user_id', uid).maybeSingle();
          if (playerData) {
              addLog(`Rol detectado: JUGADOR (ID: ${playerData.id})`);
              return 'player';
          }

          addLog("No se encontró ningún rol. Asignando 'player' por defecto.");
          return 'player';
      } catch (e: any) {
          addLog(`EXCEPCIÓN CRÍTICA: ${e.message}`);
          return 'player';
      }
  }, []);

  useEffect(() => {
    const initSession = async () => {
        addLog("Iniciando verificación de sesión Supabase...");
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession) {
                setSession(currentSession);
                const currentUser = currentSession.user;
                setUser(currentUser);
                addLog("Sesión activa recuperada.");
                const r = await checkUserRole(currentUser.id, currentUser.email);
                setRole(r);
            } else {
                addLog("No hay sesión activa.");
                setAuthStatus("Inicia sesión para continuar");
            }
        } catch (error: any) {
            addLog(`Error recuperando sesión: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      addLog(`Evento Auth: ${event}`);
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
    });

    return () => {
        subscription.unsubscribe();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [checkUserRole]);

  const signOut = async () => {
    setLoading(true);
    addLog("Cerrando sesión...");
    try {
        await supabase.auth.signOut();
    } finally {
        setUser(null); setSession(null); setRole(null);
        localStorage.removeItem('padel_sim_player_id');
        setLoading(false);
    }
  };

  const loginWithDevBypass = (targetRole: 'admin' | 'player' | 'superadmin') => {
      addLog(`BYPASS LOCAL: Entrando como ${targetRole}`);
      setIsOfflineMode(true);
      const devUser = { id: `dev-${targetRole}`, email: `${targetRole}@local.test` } as User;
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
