import React from 'react';

/**
 * ErrorBoundary - Catches React component errors and prevents white screen of death
 * 
 * Features:
 * - Retro TV "No Signal" aesthetic
 * - Animated static noise effect
 * - Development mode error details
 * - Reset and refresh options
 * 
 * Usage:
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Retro TV Error Screen with Static Effect
      return (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backgroundColor: '#000',
          color: '#fff',
          fontFamily: "'Courier New', monospace",
          textAlign: 'center',
          overflow: 'hidden'
        }}>
          {/* Static Noise Background */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            opacity: 0.15,
            animation: 'staticNoise 0.1s steps(5) infinite',
            pointerEvents: 'none'
          }} />

          {/* Scanlines Overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
            pointerEvents: 'none',
            opacity: 0.5
          }} />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* TV Icon with Glitch */}
            <div style={{ 
              fontSize: '80px', 
              marginBottom: '24px',
              animation: 'tvGlitch 3s ease-in-out infinite',
              filter: 'drop-shadow(0 0 20px rgba(255,0,0,0.5))'
            }}>
              📺
            </div>

            {/* Error Title */}
            <h1 style={{ 
              color: '#ff3333', 
              fontSize: '28px',
              marginBottom: '8px',
              textShadow: '2px 2px 0 #000, -1px -1px 0 #ff0000, 1px -1px 0 #00ff00',
              letterSpacing: '4px',
              fontWeight: 'bold'
            }}>
              NO SIGNAL
            </h1>

            <div style={{
              color: '#ffd700',
              fontSize: '14px',
              marginBottom: '24px',
              letterSpacing: '2px',
              textShadow: '0 0 10px rgba(255,215,0,0.5)'
            }}>
              ERROR CODE: {this.state.error?.name || 'UNKNOWN'}
            </div>

            <p style={{ 
              color: '#888', 
              marginBottom: '32px',
              maxWidth: '400px',
              lineHeight: '1.6',
              fontSize: '14px'
            }}>
              Kuch gadbad ho gayi. TV ko reset karna padega.
            </p>

            {/* Development Error Details */}
            {(import.meta.env.DEV || import.meta.env.MODE === 'development') && this.state.error && (
              <details style={{
                marginBottom: '32px',
                padding: '16px',
                backgroundColor: 'rgba(255,50,50,0.1)',
                border: '1px solid #ff3333',
                borderRadius: '8px',
                maxWidth: '600px',
                width: '100%',
                textAlign: 'left',
                fontSize: '11px'
              }}>
                <summary style={{ 
                  cursor: 'pointer', 
                  marginBottom: '12px', 
                  color: '#ff6b6b',
                  fontWeight: 'bold',
                  letterSpacing: '1px'
                }}>
                  🔧 DEBUG INFO (DEV MODE)
                </summary>
                <pre style={{ 
                  color: '#ff9999',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '300px',
                  overflow: 'auto',
                  background: 'rgba(0,0,0,0.5)',
                  padding: '12px',
                  borderRadius: '4px'
                }}>
{this.state.error?.toString()}
{this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '14px 28px',
                  fontSize: '14px',
                  backgroundColor: '#4ade80',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: "'Courier New', monospace",
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 15px rgba(74,222,128,0.3)'
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'scale(1.05)';
                  e.target.style.boxShadow = '0 6px 20px rgba(74,222,128,0.5)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = '0 4px 15px rgba(74,222,128,0.3)';
                }}
              >
                🔄 RESET TV
              </button>

              <button
                onClick={this.handleRefresh}
                style={{
                  padding: '14px 28px',
                  fontSize: '14px',
                  backgroundColor: 'transparent',
                  color: '#ffd700',
                  border: '2px solid #ffd700',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: "'Courier New', monospace",
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#ffd700';
                  e.target.style.color = '#000';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#ffd700';
                }}
              >
                🔌 REFRESH PAGE
              </button>
            </div>

            <p style={{ 
              marginTop: '32px',
              fontSize: '11px',
              color: '#555',
              letterSpacing: '1px'
            }}>
              DESITV • TECHNICAL DIFFICULTIES • PLEASE STAND BY
            </p>
          </div>

          {/* CSS Animations */}
          <style>{`
            @keyframes staticNoise {
              0% { transform: translate(0, 0); }
              10% { transform: translate(-1%, -1%); }
              20% { transform: translate(1%, 1%); }
              30% { transform: translate(-2%, 0); }
              40% { transform: translate(0, 2%); }
              50% { transform: translate(2%, -2%); }
              60% { transform: translate(-1%, 1%); }
              70% { transform: translate(1%, -1%); }
              80% { transform: translate(0, 0); }
              90% { transform: translate(-2%, 2%); }
              100% { transform: translate(0, 0); }
            }
            @keyframes tvGlitch {
              0%, 90%, 100% { transform: translateX(0); filter: drop-shadow(0 0 20px rgba(255,0,0,0.5)); }
              92% { transform: translateX(-3px); filter: drop-shadow(3px 0 0 rgba(0,255,255,0.5)); }
              94% { transform: translateX(3px); filter: drop-shadow(-3px 0 0 rgba(255,0,255,0.5)); }
              96% { transform: translateX(-1px); filter: drop-shadow(0 0 20px rgba(255,0,0,0.5)); }
              98% { transform: translateX(1px); filter: drop-shadow(0 0 20px rgba(255,0,0,0.5)); }
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

