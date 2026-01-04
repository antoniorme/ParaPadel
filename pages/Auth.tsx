import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Trophy, Loader2, ArrowLeft, Mail, Lock, Key, Send, Eye, EyeOff, ShieldAlert, CheckCircle2, Terminal, Activity, ChevronRight, ShieldCheck } from 'lucide-react';
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

const hostname = window.location.hostname;
const IS_DEV_ENV = 
  hostname === 'localhost' || 
  hostname === '127.0.0.1' || 
  hostname.includes('googleusercontent') || 
  hostname.includes('webcontainer') ||
  hostname.includes('idx.google.com');

const translateError = (msg: string) => {
    const m = msg.toLowerCase();
    if (m.includes('different from the old password') || m.includes('new password should be different')) 
        return "La nueva contraseña debe ser diferente a la anterior.";
    if (m.includes('at least 6 characters')) 
        return "La contraseña debe tener al menos 6 caracteres.";
    if (m.includes('invalid login credentials')) 
        return "Email o contraseña incorrectos.";
    if (m.includes('user already registered')) 
        return "Este email ya está registrado.";
    if (m.includes('captcha')) 
        return "Error de verificación (Captcha).";
    if (m.includes('refresh_token_not_found') || m.includes('expired')) 
        return "El enlace es inválido o ha caducado.";
    return msg;
};

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, authLogs, addLog } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validatingRecovery, setValidatingRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const [showMonitor, setShowMonitor] = useState(true);

  // MANEJO MANUAL DE TOKENS (Solución al "Doble Hash")
  useEffect(() => {
    const handleUrlSession = async () => {
        const fullUrl = window.location.href;
        const parts = fullUrl.split('#');
        const lastPart = parts[parts.length - 1] || '';
        const params = new URLSearchParams(lastPart);
        
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type') || searchParams.get('type');

        if (accessToken && (type === 'recovery' || fullUrl.includes('type=recovery'))) {
            if (view !== 'update-password') {
                setView('update-password');
                addLog("CAMBIANDO A VISTA DE NUEVA CLAVE.");
            }
            
            if (!session) {
                if (!validatingRecovery) {
                    setValidatingRecovery(true);
                    addLog("Validando credenciales de recuperación...");
                    
                    try {
                        const { error: setSessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken || '',
                        });
                        
                        if (setSessionError) {
                            addLog(`ERROR SESIÓN: ${setSessionError.message}`);
                            setError("El enlace de recuperación no es válido o ha expirado.");
                            setValidatingRecovery(false);
                        } else {
                            addLog("SESIÓN INYECTADA. ESPERANDO CONTEXTO...");
                        }
                    } catch (e: any) {
                        addLog(`FALLO CRÍTICO: ${e.message}`);
                        setValidatingRecovery(false);
                    }
                }
            } else {
                if (validatingRecovery) {
                    addLog("SESIÓN CONFIRMADA. LISTO PARA CAMBIAR CLAVE.");
                    setValidatingRecovery(false);
                }
            }
        }
    };

    handleUrlSession();
  }, [session, searchParams, addLog, view, validatingRecovery]);

  const switchView = (newView: AuthView) => {
      setView(newView);
      setError(null);
      setSuccessMsg(null);
      setCaptchaToken(null);
      if(captchaRef.current) captchaRef.current.resetCaptcha();
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      addLog("INICIANDO PROCESO DE ACTUALIZACIÓN...");

      if (password !== confirmPassword) {
          setError("Las contraseñas no coinciden.");
          setLoading(false);
          return;
      }

      if (password.length < 6) {
          setError("Mínimo 6 caracteres.");
          setLoading(false);
          return;
      }

      if (!IS_DEV_ENV && HCAPTCHA_SITE_TOKEN && !captchaToken) {
          setError("Por favor, completa el captcha.");
          setLoading(false);
          return;
      }

      // LLAMADA ATÓMICA CON TIMEOUT DE 20 SEGUNDOS
      const updatePromise = supabase.auth.updateUser({ 
          password: password 
      }, { 
          captchaToken: captchaToken || undefined 
      });

      const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("TIMEOUT_ERROR")), 20000)
      );

      try {
          addLog("EJECUTANDO LLAMADA A SUPABASE...");
          const result = await Promise.race([updatePromise, timeoutPromise]) as any;
          
          if (!result) throw new Error("El servidor devolvió una respuesta vacía.");
          
          const { error: updateError } = result;

          if (updateError) {
              addLog(`ERROR DESDE SUPABASE: ${updateError.message}`);
              throw updateError;
          }

          addLog("¡CONTRASEÑA CAMBIADA CON ÉXITO!");
          setSuccessMsg("¡Contraseña actualizada! Entrando...");
          
          setTimeout(() => {
              window.location.href = window.location.origin + window.location.pathname + '#/dashboard';
              window.location.reload();
          }, 1500);

      } catch (err: any) {
          if (err.message === "TIMEOUT_ERROR") {
              addLog("ERROR: Tiempo de espera agotado (20s).");
              setError("La conexión con el servidor ha tardado demasiado. Inténtalo de nuevo.");
          } else {
              addLog(`FALLO EN ACTUALIZACIÓN: ${err.message}`);
              setError(translateError(err.message));
          }
          if(captchaRef.current) captchaRef.current.resetCaptcha();
          setCaptchaToken(null);
      } finally {
          setLoading(false);
          addLog("PROCESO FINALIZADO.");
      }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!IS_DEV_ENV && HCAPTCHA_SITE_TOKEN && !captchaToken) {
        setError("Por favor, completa el captcha.");
        setLoading(false);
        return;
    }

    try {
      let result;
      if (view === 'login') {
        result = await supabase.auth.signInWithPassword({ 
            email, 
            password,
            options: { captchaToken: captchaToken || undefined }
        });
      } else {
        if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden");
        result = await supabase.auth.signUp({ 
            email, 
            password, 
            options: { captchaToken: captchaToken || undefined } 
        });
      }
      
      if (result.error) throw result.error;
      
    } catch (err: any) {
      setError(translateError(err.message || 'Error de acceso'));
      setLoading(false);
      if(captchaRef.current) captchaRef.current.resetCaptcha();
      setCaptchaToken(null);
    }
  };

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      if (!IS_DEV_ENV && HCAPTCHA_SITE_TOKEN && !captchaToken) {
          setError("Completa el captcha.");
          setLoading(false);
          return;
      }

      try {
          const redirectTo = window.location.origin + window.location.pathname + '#/auth?type=recovery';
          addLog(`Solicitando recovery...`);
          
          const { error } = await supabase.auth.resetPasswordForEmail(email, { 
              redirectTo, 
              captchaToken: captchaToken || undefined 
          });
          
          if (error) throw error;
          
          setSuccessMsg("Enlace enviado. Revisa tu email.");
          setCaptchaToken(null);
          if(captchaRef.current) captchaRef.current.resetCaptcha();
      } catch (err: any) {
          setError(translateError(err.message || "Error al solicitar."));
          setCaptchaToken(null);
          if(captchaRef.current) captchaRef.current.resetCaptcha();
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 overflow-x-hidden">
      <button onClick={() => navigate('/')} className="text-slate-500 flex items-center gap-2 mb-8 font-bold text-sm hover:text-slate-800 transition-colors">
        <ArrowLeft size={20} /> Volver
      </button>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full space-y-8">
        <div className="text-center">
          <div className="inline-block p-4 bg-white rounded-3xl mb-4 shadow-xl shadow-indigo-100">
             <Trophy size={48} className="text-[#575AF9]" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">
            {view === 'login' ? 'Hola de nuevo' : 
             view === 'recovery' ? 'Recuperar' : 
             view === 'update-password' ? 'Seguridad' : 'Registro'}
          </h1>
          <p className="text-slate-400 text-sm">
            {view === 'update-password' ? 'Gestión de nueva clave' : 'Introduce tus datos'}
          </p>
        </div>

        {validatingRecovery ? (
            <div className="bg-white border border-slate-100 p-8 rounded-[2rem] shadow-xl text-center space-y-4 animate-fade-in">
                <Loader2 className="animate-spin text-[#575AF9] mx-auto" size={40}/>
                <p className="text-slate-600 font-bold">Verificando enlace...</p>
                <p className="text-slate-400 text-xs">Un momento por favor.</p>
            </div>
        ) : (
            <>
                {successMsg && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-xl text-sm text-center font-bold flex items-center justify-center gap-2 animate-fade-in">
                        <CheckCircle2 size={18}/> {successMsg}
                    </div>
                )}

                {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm text-center font-medium shadow-sm flex items-center gap-2 animate-fade-in">
                    <ShieldAlert size={18} className="shrink-0"/> {error}
                </div>
                )}

                <div className="space-y-4">
                    {view === 'update-password' ? (
                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl mb-4 flex items-center gap-3">
                                <ShieldCheck className="text-indigo-600" size={24}/>
                                <div className="text-[10px] font-bold text-indigo-800 leading-tight uppercase">
                                    Identidad verificada.<br/>Establece tu nueva contraseña.
                                </div>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                                <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-bold" placeholder="Nueva Contraseña" autoFocus/>
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-400">
                                    {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                                </button>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-bold" placeholder="Confirmar Contraseña"/>
                            </div>

                            {HCAPTCHA_SITE_TOKEN && (
                                <div className="flex justify-center my-2 scale-90 min-h-[78px]">
                                    <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={setCaptchaToken} ref={captchaRef}/>
                                </div>
                            )}

                            <button type="submit" disabled={loading} className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 py-4 rounded-2xl font-black text-white shadow-xl flex justify-center items-center gap-2 text-lg active:scale-95 transition-all">
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <>ESTABLECER CLAVE <Key size={20}/></>}
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
                </div>

                {view !== 'update-password' && (
                    <div className="mt-8 text-center">
                        <button onClick={() => switchView(view === 'login' ? 'register' : 'login')} className="text-slate-500 text-sm font-medium hover:text-[#575AF9]">
                            {view === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                        </button>
                    </div>
                )}
            </>
        )}

        <div className="mt-12 bg-[#0A0A0B] rounded-3xl border border-white/5 shadow-2xl overflow-hidden animate-slide-up">
            <button 
                onClick={() => setShowMonitor(!showMonitor)}
                className="w-full p-4 flex items-center justify-between text-indigo-400 border-b border-white/5 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                    <Terminal size={14}/> Consola de Identidad
                </div>
                <Activity size={14} className={validatingRecovery || loading ? "animate-pulse" : ""}/>
            </button>
            
            {showMonitor && (
                <div className="p-5 font-mono text-[10px] space-y-1.5 h-40 overflow-y-auto custom-scrollbar leading-relaxed">
                    {authLogs.map((log, i) => {
                        const isError = log.includes('!!!') || log.includes('ERROR') || log.includes('FALLO') || log.includes('TIMEOUT');
                        const isSuccess = log.includes('CONFIRMADA') || log.includes('ÉXITO');
                        return (
                            <div key={i} className={`${isError ? 'text-rose-400' : isSuccess ? 'text-emerald-400' : 'text-slate-500'} flex gap-2`}>
                                <span className="opacity-30 shrink-0">{i + 1}</span>
                                <span className="opacity-50 shrink-0">›</span>
                                <span className="break-all">{log}</span>
                            </div>
                        );
                    })}
                    <div className="text-indigo-500 animate-pulse flex items-center gap-2">
                        <span>_</span>
                        <span className="h-3 w-1.5 bg-indigo-500"></span>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;