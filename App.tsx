
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
import { ShieldAlert, RefreshCw, Terminal, User, Shield, Crown, Code } from 'lucide-react';

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
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  useEffect(() => {
      const timer = setTimeout(() => {
          if (loading) setShowDiagnostic(true);
      }, 2000);
      return () => clearTimeout(timer);
  }, [loading]);

  const isAuthPage = location.pathname.includes('/auth');

  if (loading && !isAuthPage) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center font-sans overflow-hidden">
        <div className="relative mb-12">
            <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
        
        <h2 className="text-white font-black text-lg mb-1 tracking-widest uppercase italic">Padel Pro <span className="text-indigo-500">OS</span></h2>
        <p className="text-indigo-400 font-bold text-[9px] uppercase tracking-[0.2em] mb-8">
            System Initialization
        </p>

        {showDiagnostic && (
            <div className="w-full max-w-sm animate-fade-in space-y-6">
                {/* TERMINAL DE DIAGNÓSTICO */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-left font-mono text-[10px] leading-relaxed shadow-2xl">
                    <div className="flex items-center gap-2 text-indigo-400 mb-3 font-bold border-b border-slate-800 pb-2">
                        <Terminal size={12}/> DIAGNOSTIC_LOG_STREAM
                    </div>
                    <div className="space-y-1 h-32 overflow-y-auto no-scrollbar">
                        {authLogs.map((log, i) => (
                            <div key={i} className={`${log.includes('ERROR') || log.includes('No hay club') ? 'text-rose-400' : log.includes('¡ÉXITO!') ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {log}
                            </div>
                        ))}
                        <div className="text-indigo-500 animate-pulse">_</div>
                    </div>
                </div>

                {/* ACCESO RÁPIDO SOLO EN LOCAL */}
                {IS_LOCAL && (
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 text-amber-500 font-black text-[9px] uppercase tracking-widest mb-1">
                            <Code size={14}/> Local Development Bypass
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            <button onClick={() => loginWithDevBypass('admin')} className="flex items-center gap-3 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold text-white transition-all border border-white/5 uppercase"><Shield size={14} className="text-blue-400"/> Admin Bypass</button>
                            <button onClick={() => loginWithDevBypass('superadmin')} className="flex items-center gap-3 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold text-white transition-all border border-white/5 uppercase"><Crown size={14} className="text-amber-400"/> Superadmin Bypass</button>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full py-3 bg-white text-black rounded-xl font-black text-[10px] flex items-center justify-center gap-2 hover:bg-slate-100 transition-all active:scale-95"
                    >
                        <RefreshCw size={12}/> FORCE REBOOT
                    </button>
                    <button 
                        onClick={() => signOut()}
                        className="w-full py-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl font-black text-[10px] flex items-center justify-center gap-2"
                    >
                        <ShieldAlert size={12}/> CLEAR SESSION & LOGOUT
                    </button>
                </div>
            </div>
        )}
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
