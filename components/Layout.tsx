
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Users, ClipboardList, Activity, List, Menu, LogOut, UserCog, History, Settings, HelpCircle, X, Clock, Play, Square } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useHistory } from '../store/HistoryContext';
import { useTimer } from '../store/TimerContext'; // New Import
import { useTournament } from '../store/TournamentContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { clubData } = useHistory();
  const { state } = useTournament(); // To check if tournament is active
  const { timeLeft, isActive, startTimer, pauseTimer, resetTimer } = useTimer(); // Timer logic
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { path: '/dashboard', label: 'Inicio', icon: Trophy },
    { path: '/registration', label: 'Registro', icon: Users },
    { path: '/checkin', label: 'Control', icon: ClipboardList },
    { path: '/active', label: 'Directo', icon: Activity },
    { path: '/results', label: 'Clasi', icon: List },
  ];

  const menuItems = [
      { path: '/players', label: 'Gestión Jugadores', icon: UserCog },
      { path: '/history', label: 'Historial Minis', icon: History },
      { path: '/club', label: 'Datos del Club', icon: Settings },
      { path: '/help', label: 'Ayuda / FAQ', icon: HelpCircle },
  ];

  const isPublicPage = location.pathname === '/' || location.pathname === '/auth';

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      
      {/* Global Timer Sticky Bar (Only if tournament is active) - HIDDEN PER REQUEST */}
      {/* 
      {state.status === 'active' && (
          <div className="sticky top-0 z-50 bg-slate-50/90 backdrop-blur-sm">
             <div className={`max-w-3xl mx-auto px-4 py-2 flex items-center justify-between shadow-md transition-colors rounded-b-xl ${isActive ? 'bg-slate-900 text-white' : timeLeft === 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300'}`}>
                <div className="flex items-center gap-3">
                    <div className="font-mono text-2xl font-bold tracking-wider">{formatTime(timeLeft)}</div>
                    <div className="text-xs uppercase font-bold tracking-widest opacity-70">
                        Ronda {state.currentRound}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={isActive ? pauseTimer : startTimer} className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 active:scale-95 transition-all">
                        {isActive ? <Square size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}
                    </button>
                    <button onClick={resetTimer} className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 active:scale-95 transition-all">
                        <Clock size={16} />
                    </button>
                </div>
             </div>
          </div>
      )} 
      */}

      {/* Main Header (Boxed) - Sticky */}
      <div className="bg-slate-50 pt-2 px-2 md:pt-4 sticky top-0 z-40">
          <header className="max-w-3xl mx-auto bg-white p-4 flex justify-between items-center border border-slate-200 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 overflow-hidden">
                {clubData.logoUrl && (
                    <img src={clubData.logoUrl} alt="Club Logo" className="w-8 h-8 object-contain" />
                )}
                <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent truncate">
                    {clubData.name || 'PadelPro'}
                </h1>
            </div>
            <button onClick={() => setIsMenuOpen(true)} className="text-slate-700 hover:text-emerald-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
              <Menu size={24} />
            </button>
          </header>
      </div>

      {/* Hamburger Menu Drawer */}
      {isMenuOpen && (
          <div className="fixed inset-0 z-[100]">
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
              <div className="absolute right-0 top-0 bottom-0 w-64 bg-white shadow-2xl p-6 animate-slide-left flex flex-col">
                  <div className="flex justify-between items-center mb-8">
                      <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Menú Principal</span>
                      <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200"><X size={20}/></button>
                  </div>

                  <div className="space-y-4 flex-1">
                      {menuItems.map(item => (
                          <Link 
                            key={item.path} 
                            to={item.path} 
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 p-3 rounded-xl text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium transition-colors"
                          >
                              <item.icon size={20} />
                              {item.label}
                          </Link>
                      ))}
                  </div>

                  <div className="border-t border-slate-100 pt-6">
                      <button onClick={handleLogout} className="flex w-full items-center gap-3 p-3 rounded-xl text-rose-600 hover:bg-rose-50 font-bold transition-colors">
                          <LogOut size={20} />
                          Cerrar Sesión
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 pb-32 md:p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation (Boxed) */}
      {user && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-2 pointer-events-none">
            <nav className="max-w-3xl mx-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex justify-around items-center px-2 py-1 pointer-events-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex flex-col items-center justify-center py-3 px-2 w-full transition-colors rounded-xl ${
                      isActive
                        ? 'text-emerald-600'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <div className={`p-1 rounded-xl mb-0.5 transition-all ${isActive ? 'bg-emerald-100 scale-110' : 'bg-transparent'}`}>
                      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className={`text-[10px] font-bold ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
        </div>
      )}
    </div>
  );
};