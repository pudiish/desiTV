/**
 * MediaSessionManager.js
 * Enables background playback on mobile devices using the Media Session API
 * Similar to retrotv-org implementation
 */

class MediaSessionManager {
	constructor() {
		this.isSupported = 'mediaSession' in navigator
		this.currentMetadata = null
		this.playbackState = 'none' // none, paused, playing
		this.handlers = {
			play: null,
			pause: null,
			previoustrack: null,
			nexttrack: null,
			seekbackward: null,
			seekforward: null,
		}
	}

	/**
	 * Initialize Media Session with metadata and handlers
	 */
	init(metadata, handlers = {}) {
		if (!this.isSupported) {
			console.log('[MediaSession] Not supported on this device')
			return
		}

		this.currentMetadata = metadata
		this.updateMetadata(metadata)

		// Set up action handlers
		if (handlers.play) {
			this.handlers.play = handlers.play
			navigator.mediaSession.setActionHandler('play', () => {
				console.log('[MediaSession] Play action triggered')
				handlers.play()
			})
		}

		if (handlers.pause) {
			this.handlers.pause = handlers.pause
			navigator.mediaSession.setActionHandler('pause', () => {
				console.log('[MediaSession] Pause action triggered')
				handlers.pause()
			})
		}

		if (handlers.previoustrack) {
			this.handlers.previoustrack = handlers.previoustrack
			navigator.mediaSession.setActionHandler('previoustrack', () => {
				console.log('[MediaSession] Previous track action triggered')
				handlers.previoustrack()
			})
		}

		if (handlers.nexttrack) {
			this.handlers.nexttrack = handlers.nexttrack
			navigator.mediaSession.setActionHandler('nexttrack', () => {
				console.log('[MediaSession] Next track action triggered')
				handlers.nexttrack()
			})
		}

		if (handlers.seekbackward) {
			this.handlers.seekbackward = handlers.seekbackward
			navigator.mediaSession.setActionHandler('seekbackward', (details) => {
				console.log('[MediaSession] Seek backward action triggered', details)
				handlers.seekbackward(details)
			})
		}

		if (handlers.seekforward) {
			this.handlers.seekforward = handlers.seekforward
			navigator.mediaSession.setActionHandler('seekforward', (details) => {
				console.log('[MediaSession] Seek forward action triggered', details)
				handlers.seekforward(details)
			})
		}

		console.log('[MediaSession] Initialized with metadata and handlers')
	}

	/**
	 * Update media metadata (title, artist, album, artwork)
	 */
	updateMetadata(metadata) {
		if (!this.isSupported) return

		try {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: metadata.title || 'DesiTV',
				artist: metadata.artist || metadata.channelName || 'DesiTV Channel',
				album: metadata.album || 'Live TV',
				artwork: metadata.artwork || [
					{
						src: '/images/tv-badge.svg',
						sizes: '512x512',
						type: 'image/svg+xml',
					},
				],
			})
			this.currentMetadata = metadata
			console.log('[MediaSession] Metadata updated:', metadata.title)
		} catch (err) {
			console.error('[MediaSession] Error updating metadata:', err)
		}
	}

	/**
	 * Update playback state
	 */
	setPlaybackState(state) {
		if (!this.isSupported) return

		try {
			navigator.mediaSession.playbackState = state // 'none', 'paused', 'playing'
			this.playbackState = state
			console.log('[MediaSession] Playback state updated:', state)
		} catch (err) {
			console.error('[MediaSession] Error updating playback state:', err)
		}
	}

	/**
	 * Update position state (for seeking)
	 */
	setPositionState(state) {
		if (!this.isSupported) return

		try {
			if (state) {
				navigator.mediaSession.setPositionState({
					duration: state.duration || 0,
					playbackRate: state.playbackRate || 1.0,
					position: state.position || 0,
				})
			} else {
				// Clear position state
				navigator.mediaSession.setPositionState(null)
			}
		} catch (err) {
			console.error('[MediaSession] Error updating position state:', err)
		}
	}

	/**
	 * Clear all handlers and metadata
	 */
	clear() {
		if (!this.isSupported) return

		try {
			// Clear all action handlers
			navigator.mediaSession.setActionHandler('play', null)
			navigator.mediaSession.setActionHandler('pause', null)
			navigator.mediaSession.setActionHandler('previoustrack', null)
			navigator.mediaSession.setActionHandler('nexttrack', null)
			navigator.mediaSession.setActionHandler('seekbackward', null)
			navigator.mediaSession.setActionHandler('seekforward', null)

			// Clear metadata
			navigator.mediaSession.metadata = null
			this.currentMetadata = null
			this.playbackState = 'none'

			console.log('[MediaSession] Cleared')
		} catch (err) {
			console.error('[MediaSession] Error clearing:', err)
		}
	}
}

// Export singleton instance
const mediaSessionManager = new MediaSessionManager()
export default mediaSessionManager

