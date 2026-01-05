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
      // Soluciona el caso de "Cuenta Recuperada/Recreada" donde el UUID de Auth ha cambiado
      // pero los registros de negocio (Club/Jugador) siguen apuntando al UUID antiguo.
      if (userEmail) {
          try {
              // Buscamos TODOS los jugadores con ese email para evitar error de 'multiple rows'
              const { data: players } = await supabase
                  .from('players')
                  .select('id, user_id, categories')
                  .eq('email', userEmail);
              
              // Filtramos si alguno es Admin
              const adminPlayer = players?.find(p => p.categories && Array.isArray(p.categories) && p.categories.includes('Admin'));

              if (adminPlayer) {
                  // ¡Encontrado perfil Admin por email!
                  
                  // Si el ID no coincide, ejecutamos MIGRACIÓN (Self-Healing)
                  // Esto actualiza las tablas para que apunten al nuevo usuario de Auth
                  if (adminPlayer.user_id !== uid) {
                      console.log("AuthContext: Detectado cambio de ID (Recovery). Ejecutando auto-reparación...", adminPlayer.user_id, "->", uid);
                      const oldId = adminPlayer.user_id;
                      
                      // 1. Actualizar ficha del Jugador Admin
                      await supabase.from('players').update({ user_id: uid }).eq('id', adminPlayer.id);
                      
                      // 2. Actualizar Club y otros datos si el oldId existía
                      if (oldId) {
                          await supabase.from('clubs').update({ owner_id: uid }).eq('owner_id', oldId);
                          await supabase.from('tournaments').update({ user_id: uid }).eq('user_id', oldId);
                          // Opcional: Ligas, etc.
                          await supabase.from('leagues').update({ club_id: uid }).eq('club_id', oldId);
                      }
                  }
                  
                  return 'admin';
              }
          } catch (e) {
              console.error("AuthContext: Error en fallback por email", e);
          }
      }

      // Default to player
      return 'player';
  }, []);

  useEffect(() => {
    // Escuchar cambios de estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
          setSession(session);
          setUser(session.user);
          const r = await checkUserRole(session.user.id, session.user.email);
          setRole(r);
      } else {
          setSession(null);
          setUser(null);
          setRole(null);
      }
      setLoading(false);
    });

    // Check inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
            setSession(session);
            setUser(session.user);
            const r = await checkUserRole(session.user.id, session.user.email);
            setRole(r);
        }
        setLoading(false);
    });

    return () => subscription.unsubscribe();
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