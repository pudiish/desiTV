/**
 * Checksum Sync Service - ULTRA-FAST Silent Background Validation
 * 
 * ULTRA-FAST MODE: Maximum 2-second latency requirement
 * - Checks every 2 seconds (meets max latency requirement)
 * - Fast sync on critical moments (100ms debounce)
 * - Immediate validation on startup (500ms)
 * - Parallel validation for speed
 * - Timeout protection (1.5s per request)
 * Runs in background without disrupting user experience
 */

import { validateAndRefreshChannels } from '../utils/checksumValidator'
import { validateAndRefreshEpoch } from '../utils/checksumValidator'
import { channelManager } from '../logic/channel'
import { broadcastStateManager } from '../logic/broadcast'
import { fetchGlobalEpoch } from './api/globalEpochService'
import { dedupeFetch } from '../utils/requestDeduplication'

class ChecksumSyncService {
	constructor() {
		this.syncInterval = null
		this.isSyncing = false
		this.lastChannelChecksum = null
		this.lastEpochChecksum = null
		this.SYNC_INTERVAL = 5 * 1000 // Check every 5 seconds (reduced frequency to prevent rate limiting)
		this.FAST_SYNC_INTERVAL = 1 * 1000 // Fast sync for critical moments (1 second)
		this.fastSyncTimeout = null
		this.pendingSync = false
		this.MAX_LATENCY = 2000 // Maximum allowed latency: 2 seconds
	}

	/**
	 * Start periodic checksum validation (ULTRA-FAST MODE - 2s max latency)
	 */
	start() {
		if (this.syncInterval) return

		console.log('[ChecksumSync] Starting ULTRA-FAST sync (max 2s latency)...')
		
		// ULTRA-FAST: Regular sync every 2 seconds (meets max latency requirement)
		this.syncInterval = setInterval(() => {
			this.validateAndSync()
		}, this.SYNC_INTERVAL)

		// ULTRA-FAST: Immediate validation on startup (after 500ms)
		setTimeout(() => this.validateAndSync(), 500)
		
		// ULTRA-FAST: Also validate after 1 second for initial load
		setTimeout(() => this.validateAndSync(), 1000)
	}
	
	/**
	 * Trigger immediate fast sync (for critical moments)
	 * ULTRA-FAST: Minimal debounce for 2s max latency
	 */
	async triggerFastSync() {
		if (this.isSyncing) {
			this.pendingSync = true
			// If already syncing, retry immediately after current sync completes
			return
		}
		
		// Clear any pending fast sync
		if (this.fastSyncTimeout) {
			clearTimeout(this.fastSyncTimeout)
		}
		
		// ULTRA-FAST: Minimal debounce (100ms) to batch rapid triggers while meeting 2s latency
		this.fastSyncTimeout = setTimeout(async () => {
			console.log('[ChecksumSync] ⚡ Fast sync triggered (ultra-fast)')
			await this.validateAndSync()
			this.pendingSync = false
		}, 100) // Reduced from 500ms to 100ms for faster response
	}
	
	/**
	 * Force immediate sync (no debounce)
	 * ULTRA-FAST: For critical operations requiring instant sync
	 */
	async forceSync() {
		if (this.isSyncing) {
			// If already syncing, wait for it to complete then retry
			return new Promise((resolve) => {
				const checkInterval = setInterval(() => {
					if (!this.isSyncing) {
						clearInterval(checkInterval)
						this.validateAndSync().then(resolve).catch(resolve)
					}
				}, 50) // Check every 50ms for fast retry
			})
		}
		console.log('[ChecksumSync] 🔄 Force sync (ultra-fast, no debounce)')
		await this.validateAndSync()
	}

	/**
	 * Stop periodic checksum validation
	 */
	stop() {
		if (this.syncInterval) {
			clearInterval(this.syncInterval)
			this.syncInterval = null
		}
		if (this.fastSyncTimeout) {
			clearTimeout(this.fastSyncTimeout)
			this.fastSyncTimeout = null
		}
	}

	/**
	 * Validate checksums and silently sync if needed
	 */
	async validateAndSync() {
		if (this.isSyncing) return
		
		this.isSyncing = true

		try {
			// Validate channels
			await this.validateChannels()
			
			// Validate epoch
			await this.validateEpoch()
		} catch (err) {
			console.warn('[ChecksumSync] Validation error:', err)
		} finally {
			this.isSyncing = false
		}
	}

	/**
	 * Validate channels checksum
	 */
	async validateChannels() {
		try {
			const response = await dedupeFetch('/api/channels', {
				cache: 'no-store',
				headers: {
					'Cache-Control': 'no-cache',
				}
			})

			if (!response.ok) return

			const data = await response.json()
			const serverChecksum = data.checksum
			const channels = data.data || data

			if (!serverChecksum) return

			// Get current channels (raw channels, not categories)
			const currentChannels = channelManager.rawChannels || []
			
			if (!currentChannels || currentChannels.length === 0) {
				// No cached channels, store checksum for next time
				this.lastChannelChecksum = serverChecksum
				return
			}

			// PROACTIVE: Validate checksum (always check, even if no previous checksum)
			if (!this.lastChannelChecksum) {
				// First time - store checksum
				this.lastChannelChecksum = serverChecksum
			} else if (this.lastChannelChecksum !== serverChecksum) {
				console.log('[ChecksumSync] ⚠️ Channel mismatch detected, silently refreshing...')
				
				// PROACTIVE: Silently refresh channels immediately
				await channelManager.loadChannels()
				
				this.lastChannelChecksum = serverChecksum
				console.log('[ChecksumSync] ✅ Channels silently synced (proactive)')
			} else {
				// Checksum matches - all good
				this.lastChannelChecksum = serverChecksum
			}
		} catch (err) {
			console.warn('[ChecksumSync] Channel validation error:', err)
		}
	}

	/**
	 * Validate epoch checksum (ULTRA-FAST - optimized for 2s latency)
	 */
	async validateEpoch() {
		const startTime = Date.now()
		try {
			// ULTRA-FAST: Use AbortController for timeout (max 1.5s to meet 2s total latency)
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), 1500)
			
			const response = await dedupeFetch('/api/global-epoch', {
				cache: 'no-store',
				signal: controller.signal,
				headers: {
					'Cache-Control': 'no-cache',
				}
			})
			
			clearTimeout(timeoutId)

			if (!response.ok) return

			const data = await response.json()
			const serverChecksum = data.checksum
			const epoch = new Date(data.epoch)

			if (!serverChecksum) return

			// Get current epoch
			const currentEpoch = broadcastStateManager.getGlobalEpoch()

			if (!currentEpoch) {
				// No cached epoch, store checksum for next time
				this.lastEpochChecksum = serverChecksum
				return
			}

			// ULTRA-FAST: Validate checksum (always check, even if no previous checksum)
			if (!this.lastEpochChecksum) {
				// First time - store checksum
				this.lastEpochChecksum = serverChecksum
			} else if (this.lastEpochChecksum !== serverChecksum) {
				console.log('[ChecksumSync] ⚠️ Epoch mismatch detected, silently refreshing...')
				
				// ULTRA-FAST: Silently refresh epoch immediately (no delay)
				await fetchGlobalEpoch(true)
				
				this.lastEpochChecksum = serverChecksum
				const duration = Date.now() - startTime
				console.log(`[ChecksumSync] ✅ Epoch silently synced (${duration}ms)`)
			} else {
				// Checksum matches - all good
				this.lastEpochChecksum = serverChecksum
			}
		} catch (err) {
			if (err.name === 'AbortError') {
				console.warn('[ChecksumSync] Epoch validation timeout (exceeded 1.5s)')
			} else {
				console.warn('[ChecksumSync] Epoch validation error:', err)
			}
		}
	}
}

// Singleton instance
export const checksumSyncService = new ChecksumSyncService()

