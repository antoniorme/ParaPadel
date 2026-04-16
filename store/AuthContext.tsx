import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type UserRole = 'admin' | 'player' | 'superadmin' | 'pending' | null;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  determiningRole: boolean;
  role: UserRole;
  needsOnboarding: boolean;
  setNeedsOnboarding: (v: boolean) => void;
  refreshRole: () => Promise<void>;
  authDiag: string[];
  signOut: () => Promise<void>;
  isOfflineMode: boolean;
  isOnline: boolean;
  checkUserRole: (uid: string, email?: string) => Promise<UserRole>;
  loginWithDevBypass: (role: 'admin' | 'player' | 'superadmin') => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  determiningRole: false,
  role: null,
  needsOnboarding: false,
  setNeedsOnboarding: () => {},
  refreshRole: async () => {},
  authDiag: [],
  signOut: async () => {},
  isOfflineMode: false,
  isOnline: true,
  checkUserRole: async () => null,
  loginWithDevBypass: () => {},
});

const ROLE_STORAGE_KEY = 'padelpro_user_role';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [role, setRoleState] = useState<UserRole>(() => {
    const cached = localStorage.getItem(ROLE_STORAGE_KEY);
    return (cached as UserRole) || null;
  });
  const [determiningRole, setDeterminingRole] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(
    () => localStorage.getItem('padelpro_needs_onboarding') === 'true'
  );

  const setRole = (r: UserRole) => {
    setRoleState(r);
    if (r) localStorage.setItem(ROLE_STORAGE_KEY, r);
    else localStorage.removeItem(ROLE_STORAGE_KEY);
  };

  const setNeedsOnboardingSync = (v: boolean) => {
    setNeedsOnboarding(v);
    if (v) localStorage.setItem('padelpro_needs_onboarding', 'true');
    else localStorage.removeItem('padelpro_needs_onboarding');
  };

  const refreshRole = async () => {
    if (!user) return;
    setDeterminingRole(true);
    const r = await checkUserRole(user.id, user.email ?? undefined);
    setRole(r);
    setDeterminingRole(false);
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Diagnóstico visible en pantalla (temporal, ayuda a depurar)
  const [authDiag, setAuthDiag] = useState<string[]>([]);
  const diag = (msg: string) => setAuthDiag(prev => [...prev.slice(-9), msg]);

  // El rol viene SIEMPRE de Supabase — sin emails hardcodeados
  const checkUserRole = async (uid: string, userEmail?: string): Promise<UserRole> => {
    setAuthDiag([]);
    diag(`uid: ${uid.slice(0, 8)}… email: ${userEmail}`);
    try {
      const { data: superAdmin, error: e1 } = await supabase
        .from('superadmins').select('id').eq('email', userEmail).maybeSingle();
      diag(`superadmin: ${superAdmin ? '✅' : `❌ ${e1?.message || 'no encontrado'}`}`);
      if (superAdmin) return 'superadmin';

      const { data: club, error: e2 } = await supabase
        .from('clubs').select('id').eq('owner_id', uid).maybeSingle();
      diag(`club admin: ${club ? '✅' : `❌ ${e2?.message || 'no encontrado'}`}`);
      if (club) return 'admin';

      const { data: ownedTournaments, error: e3 } = await supabase
        .from('tournaments').select('id').eq('user_id', uid).limit(1).maybeSingle();
      diag(`tournaments: ${ownedTournaments ? '✅' : `❌ ${e3?.message || 'no encontrado'}`}`);
      if (ownedTournaments) return 'admin';

      const { data: playerProfile, error: e4 } = await supabase
        .from('players').select('id').eq('profile_user_id', uid).maybeSingle();
      diag(`player by uid: ${playerProfile ? '✅' : `❌ ${e4?.message || 'no encontrado'}`}`);
      if (playerProfile) return 'player';

      if (userEmail) {
        const { data: emailMatch, error: e5 } = await supabase
          .from('players').select('id').eq('email', userEmail).is('profile_user_id', null).maybeSingle();
        diag(`player by email: ${emailMatch ? '✅' : `❌ ${e5?.message || 'no encontrado'}`}`);
        if (emailMatch) {
          await supabase.from('players').update({ profile_user_id: uid }).eq('id', emailMatch.id);
          return 'player';
        }
      }

      const { error: insertErr } = await supabase.from('players').insert({
        profile_user_id: uid,
        email: userEmail || '',
        name: userEmail?.split('@')[0] || 'Jugador',
      });
      diag(`auto-create player: ${insertErr ? `❌ ${insertErr.message}` : '✅'}`);
      if (!insertErr) {
        localStorage.setItem('padelpro_needs_onboarding', 'true');
        return 'player';
      }
    } catch (e: any) {
      diag(`EXCEPCIÓN: ${e?.message || String(e)}`);
    }
    diag('→ resultado: null (sin rol)');
    return null;
  };

  // Solo disponible en desarrollo — Vite lo elimina del bundle de producción
  const loginWithDevBypass = (targetRole: 'admin' | 'player' | 'superadmin') => {
    if (!import.meta.env.DEV) return;
    setIsOfflineMode(true);
    const devUser = {
      id: `dev-${targetRole}-id`,
      email: `dev-${targetRole}@parapadel.local`,
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
    } as User;
    setUser(devUser);
    setSession({ user: devUser, access_token: 'dev-mock-token' } as Session);
    setRole(targetRole);
    setLoading(false);
    sessionStorage.setItem('padelpro_dev_mode', 'true');
  };

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      const timeoutId = setTimeout(() => { if (mounted) setLoading(false); }, 5000);

      if (sessionStorage.getItem('padelpro_dev_mode') === 'true') {
        if (mounted) { setIsOfflineMode(true); setLoading(false); clearTimeout(timeoutId); }
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          const hasCachedRole = !!role;
          if (hasCachedRole) { setLoading(false); clearTimeout(timeoutId); }

          if (session?.user) {
            setDeterminingRole(true);
            checkUserRole(session.user.id, session.user.email).then(serverRole => {
              if (mounted) {
                if (serverRole !== role) setRole(serverRole);
                if (!hasCachedRole) { setLoading(false); clearTimeout(timeoutId); }
                setDeterminingRole(false);
              }
            });
          } else {
            setRole(null); setLoading(false); clearTimeout(timeoutId);
          }
        }
      } catch (error) {
        if (mounted) { setSession(null); setUser(null); setRole(null); setLoading(false); clearTimeout(timeoutId); }
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isOfflineMode && mounted) {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (event === 'PASSWORD_RECOVERY') {
          // El usuario llegó desde un link de reset password — no redirigir, dejar que ResetPassword.tsx lo maneje
          setLoading(false);
          return;
        }

        if (currentUser && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED')) {
          setDeterminingRole(true);
          checkUserRole(currentUser.id, currentUser.email).then(r => {
            if (mounted) { setRole(r); setLoading(false); setDeterminingRole(false); }
          });
        } else if (!currentUser) {
          setRole(null);
          setLoading(false);
        }
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [isOfflineMode]);

  const signOut = async () => {
    if (isOfflineMode) {
      sessionStorage.removeItem('padelpro_dev_mode');
      localStorage.removeItem(ROLE_STORAGE_KEY);
      window.location.reload();
      return;
    }
    try { await supabase.auth.signOut(); }
    catch (error) { /* sign out failed */ }
    finally { setUser(null); setSession(null); setRole(null); localStorage.removeItem('padel_sim_player_id'); setLoading(false); }
  };

  return (
    <AuthContext.Provider value={{
      session, user, loading, determiningRole, role,
      needsOnboarding, setNeedsOnboarding: setNeedsOnboardingSync, refreshRole,
      authDiag,
      signOut, isOfflineMode, isOnline, checkUserRole, loginWithDevBypass,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
