
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Users, ClipboardList, Activity, List, Menu, LogOut, UserCog, History, Settings, HelpCircle, X } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useHistory } from '../store/HistoryContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { clubData } = useHistory();
  
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

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      
      {/* Mobile Top Header */}
      <header className="bg-white p-5 sticky top-0 z-30 shadow-sm flex justify-between items-center border-b border-slate-200">
        <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent truncate max-w-[200px]">
            {clubData.name || 'PadelPro'}
        </h1>
        <button onClick={() => setIsMenuOpen(true)} className="text-slate-700 hover:text-emerald-600 p-2 rounded-full hover:bg-slate-100">
          <Menu size={24} />
        </button>
      </header>

      {/* Hamburger Menu Drawer */}
      {isMenuOpen && (
          <div className="fixed inset-0 z-[100]">
              {/* Backdrop */}
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
              {/* Drawer */}
              <div className="absolute right-0 top-0 bottom-0 w-64 bg-white shadow-2xl p-6 animate-slide-left flex flex-col">
                  <div className="flex justify-between items-center mb-8">
                      <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Menú Principal</span>
                      <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-600"><X size={20}/></button>
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
      <main className="flex-1 p-6 pb-28 md:p-10 md:pb-10 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex justify-around items-center safe-pb text-xs shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)] pb-2 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center py-3 px-2 w-full transition-colors ${
                  isActive
                    ? 'text-emerald-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className={`p-1 rounded-xl mb-1 transition-all ${isActive ? 'bg-emerald-100' : 'bg-transparent'}`}>
                   <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`font-medium ${isActive ? 'text-emerald-700' : ''}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
};
