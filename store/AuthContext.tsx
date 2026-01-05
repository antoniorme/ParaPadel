
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

  // Lógica de detección de roles robusta
  const checkUserRole = useCallback(async (uid: string, userEmail?: string): Promise<UserRole> => {
      if (!uid) return null;
      
      // 1. SuperAdmin Hardcoded
      if (userEmail === 'antoniorme@gmail.com') return 'superadmin';
      
      try {
          // 2. Check SuperAdmin en DB
          const { data: saData } = await supabase.from('superadmins').select('id').eq('email', userEmail).maybeSingle();
          if (saData) return 'superadmin';

          // 3. Check Dueño de Club (Admin) - Prioridad Alta
          const { data: clubData } = await supabase.from('clubs').select('id').eq('owner_id', uid).maybeSingle();
          if (clubData) return 'admin';

          // 4. Check Perfil Jugador con categoría Admin
          const { data: playerData } = await supabase
            .from('players')
            .select('categories')
            .eq('user_id', uid)
            .maybeSingle();
            
          if (playerData?.categories && Array.isArray(playerData.categories)) {
              if (playerData.categories.includes('Admin')) return 'admin';
          }

          // 5. Fallback de Emergencia & Auto-Reparación (Por Email)
          // Esto arregla cuentas recuperadas donde el UUID de Auth cambió pero los datos no.
          if (userEmail) {
              const { data: players } = await supabase
                  .from('players')
                  .select('id, user_id, categories')
                  .eq('email', userEmail);
              
              const adminPlayer = players?.find(p => p.categories && Array.isArray(p.categories) && p.categories.includes('Admin'));

              if (adminPlayer) {
                  // Si encontramos un perfil Admin por email, pero el ID no coincide, migramos los datos.
                  if (adminPlayer.user_id !== uid) {
                      console.log("AuthContext: Auto-reparando identidad Admin...", adminPlayer.user_id, "->", uid);
                      const oldId = adminPlayer.user_id;
                      
                      await Promise.all([
                          supabase.from('players').update({ user_id: uid }).eq('id', adminPlayer.id),
                          oldId ? supabase.from('clubs').update({ owner_id: uid }).eq('owner_id', oldId) : Promise.resolve(),
                          oldId ? supabase.from('tournaments').update({ user_id: uid }).eq('user_id', oldId) : Promise.resolve(),
                          oldId ? supabase.from('leagues').update({ club_id: uid }).eq('club_id', oldId) : Promise.resolve()
                      ]);
                  }
                  return 'admin';
              }
          }
      } catch (e) {
          console.error("Error verificando rol:", e);
      }

      // Default
      return 'player';
  }, []);

  useEffect(() => {
    let mounted = true;

    // Función orquestadora de inicio
    const initAuth = async () => {
        try {
            // 1. Obtener sesión inicial
            const { data: { session: initialSession } } = await supabase.auth.getSession();
            
            if (mounted) {
                if (initialSession) {
                    setSession(initialSession);
                    setUser(initialSession.user);
                    // IMPORTANTE: Esperamos al rol ANTES de quitar loading
                    const detectedRole = await checkUserRole(initialSession.user.id, initialSession.user.email);
                    if (mounted) setRole(detectedRole);
                } else {
                    setSession(null);
                    setUser(null);
                    setRole(null);
                }
            }
        } catch (error) {
            console.error("Auth init error:", error);
        } finally {
            if (mounted) setLoading(false);
        }
    };

    // Ejecutamos inicio
    initAuth();

    // 2. Suscripción a cambios en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!mounted) return;

        // Solo reaccionamos a cambios reales de sesión para evitar loops
        // SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED (si cambia el user)
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
             setSession(currentSession);
             setUser(currentSession?.user ?? null);
             if (currentSession) {
                 // Si nos logueamos, recalculamos rol
                 const r = await checkUserRole(currentSession.user.id, currentSession.user.email);
                 if (mounted) setRole(r);
             }
             if (mounted) setLoading(false);
        } 
        else if (event === 'SIGNED_OUT') {
             setSession(null);
             setUser(null);
             setRole(null);
             setLoading(false);
        }
    });

    // Fallback de seguridad: Si por alguna razón todo falla y se queda cargando 5s, forzamos la UI
    const safetyTimeout = setTimeout(() => {
        if (loading && mounted) {
            console.warn("Auth timeout reached, forcing loading false");
            setLoading(false);
        }
    }, 5000);

    return () => {
        mounted = false;
        clearTimeout(safetyTimeout);
        subscription.unsubscribe();
    };
  }, [checkUserRole]);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
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
    