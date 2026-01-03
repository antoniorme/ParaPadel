
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

  // Captura de sesión de Supabase (especialmente para recovery)
  useEffect(() => {
    const checkHashAndToken = async () => {
        // Con BrowserRouter, el hash contiene directamente el fragmento de Supabase
        const hash = window.location.hash;
        const isRecovery = searchParams.get('type') === 'recovery' || hash.includes('type=recovery');

        if (hash.includes('access_token=')) {
            setVerifyingSession(true);
            // Pequeña pausa para que el SDK de Supabase procese el hash automáticamente
            setTimeout(async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    setView('update-password');
                    setSuccessMsg("Identidad confirmada. Elige tu nueva contraseña.");
                } else {
                    // Intento manual por si el SDK falló
                    const params = new URLSearchParams(hash.replace('#', '?'));
                    const access_token = params.get('access_token');
                    const refresh_token = params.get('refresh_token');
                    if (access_token) {
                        await supabase.auth.setSession({ access_token, refresh_token: refresh_token || '' });
                        setView('update-password');
                    }
                }
                setVerifyingSession(false);
            }, 500);
        } else if (isRecovery) {
            // Si venimos de recovery pero no hay hash, comprobamos si ya hay sesión activa
            const { data: { session } } = await supabase.auth.getSession();
            if (session) setView('update-password');
        }
    };
    checkHashAndToken();
  }, [searchParams]);

  const switchView = (newView: AuthView) => {
      setView(newView);
      setError(null);
      setSuccessMsg(null);
      setCaptchaToken(null);
      if(captchaRef.current) captchaRef.current.resetCaptcha();
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

      // IMPORTANTE: URL limpia para BrowserRouter
      const redirectTo = `${window.location.origin}/auth?type=recovery`;

      try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo,
              captchaToken: captchaToken || undefined 
          });
          if (error) throw error;
          setSuccessMsg("¡Enviado! Revisa tu email.");
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
          const { error } = await supabase.auth.updateUser({ password });
          if (error) throw error;
          
          setSuccessMsg("¡Contraseña actualizada!");
          
          // Redirección al dashboard tras éxito
          setTimeout(() => {
              navigate('/dashboard');
          }, 1500);

      } catch (err: any) {
          setError(err.message || "Error al actualizar.");
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
      // URL limpia
      const redirectTo = `${window.location.origin}/auth`;
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

  if (verifyingSession) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
              <Loader2 className="animate-spin text-[#575AF9] mb-4" size={48}/>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Verificando Acceso</h2>
              <p className="text-sm text-slate-400 mt-2">Un momento, por favor...</p>
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
            {view === 'login' ? 'Hola de nuevo' : 
             view === 'recovery' ? 'Recuperar' : 
             view === 'update-password' ? 'Nueva Clave' : 'Registro'}
          </h1>
          <p className="text-slate-400 text-sm">
            {view === 'login' ? 'Introduce tus credenciales' : 
             view === 'recovery' ? 'Escribe tu email registrado' : 
             view === 'update-password' ? 'Introduce tu nueva contraseña' : 'Crea tu cuenta de club'}
          </p>
        </div>

        {successMsg && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-xl text-sm mb-6 text-center font-bold shadow-sm animate-fade-in flex items-center justify-center gap-2">
                <CheckCircle2 size={18}/> {successMsg}
            </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm mb-6 text-center font-medium shadow-sm flex items-center gap-2">
            <ShieldAlert size={18} className="shrink-0"/> {error}
          </div>
        )}

        {view === 'update-password' ? (
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

        {showDevTools && (
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
