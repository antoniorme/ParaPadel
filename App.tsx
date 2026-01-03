import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { TournamentProvider } from './store/TournamentContext';
import { LeagueProvider } from './store/LeagueContext';
import { AuthProvider, useAuth } from './store/AuthContext';
import { HistoryProvider, useHistory } from './store/HistoryContext';
import { TimerProvider } from './store/TimerContext';
import { NotificationProvider } from './store/NotificationContext';
import { Layout } from './components/Layout';
import { PlayerLayout } from './components/PlayerLayout';
import { ShieldAlert, RefreshCw, Terminal, User, Shield, Crown, Code, AlertCircle, Activity, Trophy, Loader2 } from 'lucide-react';

// Pages
import Dashboard from './pages/Dashboard';
import Registration from './pages/Registration';
import CheckIn from './pages/CheckIn';
import ActiveTournament from './pages/ActiveTournament';
import Results from './pages/Results';
import Landing from './pages/Landing';
import AuthPage from './pages/Auth';
import PlayerManager from './pages/PlayerManager';
import History from './pages/History';
import ClubProfile from './pages/ClubProfile';
import Help from './pages/Help';
import AdminPlayerProfile from './pages/PlayerProfile'; 
import Onboarding from './pages/Onboarding'; 
import JoinTournament from './pages/public/JoinTournament';
import TournamentSetup from './pages/TournamentSetup';
import SuperAdmin from './pages/SuperAdmin'; 
import Notifications from './pages/Notifications';
import NotificationSettings from './pages/NotificationSettings';
import PendingVerification from './pages/PendingVerification';

// League Pages
import LeagueDashboard from './pages/LeagueDashboard';
import LeagueSetup from './pages/LeagueSetup';
import LeagueGroups from './pages/LeagueGroups';
import LeagueActive from './pages/LeagueActive';

// Player Pages
import PlayerDashboard from './pages/player/PlayerDashboard';
import PlayerTournaments from './pages/player/PlayerTournaments';
import TournamentBrowser from './pages/player/TournamentBrowser';
import PlayerAppProfile from './pages/player/PlayerProfile';

// DETECCIÓN AGRESIVA DE DESARROLLO / SANDBOX (Google AI Studio usa .googleusercontent.com)
const IS_DEV_ENV = 
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) || 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname.includes('google') || 
  window.location.hostname.includes('webcontainer') ||
  window.location.hostname.includes('stackblitz') ||
  window.location.hostname.includes('vercel.app'); // Permite ver herramientas en despliegues de prueba

const ProtectedRoute = ({ children, requireAdmin = false, requireSuperAdmin = false }: { children?: React.ReactNode, requireAdmin?: boolean, requireSuperAdmin?: boolean }) => {
  const { user, loading, role } = useAuth();
  const { clubData } = useHistory();
  const location = useLocation();

  if (loading) return null; 
  if (!user) return <Navigate to="/" replace />;
  
  if (role === 'pending' && location.pathname !== '/pending') return <Navigate to="/pending" replace />;
  if (requireSuperAdmin && role !== 'superadmin') return <Navigate to="/dashboard" replace />;
  if (requireAdmin && role !== 'admin' && role !== 'superadmin') return <Navigate to="/p/dashboard" replace />;
  if (requireAdmin && clubData.name === 'Mi Club de Padel' && location.pathname !== '/onboarding' && role !== 'superadmin') return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, role, loading, authStatus, authLogs, loginWithDevBypass, signOut } = useAuth();
  const location = useLocation();

  const isAuthPage = location.pathname.includes('/auth');

  if (loading && !isAuthPage) {
    // Si NO es desarrollo, pantalla limpia
    if (!IS_DEV_ENV) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-indigo-100 flex items-center justify-center mb-8 animate-bounce">
                    <Trophy size={40} className="text-[#575AF9]" />
                </div>
                <div className="flex items-center gap-3 text-slate-400 font-bold text-sm tracking-widest uppercase">
                    <Loader2 size={18} className="animate-spin text-[#575AF9]"/> Iniciando Sistema
                </div>
            </div>
        );
    }

    // Si es DESARROLLO (incluido Google AI Studio), mostrar terminal de logs
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center p-6 font-mono overflow-hidden">
        <div className="w-full max-w-sm space-y-8">
            <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-6">
                    <Activity size={12} className="animate-pulse"/> Sandbox Kernel v2.3
                </div>
                <h1 className="text-white font-black text-2xl tracking-tighter italic">PADEL PRO <span className="text-indigo-500">OS</span></h1>
            </div>

            <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-2xl relative">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-white/20 text-[9px] font-bold uppercase ml-2 tracking-widest">Auth & DB Debugger</span>
                </div>
                
                <div className="space-y-1.5 h-64 overflow-y-auto no-scrollbar text-[11px]">
                    {authLogs.map((log, i) => {
                        const isError = log.includes('!!!') || log.includes('ERROR') || log.includes('Fallo');
                        const isSuccess = log.includes('OK') || log.includes('detectado') || log.includes('encontrada');
                        return (
                            <div key={i} className={`${isError ? 'text-rose-400 bg-rose-400/5' : isSuccess ? 'text-emerald-400' : 'text-slate-400'} px-2 py-0.5 rounded border-l-2 ${isError ? 'border-rose-500' : isSuccess ? 'border-emerald-500' : 'border-transparent'}`}>
                                {log}
                            </div>
                        );
                    })}
                    <div className="text-indigo-500 animate-pulse px-2">_ ANALYZING_USER_ROLE...</div>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex gap-2">
                    <button onClick={() => window.location.reload()} className="flex-1 py-3 bg-white text-black rounded-xl font-black text-[10px] flex items-center justify-center gap-2 hover:bg-slate-100 transition-all active:scale-95">
                        <RefreshCw size={12}/> REINTENTAR
                    </button>
                    <button onClick={() => signOut()} className="flex-1 py-3 bg-white/5 text-white border border-white/10 rounded-xl font-black text-[10px] flex items-center justify-center gap-2">
                        <ShieldAlert size={12}/> FORZAR LOGOUT
                    </button>
                </div>

                <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl mt-4">
                    <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Code size={14}/> Sandbox Dev Tools
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => loginWithDevBypass('admin')} className="py-2 bg-white/5 text-white text-[9px] font-bold rounded-lg border border-white/5 hover:bg-white/10">MODO CLUB</button>
                        <button onClick={() => loginWithDevBypass('superadmin')} className="py-2 bg-white/5 text-white text-[9px] font-bold rounded-lg border border-white/5 hover:bg-white/10">MODO SA</button>
                    </div>
                </div>
            </div>
            <p className="text-white/20 text-center text-[9px] font-bold uppercase tracking-[0.3em]">{authStatus}</p>
        </div>
      </div>
    );
  }

  const getHomeRoute = () => {
      if (!user) return <Landing />;
      if (role === 'superadmin') return <Navigate to="/superadmin" replace />;
      if (role === 'admin') return <Navigate to="/dashboard" replace />;
      if (role === 'pending') return <Navigate to="/pending" replace />;
      return <Navigate to="/p/dashboard" replace />;
  };

  return (
    <Routes>
        <Route path="/" element={getHomeRoute()} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/pending" element={<ProtectedRoute><PendingVerification /></ProtectedRoute>} />
        <Route path="/join/:clubId" element={<JoinTournament />} />
        <Route path="/onboarding" element={<ProtectedRoute requireAdmin><Onboarding /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/notifications/settings" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />

        <Route path="/p/*" element={
            <ProtectedRoute>
                <PlayerLayout>
                    <Routes>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<PlayerDashboard />} />
                        <Route path="explore" element={<TournamentBrowser />} />
                        <Route path="tournaments" element={<PlayerTournaments />} />
                        <Route path="profile" element={<PlayerAppProfile />} />
                        <Route path="*" element={<Navigate to="dashboard" replace />} />
                    </Routes>
                </PlayerLayout>
            </ProtectedRoute>
        } />

        <Route path="/superadmin" element={
            <Layout>
                <ProtectedRoute requireSuperAdmin>
                    <SuperAdmin />
                </ProtectedRoute>
            </Layout>
        } />

        <Route path="/*" element={
            <Layout>
                <Routes>
                    <Route path="/dashboard" element={<ProtectedRoute requireAdmin><Dashboard /></ProtectedRoute>} />
                    <Route path="/setup" element={<ProtectedRoute requireAdmin><TournamentSetup /></ProtectedRoute>} />
                    <Route path="/registration" element={<ProtectedRoute requireAdmin><Registration /></ProtectedRoute>} />
                    <Route path="/checkin" element={<ProtectedRoute requireAdmin><CheckIn /></ProtectedRoute>} />
                    <Route path="/active" element={<ProtectedRoute requireAdmin><ActiveTournament /></ProtectedRoute>} />
                    <Route path="/results" element={<ProtectedRoute requireAdmin><Results /></ProtectedRoute>} />
                    <Route path="/league" element={<ProtectedRoute requireAdmin><LeagueDashboard /></ProtectedRoute>} />
                    <Route path="/league/setup" element={<ProtectedRoute requireAdmin><LeagueSetup /></ProtectedRoute>} />
                    <Route path="/league/groups/:categoryId" element={<ProtectedRoute requireAdmin><LeagueGroups /></ProtectedRoute>} />
                    <Route path="/league/active" element={<ProtectedRoute requireAdmin><LeagueActive /></ProtectedRoute>} />
                    <Route path="/players" element={<ProtectedRoute requireAdmin><PlayerManager /></ProtectedRoute>} />
                    <Route path="/players/:playerId" element={<ProtectedRoute requireAdmin><AdminPlayerProfile /></ProtectedRoute>} />
                    <Route path="/history" element={<ProtectedRoute requireAdmin><History /></ProtectedRoute>} />
                    <Route path="/club" element={<ProtectedRoute requireAdmin><ClubProfile /></ProtectedRoute>} />
                    <Route path="/help" element={<ProtectedRoute requireAdmin><Help /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </Layout>
        } />
    </Routes>
  );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HistoryProvider>
        <NotificationProvider>
            <TournamentProvider>
                <LeagueProvider>
                    <TimerProvider>
                        <HashRouter>
                        <AppRoutes />
                        </HashRouter>
                    </TimerProvider>
                </LeagueProvider>
            </TournamentProvider>
        </NotificationProvider>
      </HistoryProvider>
    </AuthProvider>
  );
};

export default App;