/**
 * 🎨✨ Mood-Based Color Service - ENHANCED EDITION
 * Beautiful holographic color palettes for immersive galaxy backgrounds
 * 
 * Features:
 * - 25+ stunning mood presets with gradient support
 * - Rich 7-color palettes for smoother transitions
 * - Particle style variations per mood
 * - Glow & shimmer effects
 * - Smart keyword detection (200+ Desi keywords)
 * - Works completely offline
 */

// 🌈 ENHANCED Holographic Presets - More colors, more beauty!
const MOOD_PRESETS = {
  
  // 💕 Romantic / Love Songs - Pink dreams & rose petals
  romantic: {
    name: '💕 Romantic Dreams',
    emoji: '💕',
    colors: [
      { r: 255, g: 105, b: 180 }, // Hot pink
      { r: 255, g: 182, b: 193 }, // Light pink
      { r: 255, g: 20, b: 147 },  // Deep pink
      { r: 219, g: 112, b: 147 }, // Pale violet red
      { r: 255, g: 192, b: 203 }, // Pink
      { r: 255, g: 0, b: 127 },   // Rose
      { r: 199, g: 21, b: 133 },  // Medium violet red
    ],
    gradient: ['#ff69b4', '#ff1493', '#c71585'],
    intensity: 0.85,
    particleStyle: 'hearts',
    glowColor: 'rgba(255, 105, 180, 0.3)',
    shimmer: true,
  },

  // 💔 Sad / Heartbreak - Melancholic blues
  melancholy: {
    name: '💔 Heartbreak Blues',
    emoji: '💔',
    colors: [
      { r: 70, g: 130, b: 180 },  // Steel blue
      { r: 100, g: 149, b: 237 }, // Cornflower blue
      { r: 123, g: 104, b: 238 }, // Medium slate blue
      { r: 72, g: 61, b: 139 },   // Dark slate blue
      { r: 106, g: 90, b: 205 },  // Slate blue
      { r: 65, g: 105, b: 225 },  // Royal blue
      { r: 138, g: 43, b: 226 },  // Blue violet
    ],
    gradient: ['#4682b4', '#6495ed', '#7b68ee'],
    intensity: 0.6,
    particleStyle: 'teardrops',
    glowColor: 'rgba(70, 130, 180, 0.25)',
    shimmer: false,
  },

  // 🎉 Party / Dance - Electric neon explosion
  energetic: {
    name: '🎉 Neon Party',
    emoji: '🎉',
    colors: [
      { r: 255, g: 0, b: 255 },   // Magenta
      { r: 0, g: 255, b: 255 },   // Cyan
      { r: 255, g: 255, b: 0 },   // Yellow
      { r: 255, g: 0, b: 128 },   // Deep pink
      { r: 0, g: 255, b: 128 },   // Spring green
      { r: 255, g: 128, b: 0 },   // Orange
      { r: 128, g: 0, b: 255 },   // Purple
    ],
    gradient: ['#ff00ff', '#00ffff', '#ffff00', '#ff0080'],
    intensity: 1.0,
    particleStyle: 'sparks',
    glowColor: 'rgba(255, 0, 255, 0.4)',
    shimmer: true,
    pulseSpeed: 1.5,
  },

  // 🌙 Chill / Lofi - Calm ocean nights
  chill: {
    name: '🌙 Midnight Lofi',
    emoji: '🌙',
    colors: [
      { r: 64, g: 224, b: 208 },  // Turquoise
      { r: 127, g: 255, b: 212 }, // Aquamarine
      { r: 100, g: 149, b: 237 }, // Cornflower
      { r: 72, g: 209, b: 204 },  // Medium turquoise
      { r: 32, g: 178, b: 170 },  // Light sea green
      { r: 0, g: 206, b: 209 },   // Dark turquoise
      { r: 95, g: 158, b: 160 },  // Cadet blue
    ],
    gradient: ['#40e0d0', '#7fffd4', '#20b2aa'],
    intensity: 0.5,
    particleStyle: 'bubbles',
    glowColor: 'rgba(64, 224, 208, 0.2)',
    shimmer: false,
    pulseSpeed: 0.3,
  },

  // 🙏 Devotional / Spiritual - Divine golden aura
  devotional: {
    name: '🙏 Divine Light',
    emoji: '🙏',
    colors: [
      { r: 255, g: 215, b: 0 },   // Gold
      { r: 255, g: 223, b: 186 }, // Navajo white
      { r: 255, g: 165, b: 0 },   // Orange
      { r: 255, g: 140, b: 0 },   // Dark orange
      { r: 255, g: 200, b: 100 }, // Light gold
      { r: 255, g: 180, b: 50 },  // Amber
      { r: 255, g: 248, b: 220 }, // Cornsilk
    ],
    gradient: ['#ffd700', '#ffa500', '#ffb347'],
    intensity: 0.75,
    particleStyle: 'diyas',
    glowColor: 'rgba(255, 215, 0, 0.35)',
    shimmer: true,
  },

  // 🎻 Classical / Traditional - Regal elegance
  classical: {
    name: '🎻 Royal Raga',
    emoji: '🎻',
    colors: [
      { r: 218, g: 165, b: 32 },  // Goldenrod
      { r: 184, g: 134, b: 11 },  // Dark goldenrod
      { r: 139, g: 90, b: 43 },   // Saddle brown light
      { r: 210, g: 105, b: 30 },  // Chocolate
      { r: 205, g: 133, b: 63 },  // Peru
      { r: 178, g: 34, b: 34 },   // Firebrick
      { r: 128, g: 0, b: 0 },     // Maroon
    ],
    gradient: ['#daa520', '#b8860b', '#8b4513'],
    intensity: 0.65,
    particleStyle: 'stars',
    glowColor: 'rgba(218, 165, 32, 0.25)',
    shimmer: false,
  },

  // 🎤 Hip Hop / Rap - Street neon purple
  hiphop: {
    name: '🎤 Street Glow',
    emoji: '🎤',
    colors: [
      { r: 255, g: 0, b: 100 },   // Neon pink
      { r: 138, g: 43, b: 226 },  // Blue violet
      { r: 75, g: 0, b: 130 },    // Indigo
      { r: 255, g: 215, b: 0 },   // Gold
      { r: 148, g: 0, b: 211 },   // Dark violet
      { r: 186, g: 85, b: 211 },  // Medium orchid
      { r: 255, g: 20, b: 147 },  // Deep pink
    ],
    gradient: ['#ff0064', '#8a2be2', '#4b0082', '#ffd700'],
    intensity: 0.95,
    particleStyle: 'sparks',
    glowColor: 'rgba(138, 43, 226, 0.4)',
    shimmer: true,
  },

  // 📼 Retro / 90s-2000s - Synthwave nostalgia
  retro: {
    name: '📼 Retro Wave',
    emoji: '📼',
    colors: [
      { r: 255, g: 20, b: 147 },  // Deep pink
      { r: 0, g: 191, b: 255 },   // Deep sky blue
      { r: 255, g: 105, b: 180 }, // Hot pink
      { r: 138, g: 43, b: 226 },  // Blue violet
      { r: 0, g: 255, b: 255 },   // Cyan
      { r: 255, g: 0, b: 255 },   // Magenta
      { r: 30, g: 144, b: 255 },  // Dodger blue
    ],
    gradient: ['#ff1493', '#00bfff', '#ff69b4', '#00ffff'],
    intensity: 0.9,
    particleStyle: 'grid',
    glowColor: 'rgba(255, 20, 147, 0.35)',
    shimmer: true,
    pulseSpeed: 0.8,
  },

  // 🕌 Sufi / Qawwali - Mystical green dargah
  sufi: {
    name: '🕌 Sufi Soul',
    emoji: '🕌',
    colors: [
      { r: 0, g: 128, b: 0 },     // Green
      { r: 34, g: 139, b: 34 },   // Forest green
      { r: 255, g: 255, b: 240 }, // Ivory
      { r: 50, g: 205, b: 50 },   // Lime green
      { r: 144, g: 238, b: 144 }, // Light green
      { r: 107, g: 142, b: 35 },  // Olive drab
      { r: 85, g: 107, b: 47 },   // Dark olive green
    ],
    gradient: ['#008000', '#228b22', '#32cd32'],
    intensity: 0.7,
    particleStyle: 'whirl',
    glowColor: 'rgba(34, 139, 34, 0.3)',
    shimmer: false,
  },

  // 💃 Bollywood Item Song - Maximum glam
  item: {
    name: '💃 Bollywood Blitz',
    emoji: '💃',
    colors: [
      { r: 255, g: 0, b: 0 },     // Red
      { r: 255, g: 215, b: 0 },   // Gold
      { r: 255, g: 0, b: 255 },   // Magenta
      { r: 0, g: 255, b: 0 },     // Lime
      { r: 255, g: 165, b: 0 },   // Orange
      { r: 255, g: 20, b: 147 },  // Deep pink
      { r: 0, g: 255, b: 255 },   // Cyan
    ],
    gradient: ['#ff0000', '#ffd700', '#ff00ff', '#00ff00'],
    intensity: 1.0,
    particleStyle: 'glitter',
    glowColor: 'rgba(255, 215, 0, 0.5)',
    shimmer: true,
    pulseSpeed: 2.0,
  },

  // 📜 Ghazal / Poetry - Moonlit silver
  ghazal: {
    name: '📜 Moonlit Shayari',
    emoji: '📜',
    colors: [
      { r: 192, g: 192, b: 192 }, // Silver
      { r: 176, g: 196, b: 222 }, // Light steel blue
      { r: 230, g: 230, b: 250 }, // Lavender
      { r: 216, g: 191, b: 216 }, // Thistle
      { r: 221, g: 160, b: 221 }, // Plum
      { r: 245, g: 245, b: 245 }, // White smoke
      { r: 211, g: 211, b: 211 }, // Light gray
    ],
    gradient: ['#c0c0c0', '#b0c4de', '#e6e6fa'],
    intensity: 0.55,
    particleStyle: 'mist',
    glowColor: 'rgba(192, 192, 192, 0.2)',
    shimmer: true,
  },

  // 🪕 Folk / Regional - Desi earth tones
  folk: {
    name: '🪕 Desi Rang',
    emoji: '🪕',
    colors: [
      { r: 255, g: 127, b: 80 },  // Coral
      { r: 255, g: 99, b: 71 },   // Tomato
      { r: 255, g: 215, b: 0 },   // Gold
      { r: 34, g: 139, b: 34 },   // Forest green
      { r: 255, g: 165, b: 0 },   // Orange
      { r: 255, g: 69, b: 0 },    // Orange red
      { r: 178, g: 34, b: 34 },   // Firebrick
    ],
    gradient: ['#ff7f50', '#ffd700', '#228b22', '#ff4500'],
    intensity: 0.8,
    particleStyle: 'confetti',
    glowColor: 'rgba(255, 127, 80, 0.3)',
    shimmer: true,
  },

  // 🎸 Indie / Alternative - Warm earthy sunset
  indie: {
    name: '🎸 Indie Sunset',
    emoji: '🎸',
    colors: [
      { r: 255, g: 218, b: 185 }, // Peach puff
      { r: 244, g: 164, b: 96 },  // Sandy brown
      { r: 210, g: 180, b: 140 }, // Tan
      { r: 255, g: 160, b: 122 }, // Light salmon
      { r: 250, g: 128, b: 114 }, // Salmon
      { r: 233, g: 150, b: 122 }, // Dark salmon
      { r: 255, g: 99, b: 71 },   // Tomato
    ],
    gradient: ['#ffdab9', '#f4a460', '#fa8072'],
    intensity: 0.65,
    particleStyle: 'dust',
    glowColor: 'rgba(244, 164, 96, 0.25)',
    shimmer: false,
  },

  // 🌌 Night / Lo-Fi - Deep space vibes
  night: {
    name: '🌌 Starlit Night',
    emoji: '🌌',
    colors: [
      { r: 25, g: 25, b: 112 },   // Midnight blue
      { r: 72, g: 61, b: 139 },   // Dark slate blue
      { r: 106, g: 90, b: 205 },  // Slate blue
      { r: 123, g: 104, b: 238 }, // Medium slate blue
      { r: 138, g: 43, b: 226 },  // Blue violet
      { r: 75, g: 0, b: 130 },    // Indigo
      { r: 48, g: 25, b: 52 },    // Dark purple
    ],
    gradient: ['#191970', '#483d8b', '#6a5acd'],
    intensity: 0.5,
    particleStyle: 'stars',
    glowColor: 'rgba(106, 90, 205, 0.2)',
    shimmer: true,
  },

  // 🌀 Psychedelic / Trippy - Full spectrum chaos
  trippy: {
    name: '🌀 Psychedelic',
    emoji: '🌀',
    colors: [
      { r: 255, g: 0, b: 255 },   // Magenta
      { r: 0, g: 255, b: 255 },   // Cyan
      { r: 255, g: 255, b: 0 },   // Yellow
      { r: 0, g: 255, b: 0 },     // Lime
      { r: 255, g: 0, b: 128 },   // Rose
      { r: 128, g: 0, b: 255 },   // Violet
      { r: 255, g: 128, b: 0 },   // Orange
    ],
    gradient: ['#ff00ff', '#00ffff', '#ffff00', '#00ff00', '#ff0080'],
    intensity: 1.0,
    particleStyle: 'spiral',
    glowColor: 'rgba(255, 0, 255, 0.5)',
    shimmer: true,
    pulseSpeed: 2.5,
  },

  // 🌧️ Monsoon / Rain - Petrichor blues
  monsoon: {
    name: '🌧️ Monsoon Magic',
    emoji: '🌧️',
    colors: [
      { r: 70, g: 130, b: 180 },  // Steel blue
      { r: 119, g: 136, b: 153 }, // Light slate gray
      { r: 47, g: 79, b: 79 },    // Dark slate gray
      { r: 95, g: 158, b: 160 },  // Cadet blue
      { r: 176, g: 196, b: 222 }, // Light steel blue
      { r: 112, g: 128, b: 144 }, // Slate gray
      { r: 173, g: 216, b: 230 }, // Light blue
    ],
    gradient: ['#4682b4', '#778899', '#b0c4de'],
    intensity: 0.6,
    particleStyle: 'rain',
    glowColor: 'rgba(70, 130, 180, 0.25)',
    shimmer: false,
  },

  // 💪 Workout / Gym - Beast mode fire
  workout: {
    name: '💪 Beast Mode',
    emoji: '💪',
    colors: [
      { r: 255, g: 0, b: 0 },     // Red
      { r: 255, g: 69, b: 0 },    // Orange red
      { r: 255, g: 140, b: 0 },   // Dark orange
      { r: 255, g: 165, b: 0 },   // Orange
      { r: 255, g: 215, b: 0 },   // Gold
      { r: 255, g: 99, b: 71 },   // Tomato
      { r: 220, g: 20, b: 60 },   // Crimson
    ],
    gradient: ['#ff0000', '#ff4500', '#ff8c00', '#ffd700'],
    intensity: 1.0,
    particleStyle: 'fire',
    glowColor: 'rgba(255, 69, 0, 0.45)',
    shimmer: true,
    pulseSpeed: 1.8,
  },

  // 🌊 Ocean / Beach - Tropical paradise
  ocean: {
    name: '🌊 Ocean Breeze',
    emoji: '🌊',
    colors: [
      { r: 0, g: 105, b: 148 },   // Deep ocean
      { r: 0, g: 168, b: 204 },   // Cerulean
      { r: 64, g: 224, b: 208 },  // Turquoise
      { r: 127, g: 255, b: 212 }, // Aquamarine
      { r: 0, g: 139, b: 139 },   // Dark cyan
      { r: 32, g: 178, b: 170 },  // Light sea green
      { r: 173, g: 216, b: 230 }, // Light blue
    ],
    gradient: ['#006994', '#00a8cc', '#40e0d0'],
    intensity: 0.7,
    particleStyle: 'waves',
    glowColor: 'rgba(0, 168, 204, 0.3)',
    shimmer: true,
  },

  // 🔥 Angry / Intense - Furious flames
  intense: {
    name: '🔥 Fury',
    emoji: '🔥',
    colors: [
      { r: 139, g: 0, b: 0 },     // Dark red
      { r: 178, g: 34, b: 34 },   // Firebrick
      { r: 220, g: 20, b: 60 },   // Crimson
      { r: 255, g: 0, b: 0 },     // Red
      { r: 255, g: 69, b: 0 },    // Orange red
      { r: 128, g: 0, b: 0 },     // Maroon
      { r: 255, g: 99, b: 71 },   // Tomato
    ],
    gradient: ['#8b0000', '#dc143c', '#ff4500'],
    intensity: 1.0,
    particleStyle: 'embers',
    glowColor: 'rgba(220, 20, 60, 0.45)',
    shimmer: false,
    pulseSpeed: 2.0,
  },

  // 🦋 Dreamy / Fantasy - Ethereal pastels
  dreamy: {
    name: '🦋 Dreamscape',
    emoji: '🦋',
    colors: [
      { r: 255, g: 182, b: 193 }, // Light pink
      { r: 230, g: 230, b: 250 }, // Lavender
      { r: 176, g: 224, b: 230 }, // Powder blue
      { r: 255, g: 218, b: 233 }, // Pink lace
      { r: 221, g: 160, b: 221 }, // Plum
      { r: 173, g: 216, b: 230 }, // Light blue
      { r: 216, g: 191, b: 216 }, // Thistle
    ],
    gradient: ['#ffb6c1', '#e6e6fa', '#b0e0e6', '#dda0dd'],
    intensity: 0.6,
    particleStyle: 'butterflies',
    glowColor: 'rgba(230, 230, 250, 0.3)',
    shimmer: true,
  },

  // 🏔️ Mountain / Nature - Earthy greens
  nature: {
    name: '🏔️ Mountain Mist',
    emoji: '🏔️',
    colors: [
      { r: 34, g: 139, b: 34 },   // Forest green
      { r: 85, g: 107, b: 47 },   // Dark olive
      { r: 107, g: 142, b: 35 },  // Olive drab
      { r: 144, g: 238, b: 144 }, // Light green
      { r: 143, g: 188, b: 143 }, // Dark sea green
      { r: 119, g: 136, b: 153 }, // Light slate gray
      { r: 112, g: 128, b: 144 }, // Slate gray
    ],
    gradient: ['#228b22', '#556b2f', '#90ee90'],
    intensity: 0.55,
    particleStyle: 'leaves',
    glowColor: 'rgba(34, 139, 34, 0.2)',
    shimmer: false,
  },

  // ⚡ Electric / EDM - Neon lightning
  electric: {
    name: '⚡ Electric Storm',
    emoji: '⚡',
    colors: [
      { r: 0, g: 255, b: 255 },   // Cyan
      { r: 0, g: 191, b: 255 },   // Deep sky blue
      { r: 30, g: 144, b: 255 },  // Dodger blue
      { r: 138, g: 43, b: 226 },  // Blue violet
      { r: 255, g: 255, b: 255 }, // White
      { r: 0, g: 0, b: 255 },     // Blue
      { r: 65, g: 105, b: 225 },  // Royal blue
    ],
    gradient: ['#00ffff', '#00bfff', '#8a2be2'],
    intensity: 1.0,
    particleStyle: 'lightning',
    glowColor: 'rgba(0, 255, 255, 0.5)',
    shimmer: true,
    pulseSpeed: 3.0,
  },

  // 🍁 Autumn / Nostalgic - Warm fall colors
  autumn: {
    name: '🍁 Autumn Gold',
    emoji: '🍁',
    colors: [
      { r: 255, g: 140, b: 0 },   // Dark orange
      { r: 255, g: 165, b: 0 },   // Orange
      { r: 178, g: 34, b: 34 },   // Firebrick
      { r: 139, g: 69, b: 19 },   // Saddle brown
      { r: 205, g: 133, b: 63 },  // Peru
      { r: 218, g: 165, b: 32 },  // Goldenrod
      { r: 210, g: 105, b: 30 },  // Chocolate
    ],
    gradient: ['#ff8c00', '#ffa500', '#b22222', '#d2691e'],
    intensity: 0.7,
    particleStyle: 'leaves',
    glowColor: 'rgba(255, 140, 0, 0.3)',
    shimmer: false,
  },

  // 🎪 Carnival / Mela - Festive riot
  carnival: {
    name: '🎪 Mela Magic',
    emoji: '🎪',
    colors: [
      { r: 255, g: 0, b: 0 },     // Red
      { r: 255, g: 255, b: 0 },   // Yellow
      { r: 0, g: 128, b: 0 },     // Green
      { r: 255, g: 165, b: 0 },   // Orange
      { r: 255, g: 20, b: 147 },  // Deep pink
      { r: 0, g: 0, b: 255 },     // Blue
      { r: 128, g: 0, b: 128 },   // Purple
    ],
    gradient: ['#ff0000', '#ffff00', '#008000', '#ff00ff'],
    intensity: 1.0,
    particleStyle: 'confetti',
    glowColor: 'rgba(255, 215, 0, 0.4)',
    shimmer: true,
    pulseSpeed: 1.2,
  },

  // 🌸 Spring / Fresh - Cherry blossoms
  spring: {
    name: '🌸 Cherry Blossom',
    emoji: '🌸',
    colors: [
      { r: 255, g: 183, b: 197 }, // Cherry pink
      { r: 255, g: 218, b: 233 }, // Pink lace
      { r: 255, g: 240, b: 245 }, // Lavender blush
      { r: 255, g: 192, b: 203 }, // Pink
      { r: 255, g: 105, b: 180 }, // Hot pink
      { r: 144, g: 238, b: 144 }, // Light green
      { r: 152, g: 251, b: 152 }, // Pale green
    ],
    gradient: ['#ffb7c5', '#ffc0cb', '#90ee90'],
    intensity: 0.65,
    particleStyle: 'petals',
    glowColor: 'rgba(255, 183, 197, 0.3)',
    shimmer: true,
  },

  // 🌅 Sunset / Dusk - Golden hour magic
  sunset: {
    name: '🌅 Golden Hour',
    emoji: '🌅',
    colors: [
      { r: 255, g: 99, b: 71 },   // Tomato
      { r: 255, g: 140, b: 0 },   // Dark orange
      { r: 255, g: 215, b: 0 },   // Gold
      { r: 255, g: 69, b: 0 },    // Orange red
      { r: 220, g: 20, b: 60 },   // Crimson
      { r: 75, g: 0, b: 130 },    // Indigo
      { r: 138, g: 43, b: 226 },  // Blue violet
    ],
    gradient: ['#ff6347', '#ff8c00', '#ffd700', '#4b0082'],
    intensity: 0.85,
    particleStyle: 'dust',
    glowColor: 'rgba(255, 140, 0, 0.35)',
    shimmer: true,
  },

  // ❄️ Winter / Snow - Icy blues
  winter: {
    name: '❄️ Frozen Dreams',
    emoji: '❄️',
    colors: [
      { r: 240, g: 248, b: 255 }, // Alice blue
      { r: 176, g: 224, b: 230 }, // Powder blue
      { r: 173, g: 216, b: 230 }, // Light blue
      { r: 135, g: 206, b: 235 }, // Sky blue
      { r: 135, g: 206, b: 250 }, // Light sky blue
      { r: 255, g: 255, b: 255 }, // White
      { r: 230, g: 230, b: 250 }, // Lavender
    ],
    gradient: ['#f0f8ff', '#b0e0e6', '#add8e6'],
    intensity: 0.5,
    particleStyle: 'snowflakes',
    glowColor: 'rgba(176, 224, 230, 0.25)',
    shimmer: true,
  },

  // ✨ Default / Cosmic - Universal beauty
  default: {
    name: '✨ Cosmic Flow',
    emoji: '✨',
    colors: [
      { r: 100, g: 100, b: 180 },
      { r: 150, g: 100, b: 200 },
      { r: 80, g: 120, b: 200 },
      { r: 120, g: 80, b: 160 },
      { r: 100, g: 150, b: 220 },
      { r: 138, g: 43, b: 226 },
      { r: 72, g: 61, b: 139 },
    ],
    gradient: ['#6464b4', '#9664c8', '#5078c8'],
    intensity: 0.7,
    particleStyle: 'stars',
    glowColor: 'rgba(100, 100, 180, 0.3)',
    shimmer: true,
  },
}

// 🔍 Enhanced Keyword patterns for mood detection (200+ keywords)
const MOOD_KEYWORDS = {
  romantic: [
    'love', 'pyaar', 'ishq', 'dil', 'heart', 'mohabbat', 'romantic', 
    'sanam', 'janam', 'jaan', 'baby', 'sweetheart', 'valentine',
    'teri', 'meri', 'tujhe', 'tumhe', 'tere', 'mere', 'pehli', 'nazar',
    'chahun', 'chahunga', 'tum hi ho', 'raabta', 'humsafar', 'pal',
    'soch', 'sochta', 'bahut', 'pyar', 'karta', 'karti',
  ],
  melancholy: [
    'sad', 'dukh', 'gam', 'judai', 'alone', 'broken', 'heartbreak',
    'cry', 'tears', 'rona', 'miss', 'yaad', 'bewafa', 'tanha',
    'dard', 'pain', 'aashiqui', 'lost', 'alvida', 'aansu', 'toot',
    'kho gaya', 'rula', 'tadap', 'intezaar', 'judaai', 'bichhad',
    'chhor', 'chhod', 'bhula', 'bhool', 'dil toot',
  ],
  energetic: [
    'party', 'dance', 'dj', 'remix', 'beat', 'club', 'nachna',
    'crazy', 'pagal', 'wild', 'bass', 'drop', 'edm', 'dhol',
    'bhangra', 'garba', 'wedding', 'shaadi', 'sangeet', 'celebrate',
    'nashe', 'kar gayi', 'chull', 'patola', 'nakhra', 'swag',
    'balle', 'shava', 'whistle', 'disco', 'paisa', 'khullam',
  ],
  chill: [
    'chill', 'relax', 'lofi', 'acoustic', 'unplugged', 'soft',
    'calm', 'peaceful', 'soothing', 'sleep', 'sukoon', 'chain',
    'aram', 'neend', 'sapna', 'dream', 'slow', 'easy', 'gentle',
    'quiet', 'serene', 'meditation', 'zen', 'mindful',
  ],
  devotional: [
    'bhajan', 'aarti', 'mantra', 'god', 'bhagwan', 'devi', 'krishna',
    'shiv', 'ganesh', 'ram', 'hanuman', 'spiritual', 'prayer', 'temple',
    'puja', 'darshan', 'jai', 'om', 'mata', 'durga', 'lakshmi',
    'saraswati', 'mahadev', 'bholenath', 'govinda', 'radhe', 'sai',
  ],
  classical: [
    'classical', 'raag', 'taal', 'raga', 'hindustani', 'carnatic',
    'tabla', 'sitar', 'sarod', 'flute', 'bansuri', 'santoor',
    'ghazal', 'thumri', 'dhrupad', 'khayal', 'bandish', 'jugalbandi',
  ],
  hiphop: [
    'rap', 'hiphop', 'hip hop', 'diss', 'freestyle', 'bars',
    'divine', 'emiway', 'raftaar', 'yo yo', 'badshah', 'ikka',
    'muhfaad', 'seedhe', 'maut', 'krsna', 'karma', 'young',
    'hustler', 'flow', 'beat', 'mic', 'spit', 'verse',
  ],
  retro: [
    'retro', '90s', '80s', '2000s', 'old', 'purana', 'classic',
    'evergreen', 'golden', 'vintage', 'nostalgia', 'throwback',
    'purani', 'yaadein', 'school', 'college', 'bachpan', 'zamana',
  ],
  sufi: [
    'sufi', 'qawwali', 'nusrat', 'kalam', 'bulleh', 'rumi',
    'dargah', 'khwaja', 'naat', 'hamd', 'maula', 'allah',
    'peer', 'fakir', 'ishq', 'sufiyana', 'rooh', 'murshid',
  ],
  item: [
    'item', 'mujra', 'cabaret', 'lavani', 'hot', 'sexy',
    'munni', 'sheila', 'chikni', 'chameli', 'fevicol', 'bijli',
    'badnaam', 'laila', 'anarkali', 'teri aakhya', 'patli', 'kamar',
  ],
  ghazal: [
    'ghazal', 'shayari', 'poetry', 'jagjit', 'mehdi', 'gazal',
    'nazm', 'mushaira', 'sher', 'kavita', 'alfaaz', 'lamha',
  ],
  folk: [
    'folk', 'punjabi', 'bhojpuri', 'haryanvi', 'rajasthani',
    'marathi', 'gujarati', 'bengali', 'traditional', 'desi',
    'ghoomar', 'chhath', 'holi', 'diwali', 'lohri', 'baisakhi',
    'navratri', 'bihu', 'pongal',
  ],
  indie: [
    'indie', 'independent', 'prateek', 'kuhad', 'anuv', 'jain',
    'when chai met toast', 'local train', 'lucky ali', 'original',
    'underground', 'alternative', 'soulful',
  ],
  trippy: [
    'trippy', 'psychedelic', 'trance', 'high', '420', 'stoner',
    'vibe', 'trip', 'altered', 'cosmic', 'galaxy', 'space',
    'hallucination', 'dreamy', 'surreal', 'abstract',
  ],
  monsoon: [
    'rain', 'baarish', 'monsoon', 'barsat', 'rim jhim',
    'tip tip', 'sawan', 'mausam', 'bheege', 'geeli', 'badal',
    'pani', 'boond', 'drizzle', 'storm',
  ],
  workout: [
    'workout', 'gym', 'pump', 'motivation', 'beast', 'fitness',
    'exercise', 'running', 'cardio', 'power', 'strength', 'strong',
    'gains', 'grind', 'hustle', 'train', 'energy',
  ],
  ocean: [
    'ocean', 'sea', 'beach', 'wave', 'samundar', 'saagar',
    'kinara', 'shore', 'sail', 'boat', 'island', 'tropical',
  ],
  intense: [
    'angry', 'gussa', 'rage', 'fight', 'war', 'battle',
    'revenge', 'badla', 'danger', 'aggressive', 'fierce',
  ],
  dreamy: [
    'dream', 'sapna', 'fantasy', 'fairy', 'magic', 'wonder',
    'imagination', 'floating', 'cloud', 'heaven', 'angel',
  ],
  nature: [
    'mountain', 'pahad', 'river', 'nadi', 'forest', 'jungle',
    'tree', 'flower', 'phool', 'garden', 'nature', 'earth',
  ],
  electric: [
    'edm', 'electronic', 'techno', 'house', 'dubstep', 'rave',
    'synth', 'synthesizer', 'electronica', 'bass drop',
  ],
  autumn: [
    'autumn', 'fall', 'october', 'november', 'harvest', 'leaves',
    'patta', 'patjhad',
  ],
  carnival: [
    'mela', 'fair', 'carnival', 'circus', 'festival', 'tyohar',
    'celebration', 'jashn', 'utsav', 'tamasha',
  ],
  spring: [
    'spring', 'bloom', 'flower', 'basant', 'holi', 'rangon',
    'fresh', 'new', 'nayi', 'beginning', 'shuruat',
  ],
  sunset: [
    'sunset', 'sunrise', 'evening', 'shaam', 'dopahar', 'twilight',
    'dusk', 'dawn', 'subah', 'golden hour',
  ],
  winter: [
    'winter', 'snow', 'barf', 'cold', 'thand', 'december',
    'christmas', 'frozen', 'ice', 'sardi',
  ],
  night: [
    'night', 'raat', 'midnight', 'aadhi raat', 'late', 'dark',
    'moon', 'chand', 'stars', 'tare', 'neend', 'jagana',
  ],
}

/**
 * 🎨 Mood Color Service Class
 */
class MoodColorService {
  constructor() {
    this.currentMood = 'default'
    this.currentPreset = MOOD_PRESETS.default
    this.cache = new Map()
    this.listeners = new Set()
    this.transitionProgress = 1
    this.previousColors = null
  }

  /**
   * Subscribe to mood changes
   */
  subscribe(callback) {
    this.listeners.add(callback)
    callback(this.currentPreset, this.currentMood)
    return () => this.listeners.delete(callback)
  }

  /**
   * Notify all listeners
   */
  _notifyListeners() {
    this.listeners.forEach(cb => {
      try {
        cb(this.currentPreset, this.currentMood)
      } catch (e) {
        console.warn('[MoodColor] Listener error:', e)
      }
    })
  }

  /**
   * Detect mood from video title using smart keyword matching
   */
  detectMoodFromTitle(title) {
    if (!title) return 'default'
    
    const lowerTitle = title.toLowerCase()
    let bestMood = 'default'
    let bestScore = 0

    for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
      let score = 0
      for (const keyword of keywords) {
        if (lowerTitle.includes(keyword)) {
          // Longer keywords = more specific = higher score
          score += keyword.length * (keyword.includes(' ') ? 2 : 1)
        }
      }
      if (score > bestScore) {
        bestScore = score
        bestMood = mood
      }
    }

    return bestMood
  }

  /**
   * Main method: Set mood from video info
   */
  async setMoodFromVideo(videoId, videoTitle, channelName = '') {
    // Check cache first
    const cacheKey = `${videoId}-${videoTitle}`
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      this.currentMood = cached.mood
      this.currentPreset = cached.preset
      this._notifyListeners()
      return cached
    }

    // Store previous colors for transition
    this.previousColors = this.currentPreset.colors

    // Detect mood from title keywords
    let mood = this.detectMoodFromTitle(videoTitle)
    
    // Also check channel name for hints
    if (mood === 'default' && channelName) {
      const channelMood = this.detectMoodFromTitle(channelName)
      if (channelMood !== 'default') {
        mood = channelMood
      }
    }

    const preset = MOOD_PRESETS[mood] || MOOD_PRESETS.default
    
    // Cache the result
    this.cache.set(cacheKey, { mood, preset })
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.currentMood = mood
    this.currentPreset = preset
    this.transitionProgress = 0
    this._notifyListeners()

    console.log(`[MoodColor] ${preset.emoji} Mood: ${mood} → ${preset.name}`)
    return { mood, preset }
  }

  /**
   * Get current colors for Galaxy (with 7 colors!)
   */
  getColors() {
    return this.currentPreset.colors
  }

  /**
   * Get gradient CSS string
   */
  getGradientCSS() {
    return `linear-gradient(135deg, ${this.currentPreset.gradient.join(', ')})`
  }

  /**
   * Get current intensity
   */
  getIntensity() {
    return this.currentPreset.intensity
  }

  /**
   * Get particle style for this mood
   */
  getParticleStyle() {
    return this.currentPreset.particleStyle || 'stars'
  }

  /**
   * Get glow color
   */
  getGlowColor() {
    return this.currentPreset.glowColor
  }

  /**
   * Check if shimmer effect is enabled
   */
  hasShimmer() {
    return this.currentPreset.shimmer || false
  }

  /**
   * Get pulse speed multiplier
   */
  getPulseSpeed() {
    return this.currentPreset.pulseSpeed || 1.0
  }

  /**
   * Get mood info with all details
   */
  getMoodInfo() {
    return {
      mood: this.currentMood,
      name: this.currentPreset.name,
      emoji: this.currentPreset.emoji,
      intensity: this.currentPreset.intensity,
      particleStyle: this.currentPreset.particleStyle,
      shimmer: this.currentPreset.shimmer,
      pulseSpeed: this.currentPreset.pulseSpeed || 1.0,
    }
  }

  /**
   * Manually set mood (for user override)
   */
  setMood(moodName) {
    if (MOOD_PRESETS[moodName]) {
      this.previousColors = this.currentPreset.colors
      this.currentMood = moodName
      this.currentPreset = MOOD_PRESETS[moodName]
      this.transitionProgress = 0
      this._notifyListeners()
      console.log(`[MoodColor] ${this.currentPreset.emoji} Manual: ${this.currentPreset.name}`)
      return true
    }
    return false
  }

  /**
   * Get all available moods for UI
   */
  getAvailableMoods() {
    return Object.entries(MOOD_PRESETS).map(([key, value]) => ({
      id: key,
      name: value.name,
      emoji: value.emoji,
      intensity: value.intensity,
      gradient: value.gradient,
    }))
  }

  /**
   * Get random mood (for shuffle feature)
   */
  setRandomMood() {
    const moods = Object.keys(MOOD_PRESETS).filter(m => m !== 'default')
    const randomMood = moods[Math.floor(Math.random() * moods.length)]
    return this.setMood(randomMood)
  }
}

// Singleton export
export const moodColorService = new MoodColorService()
export { MOOD_PRESETS, MOOD_KEYWORDS }
export default moodColorService
