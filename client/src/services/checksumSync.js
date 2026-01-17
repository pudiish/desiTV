/**
 * Version Sync Service - Smart JSON Version Check with Caching
 * 
 * Source of Truth: channels.json version number
 * - Checks JSON version periodically (non-blocking)
 * - Uses localStorage cache to avoid unnecessary reloads
 * - Smooth, silent updates without user disruption
 * - Works offline (JSON is static, cached locally)
 */

import { channelManager } from '../logic/channel'

const VERSION_CACHE_KEY = 'desitv-channels-version'
const VERSION_CHECK_INTERVAL = 60 * 1000 // Check every 60 seconds (reduced frequency for smoothness)

class VersionSyncService {
	constructor() {
		this.syncInterval = null
		this.isChecking = false
		this.lastKnownVersion = this.getCachedVersion()
	}

	/**
	 * Get cached version from localStorage
	 */
	getCachedVersion() {
		try {
			const cached = localStorage.getItem(VERSION_CACHE_KEY)
			return cached ? JSON.parse(cached).version : null
		} catch {
			return null
		}
	}

	/**
	 * Cache version in localStorage
	 */
	setCachedVersion(version) {
		try {
			localStorage.setItem(VERSION_CACHE_KEY, JSON.stringify({
				version,
				timestamp: Date.now()
			}))
		} catch {
			// Ignore localStorage errors (private browsing, quota exceeded)
		}
	}

	/**
	 * Start periodic version check (non-blocking, smooth)
	 */
	start() {
		if (this.syncInterval) return

		console.log('[VersionSync] Starting smart version check (every 60s, cached)...')
		
		// Check version periodically (non-blocking)
		this.syncInterval = setInterval(() => {
			this.checkVersionSilently()
		}, VERSION_CHECK_INTERVAL)

		// Initial check after 10 seconds (let app load first)
		setTimeout(() => this.checkVersionSilently(), 10000)
	}
	
	/**
	 * Force immediate version check (for critical moments)
	 * Non-blocking - doesn't wait for reload
	 */
	async forceSync() {
		// Fire and forget - don't block
		this.checkVersionSilently().catch(() => {
			// Silent fail - version check is non-critical
		})
	}

	/**
	 * Stop periodic version check
	 */
	stop() {
		if (this.syncInterval) {
			clearInterval(this.syncInterval)
			this.syncInterval = null
		}
	}

	/**
	 * Check JSON version silently (non-blocking, smooth)
	 * Only reloads if version actually changed
	 */
	async checkVersionSilently() {
		// Skip if already checking
		if (this.isChecking) return
		
		this.isChecking = true

		try {
			// Fetch with cache-busting but use cached version first for comparison
			const response = await fetch('/data/channels.json?t=' + Date.now(), {
				cache: 'no-cache' // Always check fresh version
			})
			
			if (!response.ok) {
				return // JSON not available, keep using cached
			}

			const data = await response.json()
			const currentVersion = data.version || data.generatedAt

			if (!currentVersion) {
				return // No version info, skip
			}

			// Compare with last known version (from memory or cache)
			if (this.lastKnownVersion && this.lastKnownVersion !== currentVersion) {
				console.log('[VersionSync] 📺 Channels updated (version changed), reloading silently...')
				
				// Reload channels in background (non-blocking)
				channelManager.reload().then(() => {
					console.log('[VersionSync] ✅ Channels reloaded smoothly')
				}).catch(err => {
					console.warn('[VersionSync] Reload failed (non-critical):', err)
				})
			}

			// Update cached version
			this.lastKnownVersion = currentVersion
			this.setCachedVersion(currentVersion)
		} catch (err) {
			// Silent fail - version check is non-critical, app continues working
			console.debug('[VersionSync] Version check failed (non-critical):', err.message)
		} finally {
			this.isChecking = false
		}
	}
}

// Singleton instance
export const checksumSyncService = new VersionSyncService()
// Keep old name for backward compatibility
export const versionSyncService = checksumSyncService

