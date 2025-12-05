/**
 * DesiTV™ Admin Login Page
 * 
 * Retro-styled login page for admin portal access
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, isAuthenticated, setupAdmin } from '../services/authService';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupUsername, setSetupUsername] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [mounted, setMounted] = useState(false);

  // Log mount
  useEffect(() => {
    console.log('[AdminLogin] Component mounted');
    setMounted(true);
    
    // Clear any URL params that might cause issues
    const params = new URLSearchParams(window.location.search);
    if (params.get('logout') === 'true') {
      console.log('[AdminLogin] Logout param detected, clearing local storage');
      localStorage.removeItem('desiTV_admin_token');
      localStorage.removeItem('desiTV_admin_info');
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    console.log('[AdminLogin] Checking if already authenticated...');
    const authenticated = isAuthenticated();
    console.log('[AdminLogin] isAuthenticated result:', authenticated);
    if (authenticated) {
      console.log('[AdminLogin] Already authenticated, redirecting to dashboard');
      navigate('/admin/dashboard');
    } else {
      console.log('[AdminLogin] Not authenticated, showing login form');
    }
  }, [navigate]);
  
  // Debug render
  console.log('[AdminLogin] Rendering with state:', { 
    username, 
    loading, 
    showSetup, 
    error,
    mounted 
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await login(username, password);
      
      if (result.success) {
        navigate('/admin/dashboard');
      } else {
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!setupUsername.trim() || !setupPassword.trim()) {
      setError('Please fill in all fields');
      return;
    }
    
    if (setupPassword !== setupConfirm) {
      setError('Passwords do not match');
      return;
    }
    
    if (setupPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await setupAdmin(setupUsername, setupPassword);
      
      if (result.success) {
        setShowSetup(false);
        setUsername(setupUsername);
        setError('');
        alert('Admin account created! Please login.');
      } else {
        setError(result.error || 'Setup failed');
      }
    } catch (err) {
      setError('Setup failed. An admin may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Retro TV Static Effect Background */}
      <div style={styles.staticBg}></div>
      
      <div style={styles.loginBox}>
        {/* Logo */}
        <div style={styles.logoSection}>
          <div style={styles.tvIcon}>📺</div>
          <h1 style={styles.title}>DesiTV™</h1>
          <p style={styles.subtitle}>Admin Portal</p>
        </div>

        {/* Scanlines effect */}
        <div style={styles.scanlines}></div>

        {!showSetup ? (
          /* Login Form */
          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                placeholder="Enter username"
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="Enter password"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={styles.error}>
                ⚠️ {error}
              </div>
            )}

            <button 
              type="submit" 
              style={{
                ...styles.button,
                ...(loading && styles.buttonDisabled)
              }}
              disabled={loading}
            >
              {loading ? '⏳ Authenticating...' : '🔐 Login'}
            </button>
          </form>
        ) : (
          /* Setup Form */
          <form onSubmit={handleSetup} style={styles.form}>
            <p style={styles.setupNote}>
              First time? Create your admin account
            </p>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>Username</label>
              <input
                type="text"
                value={setupUsername}
                onChange={(e) => setSetupUsername(e.target.value)}
                style={styles.input}
                placeholder="Choose a username"
                disabled={loading}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                style={styles.input}
                placeholder="Create a password (8+ chars)"
                disabled={loading}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Confirm Password</label>
              <input
                type="password"
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
                style={styles.input}
                placeholder="Confirm password"
                disabled={loading}
              />
            </div>

            {error && (
              <div style={styles.error}>
                ⚠️ {error}
              </div>
            )}

            <button 
              type="submit" 
              style={{
                ...styles.button,
                ...(loading && styles.buttonDisabled)
              }}
              disabled={loading}
            >
              {loading ? '⏳ Creating...' : '✨ Create Admin'}
            </button>
          </form>
        )}

        {/* Toggle Setup/Login */}
        <div style={styles.toggleSection}>
          <button
            type="button"
            onClick={() => {
              setShowSetup(!showSetup);
              setError('');
            }}
            style={styles.toggleButton}
          >
            {showSetup ? '← Back to Login' : 'First Time Setup →'}
          </button>
        </div>
        
        {/* Clear Session Button (for debugging) */}
        <div style={{ marginTop: '15px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('desiTV_admin_token');
              localStorage.removeItem('desiTV_admin_info');
              setError('');
              console.log('[AdminLogin] Session cleared');
              window.location.reload();
            }}
            style={{
              ...styles.toggleButton,
              fontSize: '11px',
              opacity: 0.5,
            }}
          >
            🗑️ Clear Session
          </button>
        </div>

        {/* Security Badge */}
        <div style={styles.securityBadge}>
          🔒 Secured with JWT Authentication
        </div>
      </div>

      {/* Retro Footer */}
      <div style={styles.footer}>
        <p>© 2024 DesiTV™ | Relive the Golden Era of Indian Television</p>
      </div>

      <style>{`
        @keyframes flicker {
          0% { opacity: 0.97; }
          5% { opacity: 0.95; }
          10% { opacity: 0.9; }
          15% { opacity: 0.95; }
          20% { opacity: 0.98; }
          25% { opacity: 0.95; }
          50% { opacity: 0.97; }
          75% { opacity: 0.95; }
          100% { opacity: 0.98; }
        }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes static {
          0%, 100% { background-position: 0% 0%; }
          50% { background-position: 100% 100%; }
        }
        input:focus {
          border-color: #00d4ff !important;
          box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
        }
        button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 212, 255, 0.4);
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f1419 0%, #1a1f2e 50%, #0f1419 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden',
  },
  staticBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`,
    pointerEvents: 'none',
    animation: 'static 0.5s steps(10) infinite',
  },
  loginBox: {
    background: 'rgba(26, 31, 46, 0.95)',
    borderRadius: '20px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: `
      0 0 0 1px rgba(0, 212, 255, 0.2),
      0 20px 50px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.1)
    `,
    position: 'relative',
    animation: 'flicker 4s infinite',
  },
  scanlines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(transparent 50%, rgba(0, 0, 0, 0.1) 50%)',
    backgroundSize: '100% 4px',
    pointerEvents: 'none',
    opacity: 0.3,
    borderRadius: '20px',
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: '30px',
    position: 'relative',
    zIndex: 1,
  },
  tvIcon: {
    fontSize: '48px',
    marginBottom: '10px',
    filter: 'drop-shadow(0 0 10px rgba(0, 212, 255, 0.5))',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #00d4ff, #00f5a0)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    fontFamily: "'Courier New', monospace",
    letterSpacing: '2px',
  },
  subtitle: {
    color: '#808080',
    fontSize: '14px',
    marginTop: '5px',
    textTransform: 'uppercase',
    letterSpacing: '3px',
  },
  form: {
    position: 'relative',
    zIndex: 1,
  },
  inputGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    color: '#808080',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(37, 45, 61, 0.8)',
    border: '1px solid #2a3340',
    borderRadius: '8px',
    color: '#e0e0e0',
    fontSize: '16px',
    outline: 'none',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
    fontFamily: "'Segoe UI', sans-serif",
  },
  error: {
    background: 'rgba(255, 56, 96, 0.1)',
    border: '1px solid rgba(255, 56, 96, 0.3)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '20px',
    color: '#ff3860',
    fontSize: '14px',
    textAlign: 'center',
  },
  button: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
    border: 'none',
    borderRadius: '8px',
    color: '#0f1419',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  buttonDisabled: {
    background: '#2a3340',
    color: '#808080',
    cursor: 'not-allowed',
  },
  toggleSection: {
    marginTop: '20px',
    textAlign: 'center',
    position: 'relative',
    zIndex: 1,
  },
  toggleButton: {
    background: 'none',
    border: 'none',
    color: '#00d4ff',
    fontSize: '14px',
    cursor: 'pointer',
    textDecoration: 'underline',
    opacity: 0.8,
    transition: 'opacity 0.3s ease',
  },
  setupNote: {
    textAlign: 'center',
    color: '#00f5a0',
    fontSize: '14px',
    marginBottom: '20px',
    padding: '10px',
    background: 'rgba(0, 245, 160, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(0, 245, 160, 0.2)',
  },
  securityBadge: {
    marginTop: '30px',
    textAlign: 'center',
    color: '#00f5a0',
    fontSize: '12px',
    opacity: 0.7,
    position: 'relative',
    zIndex: 1,
  },
  footer: {
    marginTop: '30px',
    color: '#808080',
    fontSize: '12px',
    textAlign: 'center',
    opacity: 0.6,
  },
};
