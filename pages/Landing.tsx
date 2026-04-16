
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, User, Building2, ShieldCheck } from 'lucide-react';
import { THEME } from '../utils/theme';
import { useAuth } from '../store/AuthContext';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithDevBypass, authDiag, user } = useAuth();
  const [showDiag, setShowDiag] = React.useState(false);

  const devLogin = (role: 'player' | 'admin' | 'superadmin', path: string) => {
    loginWithDevBypass(role);
    navigate(path);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white items-center justify-center p-6 text-center relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-600 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-600 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
          
          <h1 className="text-6xl font-black mb-4 tracking-tighter italic">
            Para<span style={{color: THEME.cta}}>Pádel</span>
          </h1>
          
          <p className="text-slate-400 mb-12 max-w-xs mx-auto leading-relaxed text-lg">
            La plataforma definitiva para gestionar torneos y competir.
          </p>

          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button 
              onClick={() => navigate('/auth')}
              className="w-full py-4 bg-[#575AF9] hover:bg-[#484bf0] text-white rounded-2xl font-bold shadow-xl shadow-blue-900/50 transition-all active:scale-95 flex items-center justify-center gap-2 text-lg"
            >
              Entrar <ArrowRight size={20} />
            </button>
            
            <p className="text-xs text-slate-500 mt-4">
               ¿Eres un club? Contacta con administración para activar tu cuenta.
            </p>
          </div>

          {import.meta.env.DEV && (
            <div className="mt-10 w-full max-w-xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-slate-700"/>
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Dev Mode</span>
                <div className="flex-1 h-px bg-slate-700"/>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => devLogin('player', '/p/dashboard')} className="flex flex-col items-center gap-1.5 py-3 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition-colors active:scale-95">
                  <User size={18}/>
                  <span className="text-[10px] font-bold uppercase tracking-wide">Jugador</span>
                </button>
                <button onClick={() => devLogin('admin', '/dashboard')} className="flex flex-col items-center gap-1.5 py-3 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition-colors active:scale-95">
                  <Building2 size={18}/>
                  <span className="text-[10px] font-bold uppercase tracking-wide">Club</span>
                </button>
                <button onClick={() => devLogin('superadmin', '/superadmin')} className="flex flex-col items-center gap-1.5 py-3 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition-colors active:scale-95">
                  <ShieldCheck size={18}/>
                  <span className="text-[10px] font-bold uppercase tracking-wide">SuperAdmin</span>
                </button>
              </div>
            </div>
          )}
      </div>

      {/* Panel de diagnóstico — visible cuando hay usuario pero sin rol */}
      {user && authDiag.length > 0 && (
        <div className="absolute bottom-16 left-4 right-4">
          <button
            onClick={() => setShowDiag(v => !v)}
            className="text-[10px] font-bold uppercase text-slate-600 flex items-center justify-center gap-1 mx-auto"
          >
            🔍 {showDiag ? 'Ocultar' : 'Ver'} diagnóstico de acceso
          </button>
          {showDiag && (
            <div className="mt-2 bg-slate-950 text-emerald-400 p-3 rounded-lg font-mono text-[10px] whitespace-pre-wrap leading-relaxed overflow-x-auto text-left">
              {authDiag.join('\n')}
            </div>
          )}
        </div>
      )}

      <footer className="absolute bottom-6 text-xs text-slate-600">
        © {new Date().getFullYear()} ParaPádel App v2.0
      </footer>
    </div>
  );
};

export default Landing;
