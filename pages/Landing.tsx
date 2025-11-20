import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 items-center justify-center p-6 text-center">
      <div className="mb-8 animate-bounce p-6 bg-white rounded-full shadow-lg">
        <Trophy size={80} className="text-emerald-600" />
      </div>
      
      <h1 className="text-4xl font-black mb-4 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
        PadelPro Manager
      </h1>
      
      <p className="text-slate-500 mb-12 max-w-xs mx-auto leading-relaxed">
        Organiza torneos americanos, gestiona parejas, pistas y resultados en tiempo real desde tu móvil.
      </p>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button 
          onClick={() => navigate('/auth?mode=login')}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
        >
          Iniciar Sesión
        </button>
        
        <button 
          onClick={() => navigate('/auth?mode=register')}
          className="w-full py-4 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl font-bold text-slate-600 transition-transform active:scale-95 shadow-sm"
        >
          Crear Cuenta
        </button>
      </div>

      <footer className="mt-16 text-xs text-slate-400">
        © {new Date().getFullYear()} PadelPro App v1.0
      </footer>
    </div>
  );
};

export default Landing;