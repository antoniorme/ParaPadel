

import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { TournamentProvider } from './store/TournamentContext';
import { AuthProvider, useAuth } from './store/AuthContext';
import { HistoryProvider, useHistory } from './store/HistoryContext';
import { TimerProvider } from './store/TimerContext';
import { Layout } from './components/Layout';
import { PlayerLayout } from './components/PlayerLayout';

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
import PlayerProfile from './pages/PlayerProfile';
import Onboarding from './pages/Onboarding'; 
import JoinTournament from './pages/public/JoinTournament';
import TournamentSetup from './pages/TournamentSetup';

// Player Pages
import PlayerDashboard from './pages/player/PlayerDashboard';
import PlayerTournaments from './pages/player/PlayerTournaments';
import TournamentBrowser from './pages/player/TournamentBrowser';

// Protected Route Wrapper
const ProtectedRoute = ({ children, requireAdmin = false }: { children?: React.ReactNode, requireAdmin?: boolean }) => {
  const { user, loading, role } = useAuth();
  const { clubData } = useHistory();
  const location = useLocation();

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 font-bold">Cargando...</div>;
  
  if (!user) return <Navigate to="/" replace />;
  
  // PROTECCIÓN DE ROL:
  // Si requiere admin pero el usuario es 'player', lo mandamos a su dashboard.
  if (requireAdmin && role !== 'admin') {
      return <Navigate to="/p/dashboard" replace />;
  }

  // Force Onboarding for Admins if generic name (only for admin routes)
  if (requireAdmin && clubData.name === 'Mi Club de Padel' && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, role, loading } = useAuth();

  if (loading) return null; // Wait for auth check

  const getHomeRoute = () => {
      if (!user) return <Landing />;
      // Redirección inteligente basada en rol
      if (role === 'admin') return <Navigate to="/dashboard" replace />;
      return <Navigate to="/p/dashboard" replace />;
  };

  return (
    <Routes>
        {/* Entry Point */}
        <Route path="/" element={getHomeRoute()} />
        
        {/* Auth */}
        <Route path="/auth" element={user ? getHomeRoute() : <AuthPage />} />
        
        {/* Public Registration Wizard (No Auth Required) */}
        <Route path="/join/:clubId" element={<JoinTournament />} />

        {/* Fullscreen Onboarding (Admin Only) */}
        <Route path="/onboarding" element={<ProtectedRoute requireAdmin><Onboarding /></ProtectedRoute>} />

        {/* PLAYER APP ROUTES (Accessible to Players and Admins who want to preview) */}
        <Route path="/p/*" element={
            <ProtectedRoute>
                <PlayerLayout>
                    <Routes>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<PlayerDashboard />} />
                        <Route path="explore" element={<TournamentBrowser />} />
                        <Route path="tournaments" element={<PlayerTournaments />} />
                        <Route path="profile" element={<div className="p-6 text-center text-slate-400">Próximamente: Perfil</div>} />
                        <Route path="*" element={<Navigate to="dashboard" replace />} />
                    </Routes>
                </PlayerLayout>
            </ProtectedRoute>
        } />

        {/* ADMIN ROUTES (Strictly Admin Only) */}
        <Route path="/*" element={
            <Layout>
                <Routes>
                    <Route path="/dashboard" element={<ProtectedRoute requireAdmin><Dashboard /></ProtectedRoute>} />
                    <Route path="/setup" element={<ProtectedRoute requireAdmin><TournamentSetup /></ProtectedRoute>} />
                    <Route path="/registration" element={<ProtectedRoute requireAdmin><Registration /></ProtectedRoute>} />
                    <Route path="/checkin" element={<ProtectedRoute requireAdmin><CheckIn /></ProtectedRoute>} />
                    <Route path="/active" element={<ProtectedRoute requireAdmin><ActiveTournament /></ProtectedRoute>} />
                    <Route path="/results" element={<ProtectedRoute requireAdmin><Results /></ProtectedRoute>} />
                    
                    <Route path="/players" element={<ProtectedRoute requireAdmin><PlayerManager /></ProtectedRoute>} />
                    <Route path="/players/:playerId" element={<ProtectedRoute requireAdmin><PlayerProfile /></ProtectedRoute>} />
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
        <TournamentProvider>
            <TimerProvider>
                <HashRouter>
                <AppRoutes />
                </HashRouter>
            </TimerProvider>
        </TournamentProvider>
      </HistoryProvider>
    </AuthProvider>
  );
};

export default App;