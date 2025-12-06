/**
 * DesiTV™ Main Application
 * 
 * Restructured with proper auth flow using React Context
 */

import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Landing from './pages/Landing';
import AdminDashboard from './admin/AdminDashboard';
import AdminLogin from './pages/AdminLoginNew';
import './App.css';

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
      <AdminDashboard />
      
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
      <Home />
    </div>
  );
}

/**
 * App Routes - TV routes are independent, Admin routes are separate
 */
function AppRoutes() {
  return (
    <div className="app">
      <Routes>
        {/* Public: Landing Page - No dependencies */}
        <Route path="/" element={<Landing />} />
        
        {/* Public: TV View - Completely independent, no admin dependencies */}
        <Route path="/tv" element={<TVView />} />
        
        {/* Admin Routes - Separate module with auth */}
        <Route
          path="/admin/login"
          element={
            <AuthProvider>
              <AdminLogin />
            </AuthProvider>
          }
        />
        <Route
          path="/admin"
          element={
            <AuthProvider>
              <ProtectedRoute>
                <AdminView />
              </ProtectedRoute>
            </AuthProvider>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <AuthProvider>
              <ProtectedRoute>
                <AdminView />
              </ProtectedRoute>
            </AuthProvider>
          }
        />
        
        {/* Fallback to TV */}
        <Route path="*" element={<Navigate to="/tv" replace />} />
      </Routes>
    </div>
  );
}

/**
 * Main App Component
 * TV routes are independent, Admin routes have their own AuthProvider
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
