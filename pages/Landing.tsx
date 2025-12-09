
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowRight } from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white items-center justify-center p-6 text-center relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-600 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-600 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
          <div className="mb-8 p-6 bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl border border-white/10">
            <Trophy size={60} className="text-[#575AF9]" />
          </div>
          
          <h1 className="text-5xl font-black mb-4 tracking-tight">
            Minis de Padel
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
      </div>

      <footer className="absolute bottom-6 text-xs text-slate-600">
        © {new Date().getFullYear()} PadelPro App v2.0
      </footer>
    </div>
  );
};

export default Landing;
