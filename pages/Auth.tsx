
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Trophy, Loader2, ArrowLeft, Mail, Lock, Code2, CheckCircle, ShieldAlert, Clock } from 'lucide-react';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { checkUserRole, loginWithDevBypass, isOfflineMode, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // NEW: State for the Verification Gate
  const [isPendingVerification, setIsPendingVerification] = useState(false);

  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => {
      const isPlaceholder = (supabase as any).supabaseUrl === 'https://placeholder.supabase.co';
      if (isOfflineMode || isPlaceholder) {
          setShowDevTools(true);
      }
  }, [isOfflineMode]);

  useEffect(() => {
    if (searchParams.get('mode') === 'register') {
      setIsLogin(false);
    }
  }, [searchParams]);

  const ensurePlayerRecord = async (userId: string, userEmail: string) => {
      // Check if player profile exists
      const { data: existingPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

      if (!existingPlayer) {
          // Create basic player profile so they show up in SuperAdmin search
          await supabase.from('players').insert([{
              user_id: userId,
              email: userEmail,
              name: userEmail.split('@')[0], // Default name from email
              categories: ['Iniciación'], // Default category
              manual_rating: 5
          }]);
      }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIsPendingVerification(false);

    if ((supabase as any).supabaseUrl === 'https://placeholder.supabase.co') {
        setError("Base de datos no conectada. Usa los botones de 'Modo Desarrollador' abajo.");
        setLoading(false);
        setShowDevTools(true);
        return;
    }

    try {
      let result;
      if (isLogin) {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else {
        result = await supabase.auth.signUp({ email, password });
      }

      if (result.error) throw result.error;

      // Check if user is actually logged in (Supabase session active)
      if (result.data.user && result.data.session) {
          const userId = result.data.user.id;
          const userEmail = result.data.user.email!;

          // 1. CRITICAL FIX: Ensure public.players record exists immediately
          // This allows SuperAdmin to find this user by email
          await ensurePlayerRecord(userId, userEmail);

          // 2. CHECK IF WHITELISTED (Me or Club)
          // "Me" check (Hardcoded for safety + SuperAdmin check)
          const isMe = userEmail === 'antoniorme@gmail.com'; 
          
          // Club Check
          const { data: club } = await supabase
              .from('clubs')
              .select('id')
              .eq('owner_id', userId)
              .eq('is_active', true) // Ensure club is active
              .maybeSingle();

          const isClub = !!club;
          
          // SuperAdmin Check (via table)
          const role = await checkUserRole(userId, userEmail);
          const isSuperAdmin = role === 'superadmin';

          // 3. GATE LOGIC
          if (isMe || isClub || isSuperAdmin) {
              // Allowed to enter
              if (isSuperAdmin) navigate('/dashboard'); // Or /superadmin
              else if (isClub) navigate('/dashboard');
              else navigate('/p/dashboard');
          } else {
              // BLOCK USER -> Show Verification Screen
              setIsPendingVerification(true);
              // Optional: Sign them out so they can't make API calls, 
              // or keep them signed in but stuck on this screen. 
              // For security, strictly we should probably sign out, but for UX we keep the screen.
          }
      } else if (!isLogin && result.data.user && !result.data.session) {
          // Email confirmation case (if enabled in Supabase)
           setError("Revisa tu email para confirmar la cuenta.");
      }

    } catch (err: any) {
      let message = err.message || 'Error de autenticación';
      if (message === 'Failed to fetch') message = 'Error de conexión.';
      else if (message.includes('Invalid login')) message = 'Credenciales incorrectas.';
      else if (message.includes('User already registered')) message = 'Este email ya está registrado.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBypass = (role: 'admin' | 'player' | 'superadmin') => {
      loginWithDevBypass(role);
      if (role === 'player') navigate('/p/dashboard');
      else navigate('/dashboard');
  };

  // --- VERIFICATION GATE UI ---
  if (isPendingVerification) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col p-6 items-center justify-center text-center">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-slate-200 animate-scale-in">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
                    <Clock size={40} />
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-4">Verificación Pendiente</h1>
                <p className="text-slate-500 mb-8 leading-relaxed">
                    Tu usuario ha sido registrado correctamente, pero necesita ser validado por la administración antes de acceder.
                </p>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-8 text-sm text-slate-600">
                    Te enviaremos un aviso a <strong>{email}</strong> cuando tu cuenta esté activa.
                </div>

                <button 
                    onClick={() => {
                        signOut(); 
                        setIsPendingVerification(false);
                        setIsLogin(true);
                    }}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                >
                    Volver al Inicio
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6">
      <button onClick={() => navigate('/')} className="text-slate-500 flex items-center gap-2 mb-8 font-bold text-sm hover:text-slate-800 transition-colors">
        <ArrowLeft size={20} /> Volver
      </button>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-white rounded-3xl mb-4 shadow-xl shadow-indigo-100">
             <Trophy size={48} className="text-[#575AF9]" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">
            {isLogin ? 'Bienvenido' : 'Crear Cuenta'}
          </h1>
          <p className="text-slate-400 text-sm">
            {isLogin ? 'Introduce tus credenciales' : 'Únete a la comunidad de padel'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm mb-6 text-center font-medium shadow-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-4 text-slate-400" size={20} />
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium transition-all focus:ring-4 focus:ring-indigo-50"
              placeholder="Email"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)} minLength={6}
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium transition-all focus:ring-4 focus:ring-indigo-50"
              placeholder="Contraseña"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-70 py-4 rounded-2xl font-bold text-white shadow-xl shadow-indigo-200 transition-all active:scale-95 mt-4 flex justify-center items-center text-lg"
          >
            {loading ? <Loader2 className="animate-spin" /> : (isLogin ? 'Entrar' : 'Registrarse')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-slate-500 text-sm font-medium hover:text-[#575AF9] transition-colors">
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>

        {/* DEVELOPER BYPASS TOOLS */}
        {showDevTools && (
            <div className="mt-12 pt-8 border-t border-slate-200 animate-fade-in">
                <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-bold uppercase mb-4">
                    <Code2 size={16}/> Modo Desarrollador (Simulación)
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <button 
                        onClick={() => handleBypass('admin')}
                        className="py-3 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-900 transition-colors shadow-lg active:scale-95"
                    >
                        Entrar como CLUB
                    </button>
                    <button 
                        onClick={() => handleBypass('player')}
                        className="py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors shadow-lg active:scale-95"
                    >
                        Entrar como JUGADOR
                    </button>
                </div>
                <button 
                    onClick={() => handleBypass('superadmin')}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors shadow-lg active:scale-95"
                >
                    Entrar como SUPER ADMIN
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
