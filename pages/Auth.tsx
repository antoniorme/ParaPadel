import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Trophy, Loader2, ArrowLeft, Mail, Lock, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

type AuthView = 'login' | 'register' | 'magic-link' | 'forgot-password';

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
    if (m.includes('invalid login credentials')) return "Email o contraseña incorrectos.";
    if (m.includes('user already registered')) return "El email ya está registrado.";
    if (m.includes('at least 6 characters')) return "Mínimo 6 caracteres.";
    if (m.includes('captcha')) return "Por favor completa el captcha.";
    return "Error de seguridad o enlace caducado. Reintenta.";
};

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  
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
    // Redirigir al inicio si ya hay sesión activa (Magic Link o Login normal)
    if (session && !authLoading) {
      navigate('/');
    }
  }, [session, authLoading, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (HCAPTCHA_SITE_TOKEN && !captchaToken) {
          throw new Error("Por favor, completa el captcha.");
      }

      let result;
      if (view === 'login') {
        result = await supabase.auth.signInWithPassword({ 
            email, password,
            options: { captchaToken: captchaToken || undefined }
        });
      } else if (view === 'register') {
        if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden");
        result = await supabase.auth.signUp({ 
            email, password, 
            options: { captchaToken: captchaToken || undefined } 
        });
        if (!result.error) setSuccessMsg("¡Registro casi listo! Confirma tu email.");
      }
      
      if (result?.error) throw result.error;
    } catch (err: any) {
      setError(translateError(err.message));
      setLoading(false);
      if(captchaRef.current) captchaRef.current.resetCaptcha();
      setCaptchaToken(null);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      
      try {
          if (HCAPTCHA_SITE_TOKEN && !captchaToken) {
              throw new Error("Por favor, completa el captcha.");
          }

          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin, // Redirige al home, donde AuthContext detectará la sesión
              captchaToken: captchaToken || undefined
          });
          
          if (error) throw error;
          setSuccessMsg("Enlace enviado. Revisa tu bandeja de entrada.");
      } catch (err: any) {
          setError(translateError(err.message));
      } finally {
          setLoading(false);
          if(captchaRef.current) captchaRef.current.resetCaptcha();
          setCaptchaToken(null);
      }
  };

  const switchView = (newView: AuthView) => {
      setView(newView);
      setError(null);
      setSuccessMsg(null);
      setCaptchaToken(null);
      if(captchaRef.current) captchaRef.current.resetCaptcha();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 overflow-x-hidden">
      <button onClick={() => navigate('/')} className="text-slate-500 flex items-center gap-2 mb-8 font-bold text-sm hover:text-slate-800 transition-colors">
        <ArrowLeft size={20} /> Inicio
      </button>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full space-y-8">
        <div className="text-center">
          <div className="inline-block p-4 bg-white rounded-3xl mb-4 shadow-xl shadow-indigo-100">
             <Trophy size={48} className="text-[#575AF9]" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">
            {view === 'login' ? 'Hola de nuevo' : 
             view === 'forgot-password' ? 'Recuperar Cuenta' : 'Crear Cuenta'}
          </h1>
          <p className="text-slate-400 text-sm">Gestiona tus torneos de padel</p>
        </div>

        {successMsg ? (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-8 rounded-3xl text-sm text-center font-bold flex flex-col items-center gap-4 animate-fade-in shadow-sm">
                <CheckCircle2 size={48} className="text-emerald-500"/> 
                <p className="text-lg leading-tight">{successMsg}</p>
                <button onClick={() => switchView('login')} className="mt-4 text-xs underline opacity-70">Volver al inicio</button>
            </div>
        ) : (
            <div className="space-y-6">
                {error && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm text-center font-medium shadow-sm flex items-center gap-2 animate-fade-in">
                        <ShieldAlert size={18} className="shrink-0"/> {error}
                    </div>
                )}

                {view === 'forgot-password' ? (
                    <form onSubmit={handleResetRequest} className="space-y-4 animate-slide-up">
                        <div className="relative">
                            <Mail className="absolute left-4 top-4 text-slate-400" size={20} />
                            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium" placeholder="Tu email registrado"/>
                        </div>
                        
                        {/* CAPTCHA OBLIGATORIO PARA RECUPERACIÓN */}
                        {HCAPTCHA_SITE_TOKEN && (
                            <div className="flex justify-center my-2 scale-90 min-h-[78px]">
                                <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={setCaptchaToken} ref={captchaRef}/>
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 py-4 rounded-2xl font-black text-white shadow-xl flex items-center justify-center gap-3 transition-all">
                            {loading ? <Loader2 className="animate-spin" size={24} /> : 'ENVIAR ENLACE DE ACCESO'}
                        </button>
                        <div className="text-center mt-6">
                            <button type="button" onClick={() => switchView('login')} className="text-xs font-bold text-slate-400 hover:text-[#575AF9]">Cancelar y Volver</button>
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
                                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium" placeholder="Repetir contraseña"/>
                            </div>
                        )}

                        {view === 'login' && (
                            <div className="text-right">
                                <button type="button" onClick={() => switchView('forgot-password')} className="text-xs font-bold text-indigo-500 hover:text-indigo-700">¿Olvidaste tu contraseña?</button>
                            </div>
                        )}

                        {HCAPTCHA_SITE_TOKEN && (
                            <div className="flex justify-center my-2 scale-90 min-h-[78px]">
                                <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={setCaptchaToken} ref={captchaRef}/>
                            </div>
                        )}
                        
                        <button type="submit" disabled={loading} className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 py-4 rounded-2xl font-black text-white shadow-xl flex justify-center items-center text-lg active:scale-95 transition-all">
                            {loading ? <Loader2 className="animate-spin" size={24} /> : (view === 'login' ? 'ENTRAR' : 'REGISTRARME')}
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
        )}
      </div>
    </div>
  );
};

export default AuthPage;