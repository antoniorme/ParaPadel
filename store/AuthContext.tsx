import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';

// NOTA: Supabase desactivado temporalmente para entrar directo al Dashboard.
// import { supabase } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // --- BYPASS: SIMULAR LOGIN INMEDIATO ---
    const mockUser = {
      id: 'dev-bypass-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@padel.local',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: new Date().toISOString(),
    } as unknown as User;

    const mockSession = {
      access_token: 'mock-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh',
      user: mockUser
    } as unknown as Session;

    setUser(mockUser);
    setSession(mockSession);
    setLoading(false);
    
  }, []);

  const signOut = async () => {
    // Al cerrar sesión, simplemente recargamos para volver a simular el login
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);