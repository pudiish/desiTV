/**
 * Database Connection Manager with Retry Logic
 * 
 * Provides:
 * - Automatic retry with exponential backoff
 * - Connection health monitoring
 * - Graceful reconnection on connection loss
 * - Connection state tracking
 */

const mongoose = require('mongoose');

class DBConnectionManager {
  constructor() {
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, error
    this.retryCount = 0;
    this.maxRetries = 10; // Maximum retry attempts
    this.baseDelay = 1000; // Base delay in ms (1 second)
    this.maxDelay = 30000; // Maximum delay in ms (30 seconds)
    this.connectionOptions = null;
    this.mongoUri = null;
    this.retryTimeout = null;
    this.healthCheckInterval = null;
    this.onConnectionCallbacks = [];
    this.onDisconnectionCallbacks = [];
  }

  /**
   * Get current connection state
   */
  getState() {
    return {
      state: this.connectionState,
      retryCount: this.retryCount,
      isConnected: mongoose.connection.readyState === 1
    };
  }

  /**
   * Calculate exponential backoff delay
   */
  getRetryDelay() {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.retryCount),
      this.maxDelay
    );
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay; // Up to 30% jitter
    return Math.floor(delay + jitter);
  }

  /**
   * Connect to MongoDB with retry logic
   */
  async connect(mongoUri, options = {}) {
    this.mongoUri = mongoUri;
    this.connectionOptions = options;

    // Set up connection event handlers
    this.setupEventHandlers();

    return this.attemptConnection();
  }

  /**
   * Attempt connection (with retry logic)
   */
  async attemptConnection() {
    if (this.connectionState === 'connecting') {
      console.log('[DBConnection] Connection already in progress, skipping...');
      return;
    }

    this.connectionState = 'connecting';

    try {
      console.log(`[DBConnection] Attempting connection (attempt ${this.retryCount + 1}/${this.maxRetries + 1})...`);
      
      await mongoose.connect(this.mongoUri, this.connectionOptions);
      
      // Success!
      this.connectionState = 'connected';
      this.retryCount = 0;
      console.log('[DBConnection] ✅ Successfully connected to MongoDB');
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Call connection callbacks
      this.onConnectionCallbacks.forEach(cb => {
        try {
          cb();
        } catch (err) {
          console.error('[DBConnection] Error in connection callback:', err);
        }
      });

      return true;
    } catch (error) {
      this.connectionState = 'error';
      this.retryCount++;

      console.error(`[DBConnection] ❌ Connection failed (attempt ${this.retryCount}):`, error.message);

      if (this.retryCount > this.maxRetries) {
        console.error(`[DBConnection] ❌ Max retries (${this.maxRetries}) exceeded. Giving up.`);
        this.connectionState = 'disconnected';
        throw new Error(`Failed to connect to MongoDB after ${this.maxRetries} attempts: ${error.message}`);
      }

      // Schedule retry with exponential backoff
      const delay = this.getRetryDelay();
      console.log(`[DBConnection] ⏳ Retrying in ${delay}ms...`);

      return new Promise((resolve, reject) => {
        this.retryTimeout = setTimeout(async () => {
          try {
            const result = await this.attemptConnection();
            resolve(result);
          } catch (err) {
            reject(err);
          }
        }, delay);
      });
    }
  }

  /**
   * Setup MongoDB connection event handlers
   */
  setupEventHandlers() {
    // Connection events
    mongoose.connection.on('connected', () => {
      this.connectionState = 'connected';
      this.retryCount = 0;
      console.log('[DBConnection] ✅ MongoDB connected');
    });

    mongoose.connection.on('error', (err) => {
      this.connectionState = 'error';
      console.error('[DBConnection] ❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      this.connectionState = 'disconnected';
      console.warn('[DBConnection] ⚠️  MongoDB disconnected');
      
      // Call disconnection callbacks
      this.onDisconnectionCallbacks.forEach(cb => {
        try {
          cb();
        } catch (err) {
          console.error('[DBConnection] Error in disconnection callback:', err);
        }
      });

      // Attempt reconnection if we were previously connected
      if (this.mongoUri) {
        console.log('[DBConnection] 🔄 Attempting to reconnect...');
        this.retryCount = 0; // Reset retry count for reconnection
        this.attemptConnection().catch(err => {
          console.error('[DBConnection] Reconnection failed:', err.message);
        });
      }
    });

    // Handle process termination
    process.on('SIGINT', () => {
      this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    // Clear existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Check connection health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      const state = mongoose.connection.readyState;
      
      // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
      if (state === 0 && this.connectionState === 'connected') {
        console.warn('[DBConnection] ⚠️  Connection lost, health check detected disconnect');
        // Event handler will trigger reconnection
      } else if (state === 1 && this.connectionState !== 'connected') {
        console.log('[DBConnection] ✅ Connection restored');
        this.connectionState = 'connected';
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    this.stopHealthMonitoring();
    
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('[DBConnection] Disconnected from MongoDB');
    }
    
    this.connectionState = 'disconnected';
  }

  /**
   * Register callback for successful connection
   */
  onConnection(callback) {
    this.onConnectionCallbacks.push(callback);
  }

  /**
   * Register callback for disconnection
   */
  onDisconnection(callback) {
    this.onDisconnectionCallbacks.push(callback);
  }

  /**
   * Check if database is ready
   */
  isReady() {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Wait for connection to be ready (with timeout)
   */
  async waitForConnection(timeout = 30000) {
    if (this.isReady()) {
      return true;
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        if (this.isReady()) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error('Connection timeout'));
        }
      }, 100);

      // Also listen for connection event
      const connectionHandler = () => {
        clearInterval(checkInterval);
        mongoose.connection.removeListener('connected', connectionHandler);
        resolve(true);
      };
      
      mongoose.connection.once('connected', connectionHandler);
    });
  }
}

// Export singleton instance
const dbConnectionManager = new DBConnectionManager();

module.exports = dbConnectionManager;

