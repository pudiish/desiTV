/**
 * Color extraction utility for YouTube videos
 * Extracts dominant colors from video thumbnails and converts them to galaxy parameters
 */

/**
 * Extract dominant color from an image URL
 * Uses canvas to sample pixels and find the most vibrant color
 */
export async function extractDominantColor(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imageData.data
        
        // Sample pixels in a grid pattern for performance
        const sampleRate = 10 // Sample every 10th pixel
        const colors = []
        
        for (let i = 0; i < pixels.length; i += sampleRate * 4) {
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          const a = pixels[i + 3]
          
          // Skip transparent pixels
          if (a < 128) continue
          
          // Calculate saturation and brightness
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const saturation = max === 0 ? 0 : (max - min) / max
          const brightness = max / 255
          
          // Prefer vibrant colors (high saturation and medium-high brightness)
          if (saturation > 0.3 && brightness > 0.2 && brightness < 0.95) {
            colors.push({ r, g, b, saturation, brightness })
          }
        }
        
        if (colors.length === 0) {
          // Fallback: use average color
          let rSum = 0, gSum = 0, bSum = 0, count = 0
          for (let i = 0; i < pixels.length; i += 100 * 4) {
            rSum += pixels[i]
            gSum += pixels[i + 1]
            bSum += pixels[i + 2]
            count++
          }
          resolve({
            r: Math.round(rSum / count),
            g: Math.round(gSum / count),
            b: Math.round(bSum / count)
          })
          return
        }
        
        // Sort by saturation * brightness (vibrant colors first)
        colors.sort((a, b) => (b.saturation * b.brightness) - (a.saturation * a.brightness))
        
        // Get the most vibrant color
        const dominant = colors[0]
        resolve({
          r: dominant.r,
          g: dominant.g,
          b: dominant.b
        })
      } catch (err) {
        console.error('[ColorExtractor] Error extracting color:', err)
        reject(err)
      }
    }
    
    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }
    
    img.src = imageUrl
  })
}

/**
 * Convert RGB color to HSL
 */
export function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  
  if (max === min) {
    h = s = 0 // achromatic
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
      default: h = 0
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

/**
 * Get YouTube thumbnail URL for a video ID
 */
export function getYouTubeThumbnail(videoId, quality = 'maxresdefault') {
  return `https:// img.youtube.com/vi/${videoId}/${quality}.jpg`
}

/**
 * Extract color from YouTube video and convert to galaxy parameters
 */
export async function extractVideoColor(videoId) {
  try {
    const thumbnailUrl = getYouTubeThumbnail(videoId)
    const rgb = await extractDominantColor(thumbnailUrl)
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
    
    // Convert to galaxy-friendly parameters
    // hueShift: 0-360 (hue angle)
    // saturation: 0-1 (multiplier for star saturation)
    // hueShift is already in degrees, so we can use it directly
    
    return {
      hueShift: hsl.h,
      saturation: Math.min(hsl.s / 100, 1.0), // Normalize to 0-1
      rgb: rgb,
      hsl: hsl
    }
  } catch (err) {
    console.error('[ColorExtractor] Error extracting video color:', err)
    // Return default warm amber colors
    return {
      hueShift: 30,
      saturation: 0.6,
      rgb: { r: 184, g: 149, b: 106 },
      hsl: { h: 30, s: 40, l: 57 }
    }
  }
}

/**
 * Smoothly interpolate between two color sets
 */
export function interpolateColors(color1, color2, factor) {
  factor = Math.max(0, Math.min(1, factor)) // Clamp between 0 and 1
  
  return {
    hueShift: Math.round(color1.hueShift + (color2.hueShift - color1.hueShift) * factor),
    saturation: color1.saturation + (color2.saturation - color1.saturation) * factor
  }
}

