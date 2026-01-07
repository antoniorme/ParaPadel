
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Users, ClipboardList, Activity, List, Menu, LogOut, UserCog, History, Settings, HelpCircle, X, Bell, Shield, LayoutGrid, Home, CalendarRange, GitMerge, ArrowLeft } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useHistory } from '../store/HistoryContext';
import { useTournament } from '../store/TournamentContext';
import { useNotifications } from '../store/NotificationContext';
import { THEME } from '../utils/theme';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, role } = useAuth();
  const { clubData } = useHistory();
  const { state, closeTournament } = useTournament(); 
  const { unreadCount } = useNotifications();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isTournamentActive = !!state.id && state.status !== 'finished';
  // Detectar si estamos DENTRO de una liga activa (jugando/gestionando)
  const isLeagueActiveView = location.pathname.includes('/league/active');
  const isLeaguePath = location.pathname.startsWith('/league');
  
  // THEME LOGIC:
  // - Tournament Active: Light Mode (bg-slate-50)
  // - League Mode: Mid Blue Mode (bg-indigo-400)
  // - Dashboard/Club Mode: Dark Mode (bg-slate-950)
  const isDarkMode = !isTournamentActive && !isLeaguePath; 

  const clubNavItems = [
      { path: '/dashboard', label: 'Minis', icon: LayoutGrid },
      { path: '/league', label: 'Liga', icon: CalendarRange },
      { path: '/players', label: 'Jugadores', icon: UserCog },
      { path: '/history', label: 'Historial', icon: History },
      { path: '/club', label: 'Club', icon: Settings },
  ];

  const tournamentNavItems = [
    { path: '/dashboard', label: 'Gestión', icon: Settings },
    { path: '/registration', label: 'Registro', icon: Users },
    { path: '/checkin', label: 'Control', icon: ClipboardList },
    { path: '/active', label: 'Directo', icon: Activity },
    { path: '/results', label: 'Clasi', icon: List },
  ];

  // NEW: Menú específico para la Liga Activa (Estructura Espejo de Minis)
  const leagueNavItems = [
    { path: '/league/active?tab=management', label: 'Gestión', icon: Settings },
    { path: '/league/active?tab=registration', label: 'Registro', icon: Users },
    { path: '/league/active?tab=standings', label: 'Clasi', icon: Trophy },
    { path: '/league/active?tab=calendar', label: 'Jornadas', icon: CalendarRange },
    { path: '/league/active?tab=playoffs', label: 'Playoff', icon: GitMerge },
  ];

  // Prioridad: Torneo Activo > Liga Activa > Menú Club
  let currentNavItems = clubNavItems;
  if (isTournamentActive) {
      currentNavItems = tournamentNavItems;
  } else if (isLeagueActiveView) {
      currentNavItems = leagueNavItems;
  }

  const menuItems = [
      { path: '/dashboard', label: 'Mis Torneos Mini', icon: LayoutGrid },
      { path: '/league', label: 'Mi Liga Profesional', icon: CalendarRange },
      { path: '/players', label: 'Gestión Jugadores', icon: UserCog },
      { path: '/history', label: 'Historial Minis', icon: History },
      { path: '/club', label: 'Datos del Club', icon: Settings },
      { path: '/help', label: 'Ayuda / FAQ', icon: HelpCircle },
  ];

  if (role === 'superadmin') {
      menuItems.unshift({ path: '/superadmin', label: 'Super Admin', icon: Shield });
  }

  const isPublicPage = location.pathname === '/' || location.pathname === '/auth';

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleBackToHub = () => {
      closeTournament();
      navigate('/dashboard');
  };

  if (isPublicPage) {
    return <>{children}</>;
  }

  const getBodyBackground = () => {
      if (isLeaguePath) return 'bg-indigo-400'; // Softer blue
      if (isDarkMode) return 'bg-slate-950';
      return 'bg-slate-50';
  };

  // Logic for Logo/Title Display
  const showDefaultBranding = clubData.name === 'Mi Club de Padel' || clubData.name === 'ParaPadel';

  return (
    <div className={`min-h-screen transition-colors duration-500 flex flex-col overflow-x-hidden ${getBodyBackground()} ${isDarkMode || isLeaguePath ? 'text-slate-50' : 'text-slate-900'}`}>
      
      <div className={`${getBodyBackground()} pt-2 px-2 md:pt-4 sticky top-0 z-40 transition-colors duration-500`}>
          <header className={`max-w-3xl mx-auto px-4 py-3 flex justify-between items-center border rounded-2xl shadow-sm transition-all duration-500 ${isLeaguePath ? 'bg-indigo-500 border-indigo-300 shadow-indigo-500/20' : isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
                {isTournamentActive && (
                    <button onClick={handleBackToHub} className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors shrink-0" title="Volver a Mis Torneos">
                        <Home size={18} className="text-slate-600"/>
                    </button>
                )}
                {/* Botón de volver específico para Liga (si estamos dentro de una) */}
                {!isTournamentActive && isLeagueActiveView && (
                    <button onClick={() => navigate('/league')} className="p-1.5 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shrink-0 border border-indigo-400" title="Salir de la Liga">
                        <ArrowLeft size={18} className="text-white"/>
                    </button>
                )}

                <div className={`w-10 h-10 rounded-xl overflow-hidden shrink-0 border-2 ${isLeaguePath ? 'border-indigo-200 bg-indigo-600' : isDarkMode ? 'border-slate-800 bg-slate-800' : 'border-slate-100 bg-slate-50'} flex items-center justify-center`}>
                    {clubData.logoUrl ? (
                        <img 
                            src={clubData.logoUrl} 
                            alt="Logo" 
                            className="w-full h-full object-cover" 
                        />
                    ) : (
                        <Trophy size={20} className={isDarkMode || isLeaguePath ? 'text-indigo-200' : 'text-slate-300'} />
                    )}
                </div>
                
                <div className="flex flex-col overflow-hidden">
                    {showDefaultBranding ? (
                        <h1 className="text-base md:text-lg font-black truncate leading-tight italic tracking-tighter">
                            <span className={isDarkMode || isLeaguePath ? 'text-white' : 'text-slate-900'}>Para</span>
                            <span style={{ color: THEME.cta }}>Pádel</span>
                        </h1>
                    ) : (
                        <h1 className={`text-base md:text-lg font-black truncate leading-tight ${isDarkMode || isLeaguePath ? 'text-white' : 'text-slate-900'}`}>
                            {clubData.name}
                        </h1>
                    )}
                    
                    {isTournamentActive ? (
                        <span className="text-[9px] text-[#575AF9] font-black uppercase tracking-widest truncate">Torneo Activo</span>
                    ) : isLeagueActiveView ? (
                        <span className="text-[9px] text-indigo-100 font-black uppercase tracking-widest truncate opacity-90">Liga en Juego</span>
                    ) : isLeaguePath ? (
                        <span className="text-[9px] text-indigo-100 font-black uppercase tracking-widest truncate opacity-90">Módulo de Liga</span>
                    ) : (
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider truncate">Gestión de Club</span>
                    )}
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => navigate('/notifications')} 
                    className={`relative p-2 rounded-full transition-colors ${isDarkMode || isLeaguePath ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
                >
                    <Bell size={22} />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                            {unreadCount}
                        </span>
                    )}
                </button>
                <button onClick={() => setIsMenuOpen(true)} className={`p-2 rounded-full transition-colors ${isDarkMode || isLeaguePath ? 'text-slate-200 hover:text-white hover:bg-white/10' : 'text-slate-700 hover:text-[#575AF9] hover:bg-slate-100'}`}>
                  <Menu size={26} />
                </button>
            </div>
          </header>
      </div>

      {isMenuOpen && (
          <div className="fixed inset-0 z-[100]">
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
              <div className={`absolute right-0 top-0 bottom-0 w-64 shadow-2xl p-6 animate-slide-left flex flex-col transition-colors duration-500 ${isDarkMode || isLeaguePath ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
                  <div className="flex justify-between items-center mb-8">
                      <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Menú Principal</span>
                      <button onClick={() => setIsMenuOpen(false)} className={`p-2 rounded-full transition-colors ${isDarkMode || isLeaguePath ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><X size={20}/></button>
                  </div>

                  <div className="space-y-4 flex-1">
                      {isTournamentActive && (
                          <button 
                            onClick={() => { handleBackToHub(); setIsMenuOpen(false); }}
                            className={`flex w-full items-center gap-3 p-3 rounded-xl font-bold transition-colors ${isDarkMode || isLeaguePath ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                          >
                              <Home size={20} /> Volver a Mis Torneos
                          </button>
                      )}
                      
                      {menuItems.map(item => (
                          <Link 
                            key={item.path} 
                            to={item.path} 
                            onClick={() => setIsMenuOpen(false)}
                            className={`flex items-center gap-3 p-3 rounded-xl font-medium transition-colors ${item.path === '/superadmin' ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-800/50' : isDarkMode || isLeaguePath ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-700 hover:bg-[#EEFF00]/20 hover:text-[#2B2DBF]'}`}
                          >
                              <item.icon size={20} />
                              {item.label}
                              {item.path === '/league' && <span className="ml-auto bg-indigo-500 text-[8px] px-1.5 py-0.5 rounded text-white font-black">PRO</span>}
                          </Link>
                      ))}
                  </div>

                  <div className={`border-t pt-6 ${isDarkMode || isLeaguePath ? 'border-slate-800' : 'border-slate-100'}`}>
                      <button onClick={handleLogout} className="flex w-full items-center gap-3 p-3 rounded-xl text-rose-500 hover:bg-rose-500/10 font-bold transition-colors">
                          <LogOut size={20} />
                          Cerrar Sesión
                      </button>
                  </div>
              </div>
          </div>
      )}

      <main className="flex-1 p-4 pb-32 md:p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {children}
        </div>
      </main>

      {user && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-2 pointer-events-none">
            <nav className={`max-w-3xl mx-auto backdrop-blur-md border rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex justify-around items-center px-2 py-1 pointer-events-auto transition-all duration-500 ${isLeaguePath ? 'bg-indigo-500/95 border-indigo-300' : isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
              {currentNavItems.map((item) => {
                const Icon = item.icon;
                // Check if active. For leagues with query params, check base path + query if present
                const isActive = isLeagueActiveView 
                    ? location.pathname + location.search === item.path
                    : location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    replace={isLeagueActiveView} // Use replace for tabs to avoid bloating history
                    className={`flex flex-col items-center justify-center py-3 px-2 w-full transition-all rounded-xl ${
                      isActive
                        ? (isDarkMode || isLeaguePath ? 'text-white' : 'text-[#575AF9]')
                        : (isDarkMode || isLeaguePath ? 'text-indigo-200 hover:text-white' : 'text-slate-500 hover:text-slate-300')
                    }`}
                  >
                    <div className={`p-1 rounded-xl mb-0.5 transition-all ${isActive ? (isDarkMode || isLeaguePath ? 'bg-white/20 scale-110' : 'bg-[#575AF9]/10 scale-110') : 'bg-transparent'}`}>
                      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className={`text-[10px] font-bold ${isActive ? (isDarkMode || isLeaguePath ? 'text-white' : 'text-[#2B2DBF]') : (isLeaguePath ? 'text-indigo-200' : 'text-slate-500')}`}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
        </div>
      )}
    </div>
  );
};
