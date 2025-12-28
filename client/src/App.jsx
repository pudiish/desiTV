/**
 * DesiTV™ Main Application
 * 
 * Restructured with proper auth flow using React Context
 */

import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/common';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const Landing = lazy(() => import('./pages/Landing'));
const RetroTVTest = lazy(() => import('./pages/dev/RetroTVTest'));
const YouTubeAutoplayTest = lazy(() => import('./pages/dev/YouTubeAutoplayTest'));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'));
const AdminLogin = lazy(() => import('./pages/AdminLoginNew'));

/**
 * Protected Route - requires authentication
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, initialized } = useAuth();
  const location = useLocation();

  // Wait for auth context to initialize
  if (!initialized || loading) {
    return (
      <div className="auth-checking">
        <div className="auth-spinner">📺</div>
        <p>Loading...</p>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * Admin Dashboard with navigation buttons
 */
function AdminView() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="admin-view">
      <Suspense fallback={<div>Loading Admin Dashboard...</div>}>
        <AdminDashboard />
      </Suspense>
      {/* Admin Navigation */}
      <div className="admin-nav-buttons">
        <div className="admin-user-info">
          👤 {user?.username || 'Admin'}
        </div>
        <button
          className="back-to-app-btn"
          onClick={() => navigate('/')}
          title="Back to TV"
        >
          📺 TV
        </button>
        <button
          className="logout-btn"
          onClick={handleLogout}
          title="Logout"
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
}

/**
 * Main TV View - Completely independent, no admin dependencies
 */
function TVView() {
  return (
    <div className="tv-view">
      <Suspense fallback={<div>Loading TV...</div>}>
        <Home />
      </Suspense>
    </div>
  );
}

/**
 * Admin Routes Wrapper - Single AuthProvider for all admin routes
 * This ensures authentication state is shared across all admin routes
 */
function AdminRoutesWrapper() {
  return (
    <AuthProvider>
      <Suspense fallback={<div>Loading Admin...</div>}>
        <Routes>
          <Route path="login" element={<AdminLogin />} />
          <Route
            path=""
            element={
              <ProtectedRoute>
                <AdminView />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <AdminView />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>

    </AuthProvider>
  );
}


/**
 * App Routes - TV routes are independent, Admin routes share single AuthProvider
 */
function AppRoutes() {
  return (
    <div className="app">
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          {/* Public: Landing Page - No dependencies */}
          <Route path="/" element={<Landing />} />
          {/* Public: TV View - Completely independent, no admin dependencies */}
          <Route path="/tv" element={<TVView />} />
          {/* RetroTV Test - iPhone Compatible Version */}
          <Route path="/retro" element={<RetroTVTest />} />
          {/* YouTube Autoplay Test - Reference Script Pattern */}
          <Route path="/autoplay-test" element={<YouTubeAutoplayTest />} />
          {/* Admin Routes - Single AuthProvider for all admin routes */}
          <Route path="/admin/*" element={<AdminRoutesWrapper />} />
          {/* Fallback to TV */}
          <Route path="*" element={<Navigate to="/tv" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

/**
 * Main App Component
 * TV routes are independent, Admin routes have their own AuthProvider
 */
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
