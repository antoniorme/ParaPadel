
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type UserRole = 'admin' | 'player' | null;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: UserRole;
  signOut: () => Promise<void>;
  isOfflineMode: boolean;
  checkUserRole: (uid: string, email?: string) => Promise<UserRole>;
  loginWithDevBypass: (role: 'admin' | 'player') => void;
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

  // Función crítica: Determina si es Club (Admin) o Jugador
  const checkUserRole = async (uid: string, userEmail?: string): Promise<UserRole> => {
      // 1. MODO LOCAL / OFFLINE
      if (isOfflineMode) {
          if (userEmail?.includes('admin') || userEmail?.includes('club')) {
              return 'admin';
          }
          return 'player';
      }

      // 2. MODO PRODUCCIÓN (Supabase)
      try {
          // Consultamos si este usuario está en la tabla de clubs como dueño
          const { data, error } = await supabase
              .from('clubs')
              .select('id')
              .eq('owner_id', uid)
              .maybeSingle();
          
          if (error) {
              // Si falla la consulta (ej. tabla no existe), asumimos player para no bloquear
              return 'player'; 
          }
          return data ? 'admin' : 'player';
      } catch (e) {
          return 'player';
      }
  };

  const loginWithDevBypass = (targetRole: 'admin' | 'player') => {
      setIsOfflineMode(true);
      const devUser = {
          id: targetRole === 'admin' ? 'dev-admin-id' : 'dev-player-id',
          email: targetRole === 'admin' ? 'admin@padelpro.local' : 'player@padelpro.local',
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {}
      } as User;
      
      setUser(devUser);
      setSession({ user: devUser, access_token: 'mock-token' } as Session);
      setRole(targetRole);
      setLoading(false);
      
      // Guardar flag en sessionStorage para persistir en recargas durante la sesión
      sessionStorage.setItem('padelpro_dev_mode', 'true');
  };

  useEffect(() => {
    const initSession = async () => {
        // DETECCIÓN ROBUSTA DE ENTORNO SIN CRASHES
        let shouldUseOffline = false;

        // Comprobación 1: URL Placeholder
        // Accedemos a la propiedad privada 'supabaseUrl' si existe, o inferimos por el comportamiento
        if ((supabase as any).supabaseUrl === 'https://placeholder.supabase.co') {
             shouldUseOffline = true;
        }

        // Comprobación 2: Localhost
        if (typeof window !== 'undefined') {
            const h = window.location.hostname;
            if (h === 'localhost' || h === '127.0.0.1') {
                // En local permitimos offline si falla la conexión, pero no lo forzamos a menos que falle
            }
        }

        // Comprobación 3: Flag de sesión
        const storedDevMode = sessionStorage.getItem('padelpro_dev_mode') === 'true';
        if (storedDevMode) shouldUseOffline = true;

        if (shouldUseOffline) {
            console.log("🛠️ AuthContext: Modo Offline/Dev activado.");
            setIsOfflineMode(true);
            setLoading(false);
            return;
        }

        // INTENTO DE CONEXIÓN REAL
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
            console.warn("Auth Init: No se pudo conectar a Supabase. Activando modo offline fallback.");
            // Si falla la conexión inicial, activamos modo offline para permitir el bypass
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
        if(confirm("Estás en modo desarrollo local. ¿Cerrar sesión simulada?")) {
            sessionStorage.removeItem('padelpro_dev_mode');
            window.location.reload();
        }
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
