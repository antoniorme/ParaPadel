
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Trophy, Loader2, ArrowLeft, Mail, Lock, Code2, Clock, Key, Send, ShieldAlert, ShieldCheck } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

type AuthView = 'login' | 'register' | 'recovery';

// ------------------------------------------------------------------
// CONFIGURACIÓN HCAPTCHA (SEGURA & HÍBRIDA)
// ------------------------------------------------------------------

const getEnvConfig = () => {
    try {
        // @ts-ignore
        const key = import.meta.env.VITE_HCAPTCHA_SITE_KEY;
        // @ts-ignore
        const isDev = import.meta.env.DEV; 
        return { key, isDev };
    } catch (e) {
        // Fallback por si falla el acceso a import.meta
        return { key: undefined, isDev: false };
    }
};

const { key: HCAPTCHA_SITE_KEY, isDev: IS_DEV } = getEnvConfig();

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { checkUserRole, loginWithDevBypass, isOfflineMode, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [view, setView] = useState<AuthView>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Captcha State
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  
  // Verification Gate State
  const [isPendingVerification, setIsPendingVerification] = useState(false);

  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => {
      // @ts-ignore
      const isPlaceholder = (supabase as any).supabaseUrl === 'https://placeholder.supabase.co';
      if (isOfflineMode || isPlaceholder) {
          setShowDevTools(true);
      }
  }, [isOfflineMode]);

  useEffect(() => {
    if (searchParams.get('mode') === 'register') {
      setView('register');
    }
  }, [searchParams]);

  const switchView = (newView: AuthView) => {
      setView(newView);
      setError(null);
      setSuccessMsg(null);
      setCaptchaToken(null);
      if(captchaRef.current) captchaRef.current.resetCaptcha();
  };

  const ensurePlayerRecord = async (userId: string, userEmail: string) => {
      const { data: existingPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

      if (!existingPlayer) {
          await supabase.from('players').insert([{
              user_id: userId,
              email: userEmail,
              name: userEmail.split('@')[0], 
              categories: ['Iniciación'], 
              manual_rating: 5
          }]);
      }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setSuccessMsg(null);

      if (isOfflineMode) {
          setError("La recuperación de contraseña no funciona en modo offline/demo.");
          setLoading(false);
          return;
      }
      
      const isLocalBypass = IS_DEV && !HCAPTCHA_SITE_KEY;

      if (!showDevTools && !isLocalBypass) {
          if (!HCAPTCHA_SITE_KEY) {
              setError("ERROR CONFIG: Falta VITE_HCAPTCHA_SITE_KEY.");
              setLoading(false);
              return;
          }
          if (!captchaToken) {
              setError("Completa el Captcha.");
              setLoading(false);
              return;
          }
      }

      try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin + '/#/auth?type=recovery',
              captchaToken: captchaToken || undefined 
          });
          if (error) throw error;
          setSuccessMsg("Si el email existe, recibirás un enlace para entrar.");
      } catch (err: any) {
          setError(err.message || "Error al solicitar recuperación.");
          if(captchaRef.current) captchaRef.current.resetCaptcha();
          setCaptchaToken(null);
      } finally {
          setLoading(false);
      }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIsPendingVerification(false);

    // @ts-ignore
    if ((supabase as any).supabaseUrl === 'https://placeholder.supabase.co') {
        setError("Base de datos no conectada. Usa los botones de 'Modo Desarrollador' abajo.");
        setLoading(false);
        setShowDevTools(true);
        return;
    }

    // LÓGICA DE BLOQUEO INTELIGENTE
    // Permitimos paso si hay token, O SI estamos en local y no hay clave configurada.
    const isLocalBypass = IS_DEV && !HCAPTCHA_SITE_KEY;

    if (!showDevTools && !isLocalBypass) {
        if (!HCAPTCHA_SITE_KEY) {
            setError("ERROR CRÍTICO: Falta la clave del Captcha en la configuración de Vercel/Environment.");
            setLoading(false);
            return;
        }
        
        if (!captchaToken) {
            setError("Debes completar el Captcha para continuar.");
            setLoading(false);
            return;
        }
    }

    try {
      let result;
      // Solo enviamos el token si existe (si es bypass local, va undefined y Supabase debería aceptarlo si no tiene captcha forzado)
      const authOptions = captchaToken ? { options: { captchaToken } } : undefined;

      if (view === 'login') {
        result = await supabase.auth.signInWithPassword({ 
            email, 
            password,
            ...authOptions
        });
      } else {
        result = await supabase.auth.signUp({ 
            email, 
            password,
            ...authOptions
        });
      }

      if (result.error) throw result.error;

      if (result.data.user && result.data.session) {
          const userId = result.data.user.id;
          const userEmail = result.data.user.email!;

          await ensurePlayerRecord(userId, userEmail);

          const isMe = userEmail === 'antoniorme@gmail.com'; 
          
          const { data: club } = await supabase
              .from('clubs')
              .select('id')
              .eq('owner_id', userId)
              .eq('is_active', true) 
              .maybeSingle();

          const isClub = !!club;
          const role = await checkUserRole(userId, userEmail);
          const isSuperAdmin = role === 'superadmin';

          if (isMe || isClub || isSuperAdmin) {
              if (isSuperAdmin) navigate('/dashboard'); 
              else if (isClub) navigate('/dashboard');
              else navigate('/p/dashboard');
          } else {
              setIsPendingVerification(true);
          }
      } else if (view === 'register' && result.data.user && !result.data.session) {
           setError("Revisa tu email para confirmar la cuenta.");
           if(captchaRef.current) captchaRef.current.resetCaptcha(); 
           setCaptchaToken(null);
      }

    } catch (err: any) {
      let message = err.message || 'Error de autenticación';
      if (message === 'Failed to fetch') message = 'Error de conexión.';
      else if (message.includes('Invalid login')) message = 'Credenciales incorrectas.';
      else if (message.includes('User already registered')) message = 'Este email ya está registrado.';
      else if (message.includes('Captcha')) message = 'Error de Captcha. Inténtalo de nuevo.';
      else if (message.includes('security purposes')) message = 'El servidor requiere Captcha pero no se ha enviado. Revisa la configuración.';
      
      setError(message);
      if(captchaRef.current) captchaRef.current.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBypass = (role: 'admin' | 'player' | 'superadmin') => {
      loginWithDevBypass(role);
      if (role === 'player') navigate('/p/dashboard');
      else navigate('/dashboard');
  };

  const onCaptchaVerify = (token: string) => {
      setCaptchaToken(token);
      setError(null);
  };

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
                <button 
                    onClick={() => { signOut(); setIsPendingVerification(false); switchView('login'); }}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                >
                    Volver al Inicio
                </button>
            </div>
        </div>
      );
  }

  // --- RECOVERY VIEW ---
  if (view === 'recovery') {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col p-6">
            <button onClick={() => switchView('login')} className="text-slate-500 flex items-center gap-2 mb-8 font-bold text-sm hover:text-slate-800 transition-colors">
                <ArrowLeft size={20} /> Volver
            </button>
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
                <div className="text-center mb-8">
                    <div className="inline-block p-4 bg-white rounded-3xl mb-4 shadow-xl shadow-indigo-100">
                        <Key size={48} className="text-[#575AF9]" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2">Recuperar Acceso</h1>
                    <p className="text-slate-400 text-sm">Te enviaremos un enlace mágico a tu correo.</p>
                </div>

                {successMsg ? (
                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center animate-fade-in">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
                            <Send size={24} />
                        </div>
                        <h3 className="font-bold text-emerald-800 mb-2">¡Correo Enviado!</h3>
                        <p className="text-sm text-emerald-700 mb-4">{successMsg}</p>
                        <button onClick={() => switchView('login')} className="text-xs font-bold uppercase text-emerald-600 hover:underline">Volver a iniciar sesión</button>
                    </div>
                ) : (
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                        {error && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm text-center font-medium shadow-sm">
                                {error}
                            </div>
                        )}
                        <div className="relative">
                            <Mail className="absolute left-4 top-4 text-slate-400" size={20} />
                            <input
                                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium transition-all focus:ring-4 focus:ring-indigo-50"
                                placeholder="Tu email registrado"
                            />
                        </div>
                        
                        {/* CAPTCHA FOR RECOVERY */}
                        {!showDevTools && (
                            HCAPTCHA_SITE_KEY ? (
                                <div className="flex justify-center my-4">
                                    <HCaptcha
                                        sitekey={HCAPTCHA_SITE_KEY}
                                        onVerify={onCaptchaVerify}
                                        ref={captchaRef}
                                    />
                                </div>
                            ) : IS_DEV ? (
                                <div className="bg-amber-50 text-amber-600 text-xs p-2 text-center rounded-lg border border-amber-100">
                                    Modo Local: Captcha Omitido
                                </div>
                            ) : (
                                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-start gap-2">
                                    <ShieldAlert size={20} className="shrink-0"/>
                                    <div><strong>Error Config:</strong> Falta clave Captcha.</div>
                                </div>
                            )
                        )}

                        <button
                            type="submit" disabled={loading || (!HCAPTCHA_SITE_KEY && !IS_DEV && !showDevTools)}
                            className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-70 disabled:cursor-not-allowed py-4 rounded-2xl font-bold text-white shadow-xl shadow-indigo-200 transition-all active:scale-95 mt-4 flex justify-center items-center text-lg gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <>Enviar Enlace <Send size={20}/></>}
                        </button>
                    </form>
                )}
            </div>
        </div>
      );
  }

  // --- LOGIN / REGISTER VIEW ---
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
            {view === 'login' ? 'Bienvenido' : 'Crear Cuenta'}
          </h1>
          <p className="text-slate-400 text-sm">
            {view === 'login' ? 'Introduce tus credenciales' : 'Únete a la comunidad de padel'}
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

          {/* CAPTCHA WIDGET - SMART LOGIC */}
          {!showDevTools && (
              HCAPTCHA_SITE_KEY ? (
                  <div className="flex justify-center my-2 transform scale-90 sm:scale-100 origin-center">
                      <HCaptcha
                          sitekey={HCAPTCHA_SITE_KEY}
                          onVerify={onCaptchaVerify}
                          ref={captchaRef}
                      />
                  </div>
              ) : IS_DEV ? (
                  // LOCAL DEV BYPASS MESSAGE
                  <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-center gap-2 text-indigo-700 text-xs font-bold mb-2">
                      <ShieldCheck size={16}/> Modo Local: Captcha Omitido
                  </div>
              ) : (
                  // ERROR DE CONFIGURACIÓN CLARO (PRODUCCIÓN)
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex gap-3 text-rose-800">
                      <ShieldAlert size={24} className="shrink-0 mt-1" />
                      <div className="text-xs">
                          <strong className="block text-sm mb-1">Falta Configuración del Captcha</strong>
                          <p className="mb-1">No se ha encontrado la clave <code>VITE_HCAPTCHA_SITE_KEY</code>.</p>
                          <p>El acceso está bloqueado por seguridad.</p>
                      </div>
                  </div>
              )
          )}

          {view === 'login' && (
              <div className="text-right">
                  <button type="button" onClick={() => switchView('recovery')} className="text-xs font-bold text-slate-400 hover:text-[#575AF9] transition-colors">
                      ¿Olvidaste tu contraseña?
                  </button>
              </div>
          )}

          <button
            type="submit" disabled={loading || (!HCAPTCHA_SITE_KEY && !IS_DEV && !showDevTools)}
            className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-2xl font-bold text-white shadow-xl shadow-indigo-200 transition-all active:scale-95 mt-4 flex justify-center items-center text-lg"
          >
            {loading ? <Loader2 className="animate-spin" /> : (view === 'login' ? 'Entrar' : 'Registrarse')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button onClick={() => switchView(view === 'login' ? 'register' : 'login')} className="text-slate-500 text-sm font-medium hover:text-[#575AF9] transition-colors">
            {view === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>

        {/* DEVELOPER BYPASS TOOLS */}
        {showDevTools && (
            <div className="mt-12 pt-8 border-t border-slate-200 animate-fade-in">
                <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-bold uppercase mb-4">
                    <Code2 size={16}/> Modo Desarrollador (Simulación)
                </div>
                <div className="text-center text-[10px] text-slate-400 mb-2">
                    Activado porque no hay conexión a base de datos real.
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
