import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Error tracking removed - not needed for core functionality

// Suppress all console logs in production
if (typeof window !== 'undefined') {
	const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production'
	
	// In production, suppress all console.log, console.info, console.debug
	if (isProduction) {
		console.log = () => {}
		console.info = () => {}
		console.debug = () => {}
	}
	
	// Suppress runtime.lastError from browser extensions (both dev and prod)
	const originalError = console.error
	console.error = (...args) => {
		const message = args.join(' ')
		// Suppress browser extension errors
		if (
			message.includes('runtime.lastError') ||
			message.includes('Could not establish connection') ||
			message.includes('Receiving end does not exist') ||
			message.includes('content-script') ||
			message.includes('AdUnit')
		) {
			return // Suppress these harmless extension errors
		}
		originalError.apply(console, args)
	}

	// Suppress extension warnings
	const originalWarn = console.warn
	console.warn = (...args) => {
		const message = args.join(' ')
		if (
			message.includes('runtime.lastError') ||
			message.includes('content-script') ||
			message.includes('AdUnit')
		) {
			return
		}
		originalWarn.apply(console, args)
	}
}

// Preload YouTube iframe API to prevent 404 errors
const loadYouTubeAPI = () => {
	if (window.YT && window.YT.Player) {
		console.log('[YouTube API] Already loaded')
		return Promise.resolve()
	}

	return new Promise((resolve) => {
		const tag = document.createElement('script')
		tag.src = 'https://www.youtube.com/iframe_api'
		tag.async = true
		tag.onload = () => {
			console.log('[YouTube API] Successfully loaded')
			resolve()
		}
		tag.onerror = () => {
			console.warn('[YouTube API] Failed to load, will retry on demand')
			resolve() // Don't block app startup
		}
		document.body.appendChild(tag)
	})
}

// Load YouTube API before mounting React
loadYouTubeAPI().then(() => {
	createRoot(document.getElementById('root')).render(
	  <React.StrictMode>
	    <App />
	  </React.StrictMode>
	)
})

