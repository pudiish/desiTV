/**
 * useConnectionQuality - Graceful Degradation UI Hook
 * 
 * Shows users their connection quality so they know what to expect.
 * 
 * Quality Levels:
 * - EXCELLENT: WebSocket connected, <100ms RTT
 * - GOOD: WebSocket/SSE connected, <300ms RTT
 * - FAIR: Predictive engine only, some drift
 * - POOR: HTTP polling fallback
 * - OFFLINE: No connection
 */

import { useState, useEffect, useCallback } from 'react';
import { predictiveEngine } from '../services/sync/PredictiveEngine';
import socketService from '../services/socket';
import { sseClient } from '../services/sync/SSEClient';

// Quality levels
export const ConnectionQuality = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  OFFLINE: 'offline',
};

// Quality metadata
const QUALITY_INFO = {
  [ConnectionQuality.EXCELLENT]: {
    label: 'Excellent',
    icon: '🟢',
    description: 'Real-time sync active',
    color: '#22c55e',
  },
  [ConnectionQuality.GOOD]: {
    label: 'Good',
    icon: '🟢',
    description: 'Connected with minor delay',
    color: '#84cc16',
  },
  [ConnectionQuality.FAIR]: {
    label: 'Fair',
    icon: '🟡',
    description: 'Local prediction mode',
    color: '#eab308',
  },
  [ConnectionQuality.POOR]: {
    label: 'Poor',
    icon: '🟠',
    description: 'Limited connectivity',
    color: '#f97316',
  },
  [ConnectionQuality.OFFLINE]: {
    label: 'Offline',
    icon: '🔴',
    description: 'No connection',
    color: '#ef4444',
  },
};

/**
 * Hook to track connection quality
 */
export function useConnectionQuality() {
  const [quality, setQuality] = useState(ConnectionQuality.FAIR);
  const [strategy, setStrategy] = useState('initializing');
  const [rtt, setRtt] = useState(null);
  const [drift, setDrift] = useState(0);
  const [details, setDetails] = useState({});

  // Calculate quality from metrics
  const calculateQuality = useCallback(() => {
    const stats = predictiveEngine.getStats();
    const socketConnected = socketService.isConnected();
    const sseConnected = sseClient.isConnected;
    
    // Determine active strategy
    let activeStrategy = 'offline';
    if (socketConnected) {
      activeStrategy = 'websocket';
    } else if (sseConnected) {
      activeStrategy = 'sse';
    } else if (stats.initialized) {
      activeStrategy = 'predictive';
    }
    setStrategy(activeStrategy);

    // Get RTT
    const avgRtt = stats.avgRtt || null;
    setRtt(avgRtt);

    // Get drift
    const recentDrifts = stats.recentDrifts || [];
    const avgDrift = recentDrifts.length > 0
      ? Math.abs(recentDrifts.reduce((a, b) => a + b, 0) / recentDrifts.length)
      : 0;
    setDrift(avgDrift);

    // Calculate quality level
    let newQuality = ConnectionQuality.OFFLINE;

    if (socketConnected) {
      if (avgRtt !== null && avgRtt < 100 && avgDrift < 200) {
        newQuality = ConnectionQuality.EXCELLENT;
      } else if (avgRtt !== null && avgRtt < 300 && avgDrift < 500) {
        newQuality = ConnectionQuality.GOOD;
      } else {
        newQuality = ConnectionQuality.FAIR;
      }
    } else if (sseConnected) {
      if (avgRtt !== null && avgRtt < 200 && avgDrift < 300) {
        newQuality = ConnectionQuality.GOOD;
      } else {
        newQuality = ConnectionQuality.FAIR;
      }
    } else if (stats.initialized) {
      if (stats.confidence > 0.8 && avgDrift < 500) {
        newQuality = ConnectionQuality.FAIR;
      } else {
        newQuality = ConnectionQuality.POOR;
      }
    }

    setQuality(newQuality);
    setDetails({
      ...stats,
      socketConnected,
      sseConnected,
      avgDrift,
    });

    return newQuality;
  }, []);

  // Update quality periodically
  useEffect(() => {
    calculateQuality();
    const interval = setInterval(calculateQuality, 2000);
    return () => clearInterval(interval);
  }, [calculateQuality]);

  // Listen for connection changes
  useEffect(() => {
    const handleSocketConnect = () => calculateQuality();
    const handleSocketDisconnect = () => calculateQuality();
    
    const unsubConnect = socketService.addListener('connected', handleSocketConnect);
    const unsubDisconnect = socketService.addListener('disconnected', handleSocketDisconnect);

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, [calculateQuality]);

  return {
    quality,
    strategy,
    rtt,
    drift,
    details,
    info: QUALITY_INFO[quality],
    isHealthy: quality === ConnectionQuality.EXCELLENT || quality === ConnectionQuality.GOOD,
    needsAttention: quality === ConnectionQuality.POOR || quality === ConnectionQuality.OFFLINE,
  };
}

/**
 * Simple component to display connection quality
 */
export function ConnectionQualityBadge({ className = '' }) {
  const { quality, info, strategy, rtt } = useConnectionQuality();

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${className}`}
      style={{ backgroundColor: `${info.color}20`, color: info.color }}
      title={`${info.description} | Strategy: ${strategy} | RTT: ${rtt ? rtt + 'ms' : 'N/A'}`}
    >
      <span>{info.icon}</span>
      <span>{info.label}</span>
    </div>
  );
}

/**
 * Detailed connection status component
 */
export function ConnectionStatus({ showDetails = false }) {
  const { quality, info, strategy, rtt, drift, details, needsAttention } = useConnectionQuality();

  return (
    <div className="space-y-2">
      {/* Main badge */}
      <div 
        className="flex items-center gap-2 p-2 rounded-lg"
        style={{ backgroundColor: `${info.color}10`, borderLeft: `3px solid ${info.color}` }}
      >
        <span className="text-lg">{info.icon}</span>
        <div>
          <div className="font-medium" style={{ color: info.color }}>
            {info.label} Connection
          </div>
          <div className="text-xs text-gray-500">
            {info.description}
          </div>
        </div>
      </div>

      {/* Warning for poor connection */}
      {needsAttention && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
          ⚠️ Sync may be delayed. Check your internet connection.
        </div>
      )}

      {/* Technical details */}
      {showDetails && (
        <div className="text-xs text-gray-500 space-y-1">
          <div>Strategy: <code className="bg-gray-100 px-1 rounded">{strategy}</code></div>
          {rtt !== null && <div>Latency: <code className="bg-gray-100 px-1 rounded">{rtt}ms</code></div>}
          <div>Drift: <code className="bg-gray-100 px-1 rounded">{Math.round(drift)}ms</code></div>
          {details.confidence !== undefined && (
            <div>Confidence: <code className="bg-gray-100 px-1 rounded">{Math.round(details.confidence * 100)}%</code></div>
          )}
        </div>
      )}
    </div>
  );
}

export default useConnectionQuality;
