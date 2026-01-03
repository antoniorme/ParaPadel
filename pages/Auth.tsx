
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Trophy, Loader2, ArrowLeft, Mail, Lock, Key, Send, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

type AuthView = 'login' | 'register' | 'recovery' | 'update-password';

let HCAPTCHA_SITE_TOKEN = "";
try {
    // @ts-ignore
    if (import.meta && import.meta.env && import.meta.env.VITE_HCAPTCHA_SITE_TOKEN) {
        // @ts-ignore
        HCAPTCHA_SITE_TOKEN = import.meta.env.VITE_HCAPTCHA_SITE_TOKEN;
    }
} catch (e) {}

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  useEffect(() => {
    const url = window.location.href;
    const isRecovery = url.includes('type=recovery') || searchParams.get('type') === 'recovery' || url.includes('access_token=');
    
    if (session && isRecovery) {
        setView('update-password');
    } else if (session && view !== 'update-password') {
        navigate('/dashboard');
    }
  }, [session, searchParams, navigate, view]);

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

      const redirectTo = `${window.location.origin}/#/auth?type=recovery`;

      try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo,
              captchaToken: captchaToken || undefined 
          });
          if (error) throw error;
          setSuccessMsg("¡Enlace enviado! Revisa tu email.");
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

      if (!IS_LOCAL && HCAPTCHA_SITE_TOKEN && !captchaToken) {
          setError("Por seguridad, completa el captcha.");
          setLoading(false);
          return;
      }

      try {
          console.log("Intentando actualizar contraseña con token:", captchaToken ? "Presente" : "Ausente");
          
          // CORRECCIÓN CRÍTICA: captchaToken va en el segundo objeto (options)
          const { error } = await supabase.auth.updateUser(
              { password },
              { captchaToken: captchaToken || undefined }
          );
          
          if (error) throw error;
          
          setSuccessMsg("¡Contraseña actualizada con éxito!");
          console.log("Contraseña actualizada. Redirigiendo...");
          
          // LIMPIEZA AGRESIVA DE URL PARA EVITAR BUCLES
          setTimeout(() => {
              // Eliminamos el hash de la URL (tokens de recuperación)
              window.history.replaceState(null, '', window.location.origin + '/#/dashboard');
              window.location.reload();
          }, 1500);

      } catch (err: any) {
          console.error("Error al actualizar contraseña:", err);
          setError(err.message || "Error al actualizar clave.");
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

    if (HCAPTCHA_SITE_TOKEN && !captchaToken && !IS_LOCAL) {
        setError("Completa el Captcha.");
        setLoading(false);
        return;
    }

    try {
      let result;
      const redirectTo = `${window.location.origin}/#/auth`;
      const attributes = { email, password };
      const options = { 
          captchaToken: captchaToken || undefined,
          emailRedirectTo: redirectTo
      };

      if (view === 'login') {
        result = await supabase.auth.signInWithPassword(attributes);
      } else {
        if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");
        result = await supabase.auth.signUp({ ...attributes, options });
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
             view === 'update-password' ? 'Define tu nueva contraseña de acceso' : 'Crea tu cuenta de club'}
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

                {HCAPTCHA_SITE_TOKEN && (
                    <div className="flex justify-center my-2 scale-90 min-h-[78px]">
                        <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={setCaptchaToken} ref={captchaRef}/>
                    </div>
                )}

                <button type="submit" disabled={loading} className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 py-4 rounded-2xl font-black text-white shadow-xl flex justify-center items-center gap-2 text-lg">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <>ACTUALIZAR Y ENTRAR <Key size={20}/></>}
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
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <>MANDAR ENLACE <Send size={18}/></>}
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
                {loading ? <Loader2 className="animate-spin" size={24} /> : (view === 'login' ? 'ENTRAR' : 'CREAR CUENTA')}
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
      </div>
    </div>
  );
};

export default AuthPage;
