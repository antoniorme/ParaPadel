import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Trophy, Loader2, ArrowLeft, Mail, Lock, Key, Send, Eye, EyeOff, ShieldAlert, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
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

const translateError = (msg: string) => {
    const m = msg.toLowerCase();
    if (m.includes('different from the old password')) return "Usa una contraseña distinta a la anterior.";
    if (m.includes('at least 6 characters')) return "Mínimo 6 caracteres.";
    if (m.includes('invalid login credentials')) return "Email o clave incorrectos.";
    if (m.includes('user already registered')) return "El email ya existe.";
    return msg || "Error de seguridad. Reintenta.";
};

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { addLog } = useAuth();
  
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
  const [isSessionReady, setIsSessionReady] = useState(false);

  // DETECCIÓN MANUAL DE TOKENS EN LA URL
  useEffect(() => {
      const fullUrl = window.location.href;
      if (fullUrl.includes('access_token=') || fullUrl.includes('type=recovery')) {
          setView('update-password');
      }
  }, []);

  const switchView = (newView: AuthView) => {
      setView(newView);
      setError(null);
      setSuccessMsg(null);
      setCaptchaToken(null);
      if(captchaRef.current) captchaRef.current.resetCaptcha();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let result;
      if (view === 'login') {
        result = await supabase.auth.signInWithPassword({ 
            email, password,
            options: { captchaToken: captchaToken || undefined }
        });
      } else {
        if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden");
        result = await supabase.auth.signUp({ 
            email, password, 
            options: { captchaToken: captchaToken || undefined } 
        });
      }
      if (result.error) throw result.error;
    } catch (err: any) {
      setError(translateError(err.message));
      setLoading(false);
      if(captchaRef.current) captchaRef.current.resetCaptcha();
      setCaptchaToken(null);
    }
  };

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      try {
          const redirectTo = `${window.location.origin}${window.location.pathname}#/auth?type=recovery`;
          const { error } = await supabase.auth.resetPasswordForEmail(email, { 
              redirectTo, 
              captchaToken: captchaToken || undefined 
          });
          
          if (error) throw error;
          setSuccessMsg("Enlace enviado. Mira tu correo.");
          setLoading(false);
      } catch (err: any) {
          setError(translateError(err.message));
          setLoading(false);
      }
  };

  // PASO 1 RECUPERACIÓN: Validar la sesión del Magic Link
  const handleStartUpdate = async () => {
      setLoading(true);
      setError(null);
      
      const getUrlParam = (url: string, key: string) => {
          const reg = new RegExp(`[#?&]${key}=([^&]*)`);
          const match = url.match(reg);
          return match ? match[1] : null;
      };

      const access_token = getUrlParam(window.location.href, 'access_token');
      const refresh_token = getUrlParam(window.location.href, 'refresh_token');

      if (!access_token || !refresh_token) {
          setError("El enlace ha caducado o no es válido.");
          setLoading(false);
          return;
      }

      try {
          const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
          if (sessionError) throw sessionError;
          
          setIsSessionReady(true);
          // Limpiamos la URL para evitar recargas raras del HashRouter
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (err: any) {
          setError(translateError(err.message));
      } finally {
          setLoading(false);
      }
  };

  // PASO 2 RECUPERACIÓN: Guardar la nueva clave
  const handleUpdatePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (password !== confirmPassword) { setError("Las claves no coinciden."); return; }
      
      setLoading(true);
      setError(null);

      try {
          const { error: updateError } = await supabase.auth.updateUser({ password });
          if (updateError) throw updateError;
          
          setSuccessMsg("¡Contraseña cambiada con éxito!");
          setTimeout(() => navigate('/'), 2000);
      } catch (err: any) {
          setError(translateError(err.message));
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
            {view === 'update-password' ? 'Establece tu nueva contraseña' : 'Introduce tus datos para continuar'}
          </p>
        </div>

        {successMsg && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-6 rounded-3xl text-sm text-center font-bold flex flex-col items-center gap-3 animate-fade-in shadow-sm">
                <CheckCircle2 size={40} className="text-emerald-500"/> 
                {successMsg}
            </div>
        )}

        {!successMsg && error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm text-center font-medium shadow-sm flex items-center gap-2 animate-fade-in">
                <ShieldAlert size={18} className="shrink-0"/> {error}
            </div>
        )}

        <div className="space-y-4">
            {/* VISTA: ACTUALIZAR CONTRASEÑA (DESPUÉS DEL MAGIC LINK) */}
            {view === 'update-password' && !successMsg && (
                <div className="space-y-6 animate-slide-up">
                    {!isSessionReady ? (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-8 text-center space-y-6">
                            <ShieldCheck size={48} className="mx-auto text-[#575AF9]"/>
                            <h2 className="text-xl font-black text-slate-900 leading-tight">Acceso Validado</h2>
                            <p className="text-slate-500 text-xs font-medium leading-relaxed">Pulsa el botón para iniciar el cambio seguro de tu contraseña.</p>
                            <button 
                                onClick={handleStartUpdate}
                                disabled={loading}
                                className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 py-4 rounded-2xl font-black text-white shadow-xl flex justify-center items-center gap-2 active:scale-95 transition-all"
                            >
                                {loading ? <Loader2 className="animate-spin" size={24}/> : "CAMBIAR CONTRASEÑA"}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            <div className="relative">
                                <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                                <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-slate-900 focus:border-[#575AF9] outline-none font-bold shadow-sm" placeholder="Nueva Contraseña" autoFocus/>
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-400">
                                    {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                                </button>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none font-bold shadow-sm" placeholder="Repetir Contraseña"/>
                            </div>
                            
                            {HCAPTCHA_SITE_TOKEN && (
                                <div className="flex justify-center my-2 scale-90 min-h-[78px]">
                                    <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={setCaptchaToken} ref={captchaRef}/>
                                </div>
                            )}

                            <button type="submit" disabled={loading || (HCAPTCHA_SITE_TOKEN && !captchaToken)} className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 py-4 rounded-2xl font-black text-white shadow-xl flex justify-center items-center gap-2 text-lg active:scale-95 transition-all">
                                {loading ? <Loader2 className="animate-spin" size={24} /> : "GUARDAR CAMBIOS"}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* VISTA: RECUPERAR (PEDIR EMAIL) */}
            {view === 'recovery' && !successMsg && (
                <form onSubmit={handlePasswordResetRequest} className="space-y-4 animate-slide-up">
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
            )}

            {/* VISTA: LOGIN / REGISTRO */}
            {(view === 'login' || view === 'register') && !successMsg && (
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
                
                <div className="text-center pt-4">
                    <button 
                        type="button" 
                        onClick={() => switchView(view === 'login' ? 'register' : 'login')}
                        className="text-sm font-bold text-slate-500"
                    >
                        {view === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
                    </button>
                </div>
                </form>
            )}
        </div>
        
        <p className="text-center text-[10px] text-slate-300 font-black uppercase tracking-[0.2em] mt-12">PadelPro App Security v2.7</p>
      </div>
    </div>
  );
};

export default AuthPage;