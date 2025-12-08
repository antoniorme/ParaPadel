
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

// Player Pages
import PlayerDashboard from './pages/player/PlayerDashboard';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: React.PropsWithChildren) => {
  const { user, loading } = useAuth();
  const { clubData } = useHistory();
  const location = useLocation();

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Cargando...</div>;
  
  if (!user) return <Navigate to="/" replace />;
  
  // Force Onboarding if default name matches
  if (clubData.name === 'Mi Club de Padel' && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
        {/* Public Routes */}
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
        
        {/* Fullscreen Onboarding (No Layout) */}
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

        {/* PLAYER APP ROUTES (New Branch) */}
        {/* For Phase 1, these are accessible to see the UI. Later we will add specific Player Auth protection */}
        <Route path="/p/*" element={
            <PlayerLayout>
                <Routes>
                    <Route path="dashboard" element={<PlayerDashboard />} />
                    {/* Placeholder routes for nav */}
                    <Route path="tournaments" element={<div className="p-6 text-center text-slate-400">Próximamente: Torneos</div>} />
                    <Route path="profile" element={<div className="p-6 text-center text-slate-400">Próximamente: Perfil</div>} />
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                </Routes>
            </PlayerLayout>
        } />

        {/* Protected App Routes (With Admin Layout) */}
        <Route path="/*" element={
            <Layout>
                <Routes>
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/registration" element={<ProtectedRoute><Registration /></ProtectedRoute>} />
                    <Route path="/checkin" element={<ProtectedRoute><CheckIn /></ProtectedRoute>} />
                    <Route path="/active" element={<ProtectedRoute><ActiveTournament /></ProtectedRoute>} />
                    <Route path="/results" element={<ProtectedRoute><Results /></ProtectedRoute>} />
                    
                    <Route path="/players" element={<ProtectedRoute><PlayerManager /></ProtectedRoute>} />
                    <Route path="/players/:playerId" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
                    <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                    <Route path="/club" element={<ProtectedRoute><ClubProfile /></ProtectedRoute>} />
                    <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />

                    {/* Catch all redirect to dashboard */}
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
