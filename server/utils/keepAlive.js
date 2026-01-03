/**
 * Keep-Alive Utility for Render Free Tier
 * 
 * Render's free tier instances spin down after 15 minutes of inactivity.
 * This utility pings the server every 14 minutes to keep it alive.
 * 
 * Alternative solutions:
 * 1. Use external cron services like cron-job.org, UptimeRobot, or Pingdom
 * 2. Upgrade to Render's paid tier
 * 3. Use a GitHub Actions scheduled workflow
 */

const https = require('https');
const http = require('http');

// Configuration
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes in milliseconds
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL;

/**
 * Ping the server to keep it alive
 */
function pingServer() {
  if (!RENDER_URL) {
    console.log('[KeepAlive] No RENDER_EXTERNAL_URL or SERVER_URL set, skipping ping');
    return;
  }

  const healthUrl = `${RENDER_URL}/api/monitoring/health`;
  const protocol = healthUrl.startsWith('https') ? https : http;

  console.log(`[KeepAlive] Pinging ${healthUrl} at ${new Date().toISOString()}`);

  const req = protocol.get(healthUrl, (res) => {
    console.log(`[KeepAlive] Ping successful - Status: ${res.statusCode}`);
  });

  req.on('error', (err) => {
    console.error(`[KeepAlive] Ping failed: ${err.message}`);
  });

  req.setTimeout(10000, () => {
    req.destroy();
    console.error('[KeepAlive] Ping timeout');
  });
}

/**
 * Start the keep-alive mechanism
 * Only runs in production on Render
 */
function startKeepAlive() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isRender = process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL;

  if (!isProduction) {
    console.log('[KeepAlive] Disabled in development mode');
    return null;
  }

  if (!isRender) {
    console.log('[KeepAlive] Not running on Render, skipping keep-alive');
    return null;
  }

  if (!RENDER_URL) {
    console.log('[KeepAlive] RENDER_EXTERNAL_URL not set, skipping keep-alive');
    return null;
  }

  console.log(`[KeepAlive] Starting keep-alive service (interval: ${PING_INTERVAL / 1000 / 60} minutes)`);
  console.log(`[KeepAlive] Target URL: ${RENDER_URL}`);

  // Initial ping after 1 minute (give server time to fully start)
  setTimeout(pingServer, 60 * 1000);

  // Then ping every 14 minutes
  const intervalId = setInterval(pingServer, PING_INTERVAL);

  return intervalId;
}

/**
 * Stop the keep-alive mechanism
 */
function stopKeepAlive(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
    console.log('[KeepAlive] Keep-alive service stopped');
  }
}

module.exports = {
  startKeepAlive,
  stopKeepAlive,
  pingServer,
  PING_INTERVAL
};
