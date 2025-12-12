import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Trophy, Loader2, ArrowLeft, Mail, Lock, Code2, Clock, Key, Send, ShieldAlert, ShieldCheck, Terminal, AlertTriangle } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

type AuthView = 'login' | 'register' | 'recovery';

// ------------------------------------------------------------------
// CONFIGURACIÓN DE ENTORNO (ACCESO SEGURO)
// ------------------------------------------------------------------
// Usamos short-circuit para leer las variables de forma segura.
// Esto evita el crash si import.meta.env es undefined, pero permite el reemplazo de Vite.

// @ts-ignore
const HCAPTCHA_SITE_TOKEN = (import.meta.env && import.meta.env.VITE_HCAPTCHA_SITE_TOKEN) || "";
// @ts-ignore
const IS_DEV_ENV = (import.meta.env && import.meta.env.DEV) || false;

// Detección de entorno local
const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const IS_LOCAL = isLocalHost || IS_DEV_ENV;

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
  const [showDiagnose, setShowDiagnose] = useState(false);

  // DEBUGGING INICIAL
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
      
      try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin + '/#/auth?type=recovery',
              captchaToken: (HCAPTCHA_SITE_TOKEN && captchaToken) ? captchaToken : undefined 
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

    // SI HAY TOKEN CONFIGURADO PERO NO SE HA RESUELTO EL CAPTCHA
    if (HCAPTCHA_SITE_TOKEN && !captchaToken && !IS_LOCAL) {
        setError("Por favor, completa el Captcha para continuar.");
        setLoading(false);
        return;
    }

    try {
      let result;
      // Solo enviamos opciones de captcha si tenemos un token válido configurado
      const authOptions = (HCAPTCHA_SITE_TOKEN && captchaToken) ? { options: { captchaToken } } : undefined;

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
      console.error("Auth Error:", err);
      let message = err.message || 'Error de autenticación';
      if (message === 'Failed to fetch') message = 'Error de conexión.';
      else if (message.includes('Invalid login')) message = 'Credenciales incorrectas.';
      else if (message.includes('User already registered')) message = 'Este email ya está registrado.';
      else if (message.includes('Captcha')) message = 'Error de Captcha. Inténtalo de nuevo.';
      else if (message.includes('security purposes')) message = 'El servidor requiere Captcha. Configúralo en Vercel.';
      
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

  // DIAGNOSTIC INFO GENERATOR
  const getDiagnosticInfo = () => {
      let output = "";
      try {
          output += `Host: ${window.location.hostname}\n`;
          output += `IS_DEV_ENV: ${IS_DEV_ENV}\n`;
          output += `HCAPTCHA_SITE_TOKEN Detected: ${HCAPTCHA_SITE_TOKEN ? 'YES' : 'NO'}\n`;
          if (typeof HCAPTCHA_SITE_TOKEN === 'string' && HCAPTCHA_SITE_TOKEN) output += `Token Value: ${HCAPTCHA_SITE_TOKEN.substring(0, 4)}... (Hidden)\n`;
      } catch (e) {
          output += "Error getting diagnostics.";
      }
      return output;
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
                        
                        {/* CAPTCHA FOR RECOVERY - IF AVAILABLE */}
                        {HCAPTCHA_SITE_TOKEN && (
                            <div className="flex justify-center my-4">
                                <HCaptcha
                                    sitekey={HCAPTCHA_SITE_TOKEN}
                                    onVerify={onCaptchaVerify}
                                    ref={captchaRef}
                                />
                            </div>
                        )}

                        <button
                            type="submit" disabled={loading}
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
          <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm mb-6 text-center font-medium shadow-sm break-words">
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

          {/* CAPTCHA WIDGET - RENDER ONLY IF TOKEN IS AVAILABLE */}
          {!showDevTools && (
              HCAPTCHA_SITE_TOKEN ? (
                  <div className="flex justify-center my-2 transform scale-90 sm:scale-100 origin-center">
                      <HCaptcha
                          sitekey={HCAPTCHA_SITE_TOKEN}
                          onVerify={onCaptchaVerify}
                          ref={captchaRef}
                      />
                  </div>
              ) : IS_LOCAL ? (
                  // LOCAL DEV BYPASS
                  <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-center gap-2 text-indigo-700 text-xs font-bold mb-2">
                      <ShieldCheck size={16}/> Modo Local: Captcha Omitido
                  </div>
              ) : (
                  // PROD MISSING TOKEN - WARNING ONLY
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start gap-3 text-amber-800 mb-2">
                      <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                      <div className="text-xs">
                          <strong className="block text-sm mb-1">Captcha No Configurado</strong>
                          <p>La variable VITE_HCAPTCHA_SITE_TOKEN no se detecta en el Build. El login puede fallar si Supabase lo requiere.</p>
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
            type="submit" disabled={loading}
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
        
        {/* DIAGNOSTIC TOGGLE */}
        <div className="mt-8 text-center">
             <button 
                type="button" 
                onClick={() => setShowDiagnose(!showDiagnose)} 
                className="text-[10px] font-bold uppercase text-slate-300 flex items-center justify-center gap-1 hover:text-slate-500 mx-auto"
              >
                  <Terminal size={12}/> Info Técnica
              </button>
              {showDiagnose && (
                  <div className="bg-slate-900 text-emerald-400 p-3 rounded-lg font-mono text-[10px] whitespace-pre-wrap leading-tight mt-2 overflow-x-auto text-left mx-auto max-w-xs">
                      {getDiagnosticInfo()}
                  </div>
              )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;