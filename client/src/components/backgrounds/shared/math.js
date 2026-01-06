/**
 * Shared Math Utilities
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * High-performance math functions used across all background effects.
 * These are pure functions with zero side effects for optimal performance.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
export const PHI = 1.618033988749895      // Golden Ratio
export const TAU = 6.283185307179586      // 2π - Full circle
export const PI = 3.141592653589793       // π
export const HALF_PI = 1.5707963267948966 // π/2
export const DEG_TO_RAD = 0.017453292519943295  // π/180
export const RAD_TO_DEG = 57.29577951308232     // 180/π

// ═══════════════════════════════════════════════════════════════════════════════
// INTERPOLATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Linear interpolation between two values
 * @param {number} a - Start value
 * @param {number} b - End value  
 * @param {number} t - Progress (0-1)
 */
export const lerp = (a, b, t) => a + (b - a) * t

/**
 * Inverse lerp - find t given value between a and b
 */
export const inverseLerp = (a, b, v) => (v - a) / (b - a)

/**
 * Remap value from one range to another
 */
export const remap = (value, inMin, inMax, outMin, outMax) => 
  outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin)

/**
 * Clamp value between min and max
 */
export const clamp = (value, min, max) => 
  value < min ? min : value > max ? max : value

/**
 * Clamp between 0 and 1
 */
export const clamp01 = (value) => 
  value < 0 ? 0 : value > 1 ? 1 : value

// ═══════════════════════════════════════════════════════════════════════════════
// EASING FUNCTIONS (Pre-computed coefficients for performance)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Smoothstep - Hermite interpolation
 */
export const smoothstep = (x) => x * x * (3 - 2 * x)

/**
 * Smootherstep - Ken Perlin's improved version
 */
export const smootherstep = (x) => x * x * x * (x * (6 * x - 15) + 10)

/**
 * Ease in quadratic
 */
export const easeInQuad = (x) => x * x

/**
 * Ease out quadratic
 */
export const easeOutQuad = (x) => 1 - (1 - x) * (1 - x)

/**
 * Ease in-out quadratic
 */
export const easeInOutQuad = (x) => 
  x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) * (-2 * x + 2) * 0.5

/**
 * Ease in cubic
 */
export const easeInCubic = (x) => x * x * x

/**
 * Ease out cubic
 */
export const easeOutCubic = (x) => 1 - (1 - x) * (1 - x) * (1 - x)

/**
 * Ease in-out cubic
 */
export const easeInOutCubic = (x) => 
  x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) * (-2 * x + 2) * (-2 * x + 2) * 0.5

/**
 * Ease out quart
 */
export const easeOutQuart = (x) => {
  const t = 1 - x
  return 1 - t * t * t * t
}

/**
 * Ease out elastic
 */
export const easeOutElastic = (x) => {
  if (x === 0 || x === 1) return x
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOISE FUNCTIONS (Optimized for real-time use)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fast pseudo-random noise (deterministic)
 */
export const noise2D = (x, y) => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

/**
 * Smooth noise with interpolation
 */
export const smoothNoise2D = (x, y) => {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  
  const n00 = noise2D(x0, y0)
  const n10 = noise2D(x0 + 1, y0)
  const n01 = noise2D(x0, y0 + 1)
  const n11 = noise2D(x0 + 1, y0 + 1)
  
  const sx = smoothstep(fx)
  const sy = smoothstep(fy)
  
  return lerp(
    lerp(n00, n10, sx),
    lerp(n01, n11, sx),
    sy
  )
}

/**
 * Fractal Brownian Motion (fBm) - layered noise
 * @param {number} octaves - Number of layers (2-4 recommended for performance)
 */
export const fbm = (x, y, octaves = 3) => {
  let value = 0
  let amplitude = 0.5
  let frequency = 1
  
  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise2D(x * frequency, y * frequency)
    amplitude *= 0.5
    frequency *= 2
  }
  
  return value
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEOMETRY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Distance between two points (squared - faster, use for comparisons)
 */
export const distanceSquared = (x1, y1, x2, y2) => {
  const dx = x2 - x1
  const dy = y2 - y1
  return dx * dx + dy * dy
}

/**
 * Distance between two points
 */
export const distance = (x1, y1, x2, y2) => 
  Math.sqrt(distanceSquared(x1, y1, x2, y2))

/**
 * Normalize angle to 0-TAU range
 */
export const normalizeAngle = (angle) => {
  angle = angle % TAU
  return angle < 0 ? angle + TAU : angle
}

/**
 * Shortest angle difference between two angles
 */
export const angleDiff = (a, b) => {
  const diff = normalizeAngle(b - a)
  return diff > PI ? diff - TAU : diff
}

/**
 * Rotate point around origin
 */
export const rotatePoint = (x, y, angle) => ({
  x: x * Math.cos(angle) - y * Math.sin(angle),
  y: x * Math.sin(angle) + y * Math.cos(angle)
})

// ═══════════════════════════════════════════════════════════════════════════════
// SPRING PHYSICS (For smooth animations)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Spring physics update - returns new value and velocity
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @param {number} velocity - Current velocity
 * @param {number} stiffness - Spring stiffness (higher = faster)
 * @param {number} damping - Damping factor (0-1, lower = more bouncy)
 * @param {number} dt - Delta time in seconds
 */
export const springUpdate = (current, target, velocity, stiffness, damping, dt) => {
  const force = (target - current) * stiffness
  const newVel = (velocity + force * dt) * Math.pow(damping, dt * 60)
  return { 
    value: current + newVel * dt, 
    velocity: newVel 
  }
}

/**
 * Create a spring state object
 */
export const createSpring = (initialValue = 0, stiffness = 10, damping = 0.85) => ({
  value: initialValue,
  target: initialValue,
  velocity: 0,
  stiffness,
  damping
})

/**
 * Update spring state in place (mutates for performance)
 */
export const updateSpring = (spring, dt) => {
  const result = springUpdate(
    spring.value, 
    spring.target, 
    spring.velocity, 
    spring.stiffness, 
    spring.damping, 
    dt
  )
  spring.value = result.value
  spring.velocity = result.velocity
  return spring.value
}
