
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Trophy, Loader2, ArrowLeft, Mail, Lock, Key, Send, Eye, EyeOff, ShieldAlert, CheckCircle2, Terminal, Globe } from 'lucide-react';
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

const translateError = (msg: string) => {
    if (msg.includes('different from the old password')) return "La nueva contraseña debe ser diferente a la anterior.";
    if (msg.includes('at least 6 characters')) return "La contraseña debe tener al menos 6 caracteres.";
    if (msg.includes('Invalid login credentials')) return "Email o contraseña incorrectos.";
    if (msg.includes('User already registered')) return "Este email ya está registrado.";
    if (msg.includes('Captcha')) return "Error en la verificación del Captcha.";
    if (msg.includes('refresh_token_not_found')) return "La sesión ha caducado. Solicita un nuevo enlace.";
    return msg;
};

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, user: authUser, checkUserRole } = useAuth();
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

  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const addLog = (msg: string) => {
      setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    const url = window.location.href;
    const isRecovery = url.includes('type=recovery') || url.includes('recovery_verified') || searchParams.get('type') === 'recovery' || url.includes('access_token=');
    
    if (session && isRecovery) {
        if (view !== 'update-password') {
            addLog("Sesión de recuperación activa.");
            setView('update-password');
        }
    } else if (session && view !== 'update-password') {
        // Si ya hay sesión y no estamos cambiando clave, vamos al dashboard
        navigate('/dashboard');
    }
  }, [session, searchParams, navigate, view]);

  const switchView = (newView: AuthView) => {
      setView(newView);
      setError(null);
      setSuccessMsg(null);
      setCaptchaToken(null);
      setDebugLogs([]);
      if(captchaRef.current) captchaRef.current.resetCaptcha();
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      addLog("Solicitando cambio de contraseña...");

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

      const accessToken = session?.access_token;
      if (!accessToken) {
          addLog("Sesión inválida.");
          setError("La sesión ha expirado. Solicita un nuevo enlace.");
          setLoading(false);
          return;
      }

      // @ts-ignore
      const sbUrl = supabase.supabaseUrl;
      // @ts-ignore
      const sbKey = supabase.supabaseKey;

      try {
          addLog("Enviando actualización...");
          
          const response = await fetch(`${sbUrl}/auth/v1/user`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'apikey': sbKey,
                  'Authorization': `Bearer ${accessToken}`,
                  'x-captcha-token': captchaToken || ''
              },
              body: JSON.stringify({ password })
          });

          const result = await response.json();
          addLog(`Respuesta: HTTP ${response.status}`);

          if (!response.ok) {
              const rawMsg = result.msg || result.error_description || "Error desconocido";
              addLog(`Error detectado: ${rawMsg}`);
              throw new Error(translateError(rawMsg));
          }

          addLog("¡Contraseña actualizada!");
          setSuccessMsg("¡Contraseña actualizada con éxito!");
          
          // En lugar de un reload agresivo, esperamos un poco y navegamos
          setTimeout(() => {
              navigate('/dashboard');
          }, 1500);

      } catch (err: any) {
          setError(err.message);
          if(captchaRef.current) captchaRef.current.resetCaptcha();
          setCaptchaToken(null);
          setLoading(false);
      }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let result;
      if (view === 'login') {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else {
        if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden");
        result = await supabase.auth.signUp({ email, password, options: { captchaToken: captchaToken || undefined } });
      }
      if (result.error) throw result.error;
    } catch (err: any) {
      setError(translateError(err.message || 'Error de acceso'));
      setLoading(false);
      if(captchaRef.current) captchaRef.current.resetCaptcha();
    }
  };

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      try {
          const redirectTo = `${window.location.origin}/#/auth?type=recovery`;
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo, captchaToken: captchaToken || undefined });
          if (error) throw error;
          setSuccessMsg("¡Enlace enviado! Revisa tu correo.");
      } catch (err: any) {
          setError(translateError(err.message || "Error al solicitar recuperación."));
          if(captchaRef.current) captchaRef.current.resetCaptcha();
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
            {view === 'update-password' ? 'Define tu nueva contraseña de acceso' : 'Introduce tus datos'}
          </p>
        </div>

        {successMsg && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-xl text-sm mb-6 text-center font-bold flex items-center justify-center gap-2 animate-fade-in">
                <CheckCircle2 size={18}/> {successMsg}
            </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm mb-6 text-center font-medium shadow-sm flex items-center gap-2 animate-fade-in">
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
                        <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={(t) => { addLog("Captcha verificado"); setCaptchaToken(t); }} ref={captchaRef}/>
                    </div>
                )}

                <button type="submit" disabled={loading} className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 py-4 rounded-2xl font-black text-white shadow-xl flex justify-center items-center gap-2 text-lg active:scale-95 transition-all">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <>ACTUALIZAR Y ENTRAR <Key size={20}/></>}
                </button>

                <div className="mt-8 p-4 bg-slate-900 rounded-2xl border border-slate-700 shadow-inner overflow-hidden">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-3">
                        <Globe size={14}/> Estado de Conexión
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                        {debugLogs.length === 0 ? (
                            <p className="text-slate-600 text-[10px] italic">Esperando acción...</p>
                        ) : (
                            debugLogs.map((log, i) => (
                                <p key={i} className="text-slate-300 text-[10px] font-mono leading-tight border-l border-indigo-500/30 pl-2">
                                    {log}
                                </p>
                            ))
                        )}
                    </div>
                </div>
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
                <button type="submit" disabled={loading} className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 py-4 rounded-2xl font-bold text-white shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
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

              {view === 'login' && (
                  <div className="text-right">
                      <button type="button" onClick={() => switchView('recovery')} className="text-xs font-bold text-slate-400 hover:text-[#575AF9]">¿Olvidaste tu contraseña?</button>
                  </div>
              )}

              {HCAPTCHA_SITE_TOKEN && (
                  <div className="flex justify-center my-2 scale-90 min-h-[78px]">
                      <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={setCaptchaToken} ref={captchaRef}/>
                  </div>
              )}
              <button type="submit" disabled={loading} className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 py-4 rounded-2xl font-black text-white shadow-xl flex justify-center items-center text-lg active:scale-95 transition-all">
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
