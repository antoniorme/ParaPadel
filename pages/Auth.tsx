
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Loader2, ArrowLeft, Mail, Lock, Code2, Key, Send, ShieldAlert, ShieldCheck, Terminal, Eye, EyeOff } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

type AuthView = 'login' | 'register' | 'recovery';

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const HCAPTCHA_SITE_TOKEN = import.meta.env.VITE_HCAPTCHA_SITE_TOKEN ?? '';

// ... (existing code)

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithDevBypass, isOfflineMode, role, checkUserRole } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [view, setView] = useState<AuthView>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estado post-login: esperar a que AuthContext resuelva el rol
  const [waitingForRole, setWaitingForRole] = useState(false);
  
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  
  const [showDevTools, setShowDevTools] = useState(false);
  const [showDiagnose, setShowDiagnose] = useState(false);

  useEffect(() => {
      const isPlaceholder = (supabase as any).supabaseUrl === 'https://placeholder.supabase.co';
      if (isOfflineMode || isPlaceholder) {
          setShowDevTools(true);
      }
  }, [isOfflineMode]);

  // Una vez que AuthContext resuelve el rol post-login, redirigir
  useEffect(() => {
    if (!waitingForRole) return;
    if (role === 'admin' || role === 'superadmin') {
      navigate('/dashboard');
    } else if (role === 'player') {
      navigate('/p/dashboard');
    } else if (role === 'pending') {
      navigate('/pending');
    }
    // Si role sigue null, el timeout lo maneja abajo
  }, [role, waitingForRole, navigate]);

  useEffect(() => {
    if (searchParams.get('mode') === 'register') {
      setView('register');
    }
    // Contraseña cambiada correctamente — mostrar éxito en la vista de login
    if (searchParams.get('password_updated') === '1') {
      setSuccessMsg('¡Contraseña actualizada! Ya puedes iniciar sesión.');
    }
    // Mostrar error si viene de un magic link expirado o inválido
    const authError = searchParams.get('auth_error');
    if (authError) {
      setError(decodeURIComponent(authError));
      setView('recovery');
    }
  }, [searchParams]);

  const switchView = (newView: AuthView) => {
      setView(newView);
      setError(null);
      setSuccessMsg(null);
      setCaptchaToken(null);
      if(captchaRef.current) captchaRef.current.resetCaptcha();
  };

  // ... (existing ensurePlayerRecord)

  const handlePasswordReset = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      
      if (!IS_LOCAL && HCAPTCHA_SITE_TOKEN && !captchaToken) {
          setError("Por seguridad, debes completar el captcha.");
          setLoading(false);
          return;
      }

      try {
          // Use a cleaner redirect URL that works with HashRouter
          // We point to the root, but include the hash path we want to end up at
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin + '/reset-password',
              captchaToken: captchaToken || undefined
          });
          if (error) throw error;
          setSuccessMsg("Si el email existe, recibirás un enlace para entrar.");
      } catch (err: any) {
          const msg = err.message || "Error al solicitar recuperación.";
          if (msg.toLowerCase().includes('captcha')) {
              setError("Completa el captcha antes de continuar.");
          } else {
              setError(msg);
          }
          if(captchaRef.current) captchaRef.current.resetCaptcha();
          setCaptchaToken(null);
      } finally {
          setLoading(false);
      }
  };

  const ensurePlayerRecord = async (userId: string, userEmail: string) => {
      // Los jugadores son entidades independientes (multi-club).
      // profile_user_id = su propio auth id. user_id = club que los gestiona (null aquí).
      const { data } = await supabase.from('players').select('id').eq('profile_user_id', userId).maybeSingle();
      if (!data) {
          await supabase.from('players').insert([{
              profile_user_id: userId,
              email: userEmail,
              name: userEmail.split('@')[0],
          }]);
      }
  };

  const onCaptchaVerify = (token: string) => {
      setCaptchaToken(token);
  };

  const handleBypass = (role: 'admin' | 'player' | 'superadmin') => {
      loginWithDevBypass(role);
      navigate('/dashboard');
  };

  const getDiagnosticInfo = () => {
      return JSON.stringify({
          url: window.location.href,
          isLocal: IS_LOCAL,
          hasCaptcha: !!HCAPTCHA_SITE_TOKEN,
          mode: isOfflineMode ? 'OFFLINE' : 'ONLINE',
          view
      }, null, 2);
  };

  const handleAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      
      if (!IS_LOCAL && HCAPTCHA_SITE_TOKEN && !captchaToken) {
          setError("Por seguridad, debes completar el captcha.");
          setLoading(false);
          return;
      }

      try {
          if (view === 'login') {
              const { data: authData, error } = await supabase.auth.signInWithPassword({
                  email,
                  password,
                  options: { captchaToken: captchaToken || undefined }
              });
              if (error) throw error;
              // Esperar a que AuthContext resuelva el rol antes de navegar
              if (authData.user) {
                  setWaitingForRole(true);
                  // Timeout de seguridad: si en 8s no hay rol, mostrar error de diagnóstico
                  setTimeout(() => {
                      setWaitingForRole(false);
                      checkUserRole(authData.user!.id, authData.user!.email).then(r => {
                          if (!r) {
                              setError(`Login correcto pero sin perfil vinculado (uid: ${authData.user!.id.slice(0,8)}…). Contacta al administrador.`);
                          }
                      });
                  }, 8000);
              }
          } else {
              if (password !== confirmPassword) {
                  throw new Error("Las contraseñas no coinciden");
              }
              const { data, error } = await supabase.auth.signUp({
                  email,
                  password,
                  options: { captchaToken: captchaToken || undefined }
              });
              if (error) throw error;
              if (data.user && data.user.email) {
                  await ensurePlayerRecord(data.user.id, data.user.email);
                  setSuccessMsg("Cuenta creada. Por favor verifica tu email.");
              }
          }
      } catch (err: any) {
          const msg = err.message || "Error de autenticación";
          // Supabase devuelve este error cuando falta el token de captcha
          if (msg.toLowerCase().includes('captcha')) {
              setError("Completa el captcha antes de continuar.");
          } else {
              setError(msg);
          }
          if(captchaRef.current) captchaRef.current.resetCaptcha();
          setCaptchaToken(null);
      } finally {
          setLoading(false);
      }
  };

  // --- RECOVERY VIEW ---
  if (view === 'recovery') {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col p-6">
            <button onClick={() => switchView('login')} className="text-slate-500 flex items-center gap-2 mb-8 font-bold text-sm hover:text-slate-800 transition-colors">
                <ArrowLeft size={20} /> Volver
            </button>
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
                <div className="text-center mb-8">
                    <div className="mb-6">
                        <span className="text-4xl font-black italic tracking-tighter text-slate-900">
                            Para<span style={{ color: '#575AF9' }}>Pádel</span>
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-2">Recuperar Acceso</h1>
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
                        
                        {HCAPTCHA_SITE_TOKEN && (
                            <div className="flex justify-center my-4 min-h-[78px]">
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


  // --- WAITING FOR ROLE ---
  if (waitingForRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 size={36} className="animate-spin text-indigo-500" />
        <p className="text-sm font-bold text-slate-500">Iniciando sesión…</p>
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
          <div className="mb-6">
              <span className="text-5xl font-black italic tracking-tighter text-slate-900">
                  Para<span style={{ color: '#575AF9' }}>Pádel</span>
              </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">
            {view === 'login' ? 'Bienvenido' : 'Crear Cuenta'}
          </h1>
          <p className="text-slate-400 text-sm">
            {view === 'login' ? 'Introduce tus credenciales' : 'Únete a la comunidad de ParaPádel'}
          </p>
        </div>

        {successMsg && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-xl text-sm mb-6 text-center font-bold shadow-sm">
                {successMsg}
            </div>
        )}

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
              type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} minLength={6}
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium transition-all focus:ring-4 focus:ring-indigo-50"
              placeholder="Contraseña"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
            </button>
          </div>

          {/* CONFIRM PASSWORD - ONLY FOR REGISTER */}
          {view === 'register' && (
              <div className="relative animate-slide-up">
                <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                <input
                  type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none shadow-sm font-medium transition-all focus:ring-4 focus:ring-indigo-50"
                  placeholder="Repetir Contraseña"
                />
              </div>
          )}

          {/* CAPTCHA WIDGET — solo si está configurado */}
          {HCAPTCHA_SITE_TOKEN ? (
              <div className="flex justify-center my-2 transform scale-90 sm:scale-100 origin-center min-h-[78px]">
                  <HCaptcha
                      sitekey={HCAPTCHA_SITE_TOKEN}
                      onVerify={onCaptchaVerify}
                      ref={captchaRef}
                  />
              </div>
          ) : IS_LOCAL ? (
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-center gap-2 text-indigo-700 text-xs font-bold mb-2">
                  <ShieldCheck size={16}/> Modo Local: Captcha Omitido
              </div>
          ) : null}

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
            {loading ? <Loader2 className="animate-spin" /> : (view === 'login' ? 'Entrar' : 'Crear Cuenta')}
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
