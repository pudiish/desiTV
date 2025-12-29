/**
 * Sync Services Index
 * 
 * Netflix/Spotify-level sync architecture
 * 
 * Components:
 * 1. PredictiveEngine - Client-side position computation (90% API reduction)
 * 2. SSEClient - Server-Sent Events fallback (push-only)
 * 3. SyncOrchestrator - Master controller with auto-failover
 */

export { predictiveEngine, default as PredictiveEngine } from './PredictiveEngine';
export { sseClient, default as SSEClient } from './SSEClient';
export { default as SyncOrchestrator } from './SyncOrchestrator';
export * from './SyncOrchestrator';
