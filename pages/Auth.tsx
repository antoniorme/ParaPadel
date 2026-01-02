
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Trophy, Loader2, ArrowLeft, Mail, Lock, Code2, Key, Send, ShieldCheck, Eye, EyeOff, CheckCircle2, ShieldAlert } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

type AuthView = 'login' | 'register' | 'recovery' | 'update-password';

let HCAPTCHA_SITE_TOKEN = "";
let IS_DEV_ENV = false;

try {
    // @ts-ignore
    if (import.meta && import.meta.env) {
        // @ts-ignore
        if (import.meta.env.VITE_HCAPTCHA_SITE_TOKEN) HCAPTCHA_SITE_TOKEN = import.meta.env.VITE_HCAPTCHA_SITE_TOKEN;
        // @ts-ignore
        if (import.meta.env.DEV) IS_DEV_ENV = import.meta.env.DEV;
    }
} catch (e) {}

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || IS_DEV_ENV;

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithDevBypass, isOfflineMode } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyingSession, setVerifyingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => {
      // @ts-ignore
      const isPlaceholder = (supabase as any).supabaseUrl === 'https://placeholder.supabase.co';
      if (isOfflineMode || isPlaceholder) setShowDevTools(true);
  }, [isOfflineMode]);

  // --- SOLUCIÓN PARA EL ERROR "AUTH SESSION MISSING" ---
  useEffect(() => {
    const handleRecoveryFlow = async () => {
        const hash = window.location.hash;
        const type = searchParams.get('type');
        
        // Si hay access_token en la URL o el tipo es recovery
        if (type === 'recovery' || hash.includes('access_token=')) {
            setVerifyingSession(true);
            setView('update-password');
            // Bloqueamos redirecciones en App.tsx usando sessionStorage
            sessionStorage.setItem('padelpro_recovery_mode', 'true');
            
            try {
                // 1. Intentamos obtener sesión de forma normal
                const { data: { session } } = await supabase.auth.getSession();
                
                if (!session) {
                    // 2. Si falla (común en HashRouter), PARSEAMOS MANUALMENTE EL HASH
                    const fragment = hash.includes('#access_token') 
                        ? hash.substring(hash.lastIndexOf('#') + 1) 
                        : hash.substring(hash.indexOf('access_token'));
                    
                    const params = new URLSearchParams(fragment);
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    if (accessToken && refreshToken) {
                        // 3. INYECTAMOS LA SESIÓN MANUALMENTE EN EL SDK
                        const { error: setSessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken
                        });
                        
                        if (setSessionError) throw setSessionError;
                        setSuccessMsg("Identidad verificada. Crea tu nueva clave.");
                    } else {
                        throw new Error("El enlace no contiene tokens válidos.");
                    }
                } else {
                    setSuccessMsg("Identidad verificada. Introduce tu nueva contraseña.");
                }
            } catch (err: any) {
                console.error("Recovery Flow Error:", err);
                setError("El enlace no es válido o ha caducado. Solicita uno nuevo.");
                setView('recovery');
                sessionStorage.removeItem('padelpro_recovery_mode');
            } finally {
                setVerifyingSession(false);
            }
        }
    };

    handleRecoveryFlow();

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
      if (newView !== 'update-password') {
          sessionStorage.removeItem('padelpro_recovery_mode');
      }
  };

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      
      if (!IS_LOCAL && HCAPTCHA_SITE_TOKEN && !captchaToken) {
          setError("Completa el captcha.");
          setLoading(false);
          return;
      }

      const redirectTo = `${window.location.origin}/#/auth?type=recovery`;

      try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo,
              captchaToken: captchaToken || undefined 
          });
          if (error) throw error;
          setSuccessMsg("Revisa tu bandeja de entrada.");
      } catch (err: any) {
          setError(err.message || "Error al solicitar recuperación.");
          if(captchaRef.current) captchaRef.current.resetCaptcha();
          setCaptchaToken(null);
      } finally {
          setLoading(false);
      }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      if (password !== confirmPassword) {
          setError("Las contraseñas no coinciden.");
          setLoading(false);
          return;
      }

      try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("No se detectó una sesión activa. Usa el enlace del email o solicita uno nuevo.");

          const { error } = await supabase.auth.updateUser({ password });
          if (error) throw error;
          
          setSuccessMsg("¡Contraseña guardada! Entrando...");
          sessionStorage.removeItem('padelpro_recovery_mode');
          
          // FORZAMOS RECARGA DE ROL Y NAVEGACIÓN
          setTimeout(() => {
              window.location.href = window.location.origin + '/#/dashboard';
              window.location.reload(); 
          }, 1000);

      } catch (err: any) {
          setError(err.message || "Fallo al actualizar.");
      } finally {
          setLoading(false);
      }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (HCAPTCHA_SITE_TOKEN && !captchaToken && !IS_LOCAL) {
        setError("Completa el Captcha.");
        setLoading(false);
        return;
    }

    try {
      let result;
      const redirectTo = `${window.location.origin}/#/auth`;
      const authOptions = { 
          email, 
          password, 
          options: { 
              captchaToken: captchaToken || undefined,
              emailRedirectTo: redirectTo
          } 
      };

      if (view === 'login') {
        result = await supabase.auth.signInWithPassword(authOptions);
      } else {
        if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");
        result = await supabase.auth.signUp(authOptions);
      }

      if (result.error) throw result.error;

      if (result.data.user && view === 'register' && !result.data.session) {
           setSuccessMsg("Cuenta creada. Confirma el email recibido.");
           setView('login');
      }

    } catch (err: any) {
      setError(err.message || 'Error de acceso');
      if(captchaRef.current) captchaRef.current.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6">
      <button onClick={() => { sessionStorage.removeItem('padelpro_recovery_mode'); navigate('/'); }} className="text-slate-500 flex items-center gap-2 mb-8 font-bold text-sm hover:text-slate-800 transition-colors">
        <ArrowLeft size={20} /> Volver
      </button>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-white rounded-3xl mb-4 shadow-xl shadow-indigo-100">
             <Trophy size={48} className="text-[#575AF9]" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">
            {verifyingSession ? 'Verificando...' : 
             view === 'login' ? 'Hola de nuevo' : 
             view === 'recovery' ? 'Recuperar' : 
             view === 'update-password' ? 'Nueva Clave' : 'Registro'}
          </h1>
          <p className="text-slate-400 text-sm">
            {verifyingSession ? 'Validando enlace de seguridad' :
             view === 'login' ? 'Introduce tus credenciales' : 
             view === 'recovery' ? 'Escribe tu email registrado' : 
             view === 'update-password' ? 'Introduce tu nueva contraseña' : 'Crea tu cuenta de club'}
          </p>
        </div>

        {successMsg && !verifyingSession && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-xl text-sm mb-6 text-center font-bold shadow-sm animate-fade-in flex items-center justify-center gap-2">
                <CheckCircle2 size={18}/> {successMsg}
            </div>
        )}

        {error && !verifyingSession && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm mb-6 text-center font-medium shadow-sm flex items-center gap-2">
            <ShieldAlert size={18} className="shrink-0"/> {error}
          </div>
        )}

        {verifyingSession ? (
            <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-[#575AF9]" size={40}/>
            </div>
        ) : view === 'update-password' ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
                 <div className="relative">
                    <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                    <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-bold" placeholder="Nueva Contraseña"/>
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-400">
                        {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                    </button>
                </div>
                <div className="relative">
                    <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                    <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-bold" placeholder="Confirmar Nueva Contraseña"/>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 py-4 rounded-2xl font-black text-white shadow-xl flex justify-center items-center gap-2 text-lg">
                    {loading ? <Loader2 className="animate-spin" /> : <>GUARDAR Y ENTRAR <Key size={20}/></>}
                </button>
            </form>
        ) : view === 'recovery' ? (
            <form onSubmit={handlePasswordResetRequest} className="space-y-4">
                <div className="relative">
                    <Mail className="absolute left-4 top-4 text-slate-400" size={20} />
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium" placeholder="Tu email"/>
                </div>
                {HCAPTCHA_SITE_TOKEN && (
                    <div className="flex justify-center my-2 scale-90 min-h-[78px]">
                        <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={setCaptchaToken} ref={captchaRef}/>
                    </div>
                )}
                <button type="submit" disabled={loading} className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 py-4 rounded-2xl font-bold text-white shadow-xl flex justify-center items-center gap-2">
                    {loading ? <Loader2 className="animate-spin" /> : <>MANDAR ENLACE <Send size={18}/></>}
                </button>
                <div className="text-center mt-4">
                    <button type="button" onClick={() => switchView('login')} className="text-xs font-bold text-slate-400 hover:text-[#575AF9]">Volver al Login</button>
                </div>
            </form>
        ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-4 text-slate-400" size={20} />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium" placeholder="Email"/>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium" placeholder="Contraseña"/>
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-400">
                    {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
              {view === 'register' && (
                  <div className="relative animate-slide-up">
                    <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                    <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium" placeholder="Confirmar contraseña"/>
                  </div>
              )}
              {HCAPTCHA_SITE_TOKEN && (
                  <div className="flex justify-center my-2 scale-90 min-h-[78px]">
                      <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={setCaptchaToken} ref={captchaRef}/>
                  </div>
              )}
              {view === 'login' && (
                  <div className="text-right">
                      <button type="button" onClick={() => switchView('recovery')} className="text-xs font-bold text-slate-400 hover:text-[#575AF9]">¿Olvidaste tu contraseña?</button>
                  </div>
              )}
              <button type="submit" disabled={loading} className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 py-4 rounded-2xl font-black text-white shadow-xl flex justify-center items-center text-lg">
                {loading ? <Loader2 className="animate-spin" /> : (view === 'login' ? 'ENTRAR' : 'CREAR CUENTA')}
              </button>
            </form>
        )}

        {view !== 'update-password' && (
            <div className="mt-8 text-center">
                <button onClick={() => switchView(view === 'login' ? 'register' : 'login')} className="text-slate-500 text-sm font-medium hover:text-[#575AF9]">
                    {view === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                </button>
            </div>
        )}

        {showDevTools && !verifyingSession && (
            <div className="mt-12 pt-8 border-t border-slate-200 animate-fade-in">
                <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-bold uppercase mb-4"><Code2 size={16}/> SIMULACIÓN (Offline)</div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => loginWithDevBypass('admin')} className="py-3 bg-slate-800 text-white rounded-xl font-bold text-xs">CLUB</button>
                    <button onClick={() => loginWithDevBypass('player')} className="py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs">JUGADOR</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
