/**
 * EventCleanupManager - Unified management of timeouts, intervals, and async operations
 * Prevents memory leaks and stuck events by centralizing cleanup logic
 */
export class EventCleanupManager {
    constructor(name = 'EventManager') {
        this.name = name
        this.timeouts = new Map()
        this.intervals = new Map()
        this.abortControllers = new Map()
        this.listeners = new Map()
    }

    /**
     * Set a timeout with automatic cleanup tracking
     * @param {string} key - Unique identifier for this timeout
     * @param {Function} fn - Function to execute
     * @param {number} delay - Delay in ms
     */
    setTimeout(key, fn, delay) {
        this.clearTimeout(key)
        const id = setTimeout(() => {
            try {
                this.timeouts.delete(key)
                fn()
            } catch (err) {
                console.error(`[${this.name}] Error in timeout ${key}:`, err)
            }
        }, delay)
        this.timeouts.set(key, id)
        return id
    }

    /**
     * Set an interval with automatic cleanup tracking
     * @param {string} key - Unique identifier for this interval
     * @param {Function} fn - Function to execute repeatedly
     * @param {number} interval - Interval in ms
     */
    setInterval(key, fn, interval) {
        this.clearInterval(key)
        const id = setInterval(() => {
            try {
                fn()
            } catch (err) {
                console.error(`[${this.name}] Error in interval ${key}:`, err)
            }
        }, interval)
        this.intervals.set(key, id)
        return id
    }

    /**
     * Create an AbortController for managing async operations
     * @param {string} key - Unique identifier
     * @returns {AbortController}
     */
    createAbortController(key) {
        // Cancel previous controller if exists
        if (this.abortControllers.has(key)) {
            this.abortControllers.get(key).abort()
        }
        const controller = new AbortController()
        this.abortControllers.set(key, controller)
        return controller
    }

    /**
     * Add event listener with tracking
     * @param {Element} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} options - Listener options
     */
    addEventListener(element, event, handler, options = {}) {
        if (!element) return
        const key = `${element.id || 'element'}_${event}_${Date.now()}`
        element.addEventListener(event, handler, options)
        this.listeners.set(key, { element, event, handler, options })
    }

    /**
     * Clear a specific timeout
     * @param {string} key - Timeout key
     */
    clearTimeout(key) {
        if (this.timeouts.has(key)) {
            clearTimeout(this.timeouts.get(key))
            this.timeouts.delete(key)
        }
    }

    /**
     * Clear a specific interval
     * @param {string} key - Interval key
     */
    clearInterval(key) {
        if (this.intervals.has(key)) {
            clearInterval(this.intervals.get(key))
            this.intervals.delete(key)
        }
    }

    /**
     * Clear a specific abort controller
     * @param {string} key - Controller key
     */
    clearAbortController(key) {
        if (this.abortControllers.has(key)) {
            this.abortControllers.get(key).abort()
            this.abortControllers.delete(key)
        }
    }

    /**
     * Get abort signal for a key
     * @param {string} key - Controller key
     * @returns {AbortSignal|null}
     */
    getAbortSignal(key) {
        const controller = this.abortControllers.get(key)
        return controller ? controller.signal : null
    }

    /**
     * Check if an operation is aborted
     * @param {string} key - Controller key
     * @returns {boolean}
     */
    isAborted(key) {
        const signal = this.getAbortSignal(key)
        return signal ? signal.aborted : false
    }

    /**
     * Cleanup specific resource or all if no key provided
     * @param {string} key - Optional key to cleanup specific resource
     */
    cleanup(key) {
        if (key) {
            this.clearTimeout(key)
            this.clearInterval(key)
            this.clearAbortController(key)
        }
    }

    /**
     * Cleanup all resources - call on component unmount
     */
    cleanupAll() {
        // Clear all timeouts
        this.timeouts.forEach(id => clearTimeout(id))
        this.timeouts.clear()

        // Clear all intervals
        this.intervals.forEach(id => clearInterval(id))
        this.intervals.clear()

        // Abort all controllers
        this.abortControllers.forEach(controller => {
            try {
                controller.abort()
            } catch (err) {
                console.error(`[${this.name}] Error aborting controller:`, err)
            }
        })
        this.abortControllers.clear()

        // Remove all event listeners
        this.listeners.forEach(({ element, event, handler, options }) => {
            try {
                element.removeEventListener(event, handler, options)
            } catch (err) {
                console.error(`[${this.name}] Error removing listener:`, err)
            }
        })
        this.listeners.clear()
    }

    /**
     * Get current state for debugging
     */
    getState() {
        return {
            timeouts: this.timeouts.size,
            intervals: this.intervals.size,
            controllers: this.abortControllers.size,
            listeners: this.listeners.size
        }
    }
}
