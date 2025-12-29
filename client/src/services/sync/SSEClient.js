/**
 * Server-Sent Events (SSE) Client - Push-Only Fallback
 * 
 * Why SSE over HTTP Polling?
 * - Polling: Client asks "what time?" every Xs (PULL)
 * - SSE: Server pushes "it's now 127s" (PUSH)
 * 
 * Same persistent connection as WebSocket, but:
 * - Works through all proxies/firewalls
 * - Simpler protocol (just HTTP)
 * - Auto-reconnect built-in
 * - Zero requests after initial connection
 */

class SSEClient {
  constructor() {
    this.eventSource = null;
    this.categoryId = null;
    this.listeners = new Map(); // event -> Set of callbacks
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnected = false;
    this.lastEventId = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONNECTION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Connect to SSE endpoint
   */
  connect(categoryId) {
    if (this.eventSource) {
      this.disconnect();
    }

    this.categoryId = categoryId;
    const baseUrl = this._getBaseUrl();
    const url = `${baseUrl}/api/live-state/stream?categoryId=${encodeURIComponent(categoryId)}`;

    console.log(`[SSE] Connecting to ${url}`);

    try {
      this.eventSource = new EventSource(url, {
        withCredentials: true,
      });

      this._setupEventHandlers();
    } catch (error) {
      console.error('[SSE] Connection failed:', error);
      this._handleReconnect();
    }
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.categoryId = null;
    this._emit('disconnected', { reason: 'manual' });
  }

  /**
   * Get base URL for API
   */
  _getBaseUrl() {
    // Try environment variable first
    if (import.meta.env?.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    // Fallback to same origin
    return window.location.origin;
  }

  // ═══════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  _setupEventHandlers() {
    if (!this.eventSource) return;

    // Connection opened
    this.eventSource.onopen = () => {
      console.log('[SSE] Connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this._emit('connected', { categoryId: this.categoryId });
    };

    // Generic message handler
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.lastEventId = event.lastEventId;
        this._emit('message', data);
      } catch (e) {
        console.warn('[SSE] Failed to parse message:', e);
      }
    };

    // Sync event (main broadcast)
    this.eventSource.addEventListener('sync', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.lastEventId = event.lastEventId;
        this._emit('sync', {
          ...data,
          _receivedAt: Date.now(),
          _source: 'sse',
        });
      } catch (e) {
        console.warn('[SSE] Failed to parse sync:', e);
      }
    });

    // Video change event
    this.eventSource.addEventListener('videoChange', (event) => {
      try {
        const data = JSON.parse(event.data);
        this._emit('videoChange', data);
      } catch (e) {
        console.warn('[SSE] Failed to parse videoChange:', e);
      }
    });

    // Heartbeat (keep-alive)
    this.eventSource.addEventListener('heartbeat', (event) => {
      // Just acknowledge - no action needed
      this._emit('heartbeat', { timestamp: Date.now() });
    });

    // Error handler
    this.eventSource.onerror = (error) => {
      console.warn('[SSE] Error:', error);
      this.isConnected = false;
      
      // EventSource auto-reconnects, but we track attempts
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this._handleReconnect();
      } else if (this.eventSource?.readyState === EventSource.CONNECTING) {
        this._emit('reconnecting', { attempt: this.reconnectAttempts + 1 });
      }
    };
  }

  /**
   * Handle reconnection with backoff
   */
  _handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnect attempts reached - falling back to HTTP');
      this._emit('fallback', { reason: 'max_reconnects' });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.categoryId) {
        this.connect(this.categoryId);
      }
    }, delay);
  }

  // ═══════════════════════════════════════════════════════════════════
  // LISTENER SYSTEM
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Add event listener
   * @returns Cleanup function
   */
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit event to listeners
   */
  _emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => {
        try { cb(data); } catch (e) { console.error(`[SSE] Listener error for ${event}:`, e); }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      categoryId: this.categoryId,
      readyState: this.eventSource?.readyState ?? -1,
      reconnectAttempts: this.reconnectAttempts,
      lastEventId: this.lastEventId,
    };
  }

  /**
   * Check if SSE is supported
   */
  static isSupported() {
    return typeof EventSource !== 'undefined';
  }
}

// Singleton
export const sseClient = new SSEClient();
export default sseClient;
