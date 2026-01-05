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
      
      // 1. Check SuperAdmin (Hardcoded + DB)
      if (userEmail === 'antoniorme@gmail.com') return 'superadmin';
      try {
          const { data: saData } = await supabase.from('superadmins').select('id').eq('email', userEmail).maybeSingle();
          if (saData) return 'superadmin';
      } catch (e) {}

      // 2. Check Club Owner (Standard - by ID)
      try {
          const { data: clubData } = await supabase.from('clubs').select('id').eq('owner_id', uid).maybeSingle();
          if (clubData) return 'admin';
      } catch (e) {}

      // 3. Check Player Profile by ID for 'Admin' category
      try {
          const { data: playerData } = await supabase
            .from('players')
            .select('categories')
            .eq('user_id', uid)
            .maybeSingle();
            
          if (playerData?.categories && Array.isArray(playerData.categories)) {
              if (playerData.categories.includes('Admin')) return 'admin';
          }
      } catch (e) {}

      // 4. Emergency Fallback & Self-Healing (Check by EMAIL)
      if (userEmail) {
          try {
              const { data: players } = await supabase
                  .from('players')
                  .select('id, user_id, categories')
                  .eq('email', userEmail);
              
              const adminPlayer = players?.find(p => p.categories && Array.isArray(p.categories) && p.categories.includes('Admin'));

              if (adminPlayer) {
                  if (adminPlayer.user_id !== uid) {
                      console.log("AuthContext: Detectado cambio de ID (Recovery). Ejecutando auto-reparación...", adminPlayer.user_id, "->", uid);
                      const oldId = adminPlayer.user_id;
                      
                      // Ejecutar actualizaciones en paralelo para velocidad
                      await Promise.all([
                          supabase.from('players').update({ user_id: uid }).eq('id', adminPlayer.id),
                          oldId ? supabase.from('clubs').update({ owner_id: uid }).eq('owner_id', oldId) : Promise.resolve(),
                          oldId ? supabase.from('tournaments').update({ user_id: uid }).eq('user_id', oldId) : Promise.resolve(),
                          oldId ? supabase.from('leagues').update({ club_id: uid }).eq('club_id', oldId) : Promise.resolve()
                      ]);
                  }
                  return 'admin';
              }
          } catch (e) {
              console.error("AuthContext: Error en fallback por email", e);
          }
      }

      return 'player';
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
        try {
            // 1. Obtener sesión inicial
            const { data: { session: initialSession } } = await supabase.auth.getSession();
            
            if (mounted) {
                if (initialSession) {
                    setSession(initialSession);
                    setUser(initialSession.user);
                    const r = await checkUserRole(initialSession.user.id, initialSession.user.email);
                    if (mounted) setRole(r);
                }
            }
        } catch (error) {
            console.error("Error initializing auth:", error);
        } finally {
            if (mounted) setLoading(false);
        }
    };

    initializeAuth();

    // 2. Suscribirse a cambios (Login/Logout dinámico)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!mounted) return;
        
        // Solo actualizamos si el estado es diferente al que ya tenemos (para evitar parpadeos si getSession ya resolvió)
        if (currentSession?.user?.id !== session?.user?.id || event === 'SIGNED_OUT') {
             if (currentSession) {
                setSession(currentSession);
                setUser(currentSession.user);
                // Si es un cambio de usuario, volvemos a mostrar loading brevemente si queremos, 
                // o simplemente resolvemos el rol en segundo plano.
                // Aquí optamos por resolver rol antes de dar por terminado el cambio.
                const r = await checkUserRole(currentSession.user.id, currentSession.user.email);
                if (mounted) setRole(r);
            } else {
                setSession(null);
                setUser(null);
                setRole(null);
            }
            // Aseguramos loading false por si acaso onAuthStateChange dispara antes que initializeAuth (raro pero posible)
            if (mounted) setLoading(false);
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, [checkUserRole]); // Eliminamos 'session' de dependencias para evitar bucles

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