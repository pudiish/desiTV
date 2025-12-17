import React from 'react';

/**
 * ErrorBoundary - Catches React component errors and prevents white screen of death
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
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console (in production, send to error tracking service)
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // In production, send to error tracking service (e.g., Sentry)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Add error tracking service
      // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    }
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null,
      errorInfo: null 
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise use default
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          backgroundColor: '#000',
          color: '#fff',
          fontFamily: 'monospace',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>📺</div>
          <h1 style={{ 
            color: '#ff0000', 
            fontSize: '24px',
            marginBottom: '16px',
            textShadow: '0 0 10px #ff0000'
          }}>
            TV SIGNAL LOST
          </h1>
          <p style={{ 
            color: '#888', 
            marginBottom: '24px',
            maxWidth: '500px'
          }}>
            Something went wrong. The TV needs to be reset.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: '#1a1a1a',
              borderRadius: '8px',
              maxWidth: '800px',
              width: '100%',
              textAlign: 'left',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '400px'
            }}>
              <summary style={{ cursor: 'pointer', marginBottom: '8px', color: '#ff6b6b' }}>
                Error Details (Development Only)
              </summary>
              <pre style={{ 
                color: '#ff6b6b',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#00ff00',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              textShadow: 'none',
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => e.target.style.opacity = '0.8'}
            onMouseOut={(e) => e.target.style.opacity = '1'}
          >
            🔄 RESET TV
          </button>
          <p style={{ 
            marginTop: '24px',
            fontSize: '12px',
            color: '#666'
          }}>
            If the problem persists, try refreshing the page
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

