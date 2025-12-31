/**
 * LazyImage Component - Optimized Image Loading
 * 
 * Features:
 * - Lazy loading (only loads when visible)
 * - WebP support with fallback
 * - Intersection Observer for performance
 * - Placeholder support
 */

import React, { useState, useEffect, useRef } from 'react'

/** @typedef {Object} LazyImageProps
 * @property {string} src - Image source URL
 * @property {string} alt - Alt text
 * @property {string} [webpSrc] - WebP version (optional)
 * @property {string} [placeholder] - Placeholder image
 * @property {string} [className] - CSS class
 * @property {Object} [style] - Inline styles
 * @property {Function} [onLoad] - Load callback
 * @property {Function} [onError] - Error callback
 */

export default function LazyImage({
	src,
	alt,
	webpSrc,
	placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E',
	className = '',
	style = {},
	onLoad,
	onError,
}) {
	const [loaded, setLoaded] = useState(false)
	const [error, setError] = useState(false)
	const [inView, setInView] = useState(false)
	const imgRef = useRef<HTMLImageElement>(null)

	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setInView(true)
					observer.disconnect()
				}
			},
			{
				rootMargin: '50px', // Start loading 50px before visible
				threshold: 0.01,
			}
		)

		if (imgRef.current) {
			observer.observe(imgRef.current)
		}

		return () => {
			observer.disconnect()
		}
	}, [])

	const handleLoad = () => {
		setLoaded(true)
		if (onLoad) onLoad()
	}

	const handleError = () => {
		setError(true)
		if (onError) onError()
	}

	// Use WebP if available and supported, otherwise fallback to original
	const imageSrc = inView ? (webpSrc || src) : placeholder

	return (
		<picture>
			{webpSrc && inView && (
				<source srcSet={webpSrc} type="image/webp" />
			)}
			<img
				ref={imgRef}
				src={imageSrc}
				alt={alt}
				className={className}
				style={{
					...style,
					opacity: loaded ? 1 : 0,
					transition: 'opacity 0.3s ease-in-out',
					width: style.width || '100%',
					height: style.height || 'auto',
				}}
				loading="lazy"
				onLoad={handleLoad}
				onError={handleError}
				decoding="async"
			/>
		</picture>
	)
}

