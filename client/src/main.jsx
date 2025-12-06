import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

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

