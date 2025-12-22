/**
 * Async LocalStorage Wrapper
 * 
 * Provides non-blocking localStorage operations to prevent UI freezes
 * Uses requestIdleCallback or setTimeout to defer operations
 * 
 * Usage:
 *   import asyncStorage from './utils/asyncStorage'
 *   await asyncStorage.setItem('key', 'value')
 *   const value = await asyncStorage.getItem('key')
 */

class AsyncStorage {
  constructor() {
    this.queue = []
    this.processing = false
    this.useIdleCallback = typeof requestIdleCallback !== 'undefined'
    this.fallbackDelay = 0 // Immediate fallback for critical operations
  }

  /**
   * Schedule an operation to run asynchronously
   */
  _schedule(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject })

      if (!this.processing) {
        this._processQueue()
      }
    })
  }

  /**
   * Process the operation queue
   */
  _processQueue() {
    if (this.queue.length === 0) {
      this.processing = false
      return
    }

    this.processing = true
    const { operation, resolve, reject } = this.queue.shift()

    const execute = () => {
      try {
        const result = operation()
        resolve(result)
      } catch (error) {
        reject(error)
      } finally {
        // Process next item in queue
        if (this.useIdleCallback) {
          requestIdleCallback(() => this._processQueue(), { timeout: 100 })
        } else {
          setTimeout(() => this._processQueue(), this.fallbackDelay)
        }
      }
    }

    // Use requestIdleCallback if available, otherwise setTimeout
    if (this.useIdleCallback) {
      requestIdleCallback(execute, { timeout: 100 })
    } else {
      // Use setTimeout with 0ms for immediate execution in next tick
      setTimeout(execute, this.fallbackDelay)
    }
  }

  /**
   * Get item from localStorage (async)
   */
  async getItem(key) {
    return this._schedule(() => {
      try {
        return localStorage.getItem(key)
      } catch (error) {
        console.error('[AsyncStorage] Error getting item:', error)
        return null
      }
    })
  }

  /**
   * Set item in localStorage (async)
   */
  async setItem(key, value) {
    return this._schedule(() => {
      try {
        localStorage.setItem(key, value)
        return true
      } catch (error) {
        if (error.name === 'QuotaExceededError') {
          console.warn('[AsyncStorage] Storage quota exceeded, attempting cleanup...')
          // Try to free up space
          this._cleanupOldItems()
          // Retry once
          try {
            localStorage.setItem(key, value)
            return true
          } catch (retryError) {
            console.error('[AsyncStorage] Retry failed:', retryError)
            throw retryError
          }
        }
        console.error('[AsyncStorage] Error setting item:', error)
        throw error
      }
    })
  }

  /**
   * Remove item from localStorage (async)
   */
  async removeItem(key) {
    return this._schedule(() => {
      try {
        localStorage.removeItem(key)
        return true
      } catch (error) {
        console.error('[AsyncStorage] Error removing item:', error)
        throw error
      }
    })
  }

  /**
   * Clear all items from localStorage (async)
   */
  async clear() {
    return this._schedule(() => {
      try {
        localStorage.clear()
        return true
      } catch (error) {
        console.error('[AsyncStorage] Error clearing storage:', error)
        throw error
      }
    })
  }

  /**
   * Get all keys from localStorage (async)
   */
  async keys() {
    return this._schedule(() => {
      try {
        const keys = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key) keys.push(key)
        }
        return keys
      } catch (error) {
        console.error('[AsyncStorage] Error getting keys:', error)
        return []
      }
    })
  }

  /**
   * Get storage size estimate (async)
   */
  async getSize() {
    return this._schedule(() => {
      try {
        let total = 0
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key) {
            const value = localStorage.getItem(key)
            total += key.length + (value ? value.length : 0)
          }
        }
        return total
      } catch (error) {
        console.error('[AsyncStorage] Error calculating size:', error)
        return 0
      }
    })
  }

  /**
   * Cleanup old items when storage is full
   * Removes items with oldest timestamps
   */
  _cleanupOldItems() {
    try {
      const items = []
      
      // Collect all items with timestamps
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && !key.startsWith('desitv-') && !key.startsWith('retro-tv-')) {
          try {
            const value = localStorage.getItem(key)
            const parsed = JSON.parse(value)
            if (parsed && parsed.timestamp) {
              items.push({ key, timestamp: parsed.timestamp })
            }
          } catch {
            // Not JSON, skip
          }
        }
      }

      // Sort by timestamp (oldest first)
      items.sort((a, b) => a.timestamp - b.timestamp)

      // Remove oldest 10% of items
      const toRemove = Math.ceil(items.length * 0.1)
      for (let i = 0; i < toRemove && i < items.length; i++) {
        localStorage.removeItem(items[i].key)
      }

      console.log(`[AsyncStorage] Cleaned up ${toRemove} old items`)
    } catch (error) {
      console.error('[AsyncStorage] Error during cleanup:', error)
    }
  }

  /**
   * Batch operations for better performance
   */
  async batch(operations) {
    const results = []
    for (const op of operations) {
      try {
        if (op.type === 'get') {
          results.push(await this.getItem(op.key))
        } else if (op.type === 'set') {
          results.push(await this.setItem(op.key, op.value))
        } else if (op.type === 'remove') {
          results.push(await this.removeItem(op.key))
        }
      } catch (error) {
        results.push({ error: error.message })
      }
    }
    return results
  }

  /**
   * Synchronous fallback for critical operations
   * Use sparingly - only when immediate sync is required
   */
  getItemSync(key) {
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.error('[AsyncStorage] Sync get error:', error)
      return null
    }
  }

  setItemSync(key, value) {
    try {
      localStorage.setItem(key, value)
      return true
    } catch (error) {
      console.error('[AsyncStorage] Sync set error:', error)
      return false
    }
  }

  removeItemSync(key) {
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error('[AsyncStorage] Sync remove error:', error)
      return false
    }
  }
}

// Export singleton instance
const asyncStorage = new AsyncStorage()

export default asyncStorage

