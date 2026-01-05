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

  // Lógica DIRECTA de detección de roles (Sin etiquetas, solo tablas)
  const checkUserRole = useCallback(async (uid: string, userEmail?: string): Promise<UserRole> => {
      if (!uid) return null;
      
      try {
          // 1. Verificación SuperAdmin (Tabla 'superadmins')
          if (userEmail) {
              const { data: saData } = await supabase
                  .from('superadmins')
                  .select('id')
                  .eq('email', userEmail)
                  .maybeSingle();
              
              if (saData) return 'superadmin';
          }

          // 2. Verificación Admin de Club (Tabla 'clubs')
          // Si el ID del usuario coincide con el 'owner_id' de algún club, es Admin.
          const { data: clubData } = await supabase
              .from('clubs')
              .select('id')
              .eq('owner_id', uid)
              .maybeSingle();

          if (clubData) return 'admin';

          // 3. Por defecto, es Jugador
          return 'player';

      } catch (e) {
          console.error("Error verificando rol:", e);
          return 'player'; // En caso de error, degradar a permisos mínimos por seguridad
      }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
        try {
            // Paso 1: Obtener sesión actual de Supabase
            const { data: { session: initialSession } } = await supabase.auth.getSession();
            
            if (mounted) {
                if (initialSession) {
                    setSession(initialSession);
                    setUser(initialSession.user);
                    
                    // Paso 2: CRÍTICO - Esperar a verificar el rol ANTES de quitar el loading
                    // Esto evita que la app cargue como 'player' y luego cambie a 'admin'
                    const detectedRole = await checkUserRole(initialSession.user.id, initialSession.user.email);
                    
                    if (mounted) setRole(detectedRole);
                } else {
                    // No hay sesión
                    setSession(null);
                    setUser(null);
                    setRole(null);
                }
            }
        } catch (error) {
            console.error("Error en inicialización de Auth:", error);
        } finally {
            // Paso 3: Solo ahora permitimos que la app se renderice
            if (mounted) setLoading(false);
        }
    };

    initAuth();

    // Escuchar cambios de sesión (Login/Logout en tiempo real)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!mounted) return;
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
             setSession(currentSession);
             setUser(currentSession?.user ?? null);
             
             if (currentSession) {
                 const r = await checkUserRole(currentSession.user.id, currentSession.user.email);
                 if (mounted) setRole(r);
             }
             
             setLoading(false);
        } else if (event === 'SIGNED_OUT') {
             setSession(null);
             setUser(null);
             setRole(null);
             setLoading(false);
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, [checkUserRole]);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    // Forzar recarga para limpiar cualquier estado en memoria
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