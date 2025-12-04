/**
 * StuckStateDetector - Detects and recovers from stuck player states
 * Uses heuristics to identify when player is unresponsive
 */
export class StuckStateDetector {
    constructor(threshold = 15000) {
        this.threshold = threshold // Max time in same state (ms)
        this.stateHistory = []
        this.recoveryAttempts = new Map()
        this.maxRecoveryAttempts = 3
    }

    /**
     * Record a state change
     * @param {string} state - Current state
     * @param {Object} context - Additional context
     */
    recordStateChange(state, context = {}) {
        this.stateHistory.push({
            state,
            timestamp: Date.now(),
            context
        })

        // Keep only last 100 entries
        if (this.stateHistory.length > 100) {
            this.stateHistory.shift()
        }
    }

    /**
     * Check if player is stuck
     * @returns {boolean}
     */
    isPlayerStuck() {
        if (this.stateHistory.length < 2) return false

        const now = Date.now()
        const lastEntry = this.stateHistory[this.stateHistory.length - 1]
        const stateAge = now - lastEntry.timestamp

        // Check if stuck in same state for too long
        if (stateAge > this.threshold) {
            // Check if last N entries are the same state
            const lastEntries = this.stateHistory.slice(-10)
            const sameStateCount = lastEntries.filter(
                entry => entry.state === lastEntry.state
            ).length

            // If 70% of recent history is same state, stuck
            if (sameStateCount >= 7) {
                return true
            }
        }

        return false
    }

    /**
     * Detect specific stuck patterns
     * @returns {Object|null} - Pattern info or null
     */
    detectStuckPattern() {
        if (this.stateHistory.length < 5) return null

        const recent = this.stateHistory.slice(-20)
        const lastState = recent[recent.length - 1].state
        const age = Date.now() - recent[recent.length - 1].timestamp

        // Pattern 1: Stuck buffering
        if (lastState === 'buffering' && age > this.threshold) {
            const bufferingCount = recent.filter(e => e.state === 'buffering').length
            if (bufferingCount >= 15) {
                return {
                    pattern: 'STUCK_BUFFERING',
                    state: 'buffering',
                    duration: age,
                    severity: 'high'
                }
            }
        }

        // Pattern 2: Stuck transitioning
        if (lastState === 'transitioning' && age > this.threshold) {
            const transitionCount = recent.filter(
                e => e.state === 'transitioning'
            ).length
            if (transitionCount >= 10) {
                return {
                    pattern: 'STUCK_TRANSITIONING',
                    state: 'transitioning',
                    duration: age,
                    severity: 'high'
                }
            }
        }

        // Pattern 3: Infinite error loop
        if (lastState === 'error' && age > 5000) {
            const errorCount = recent.filter(e => e.state === 'error').length
            if (errorCount >= 5) {
                return {
                    pattern: 'ERROR_LOOP',
                    state: 'error',
                    duration: age,
                    severity: 'critical'
                }
            }
        }

        // Pattern 4: Rapid state changes (flapping)
        if (recent.length >= 10) {
            const last10 = recent.slice(-10)
            const uniqueStates = new Set(last10.map(e => e.state))
            const timespan = last10[9].timestamp - last10[0].timestamp

            if (uniqueStates.size >= 5 && timespan < 2000) {
                return {
                    pattern: 'STATE_FLAPPING',
                    state: lastState,
                    duration: timespan,
                    severity: 'medium'
                }
            }
        }

        return null
    }

    /**
     * Get recommended recovery action
     * @returns {Object|null} - Recovery action or null
     */
    getRecoveryAction() {
        const pattern = this.detectStuckPattern()
        if (!pattern) return null

        const recoveryCount = this.recoveryAttempts.get(pattern.pattern) || 0

        // Don't retry if already attempted max times
        if (recoveryCount >= this.maxRecoveryAttempts) {
            return {
                action: 'SWITCH_CHANNEL',
                reason: `${pattern.pattern} - max recovery attempts exceeded`,
                severity: 'critical'
            }
        }

        switch (pattern.pattern) {
            case 'STUCK_BUFFERING':
                return {
                    action: 'SKIP_VIDEO',
                    reason: 'Video stuck buffering - skip to next',
                    severity: 'high',
                    delay: 1000
                }

            case 'STUCK_TRANSITIONING':
                return {
                    action: 'FORCE_END_TRANSITION',
                    reason: 'Transition stuck - force complete',
                    severity: 'high',
                    delay: 500
                }

            case 'ERROR_LOOP':
                return {
                    action: 'RESET_PLAYER',
                    reason: 'Error loop detected - reset player',
                    severity: 'critical',
                    delay: 2000
                }

            case 'STATE_FLAPPING':
                return {
                    action: 'STABILIZE_PLAYER',
                    reason: 'Rapid state changes - stabilize',
                    severity: 'medium',
                    delay: 1500
                }

            default:
                return null
        }
    }

    /**
     * Record recovery attempt
     * @param {string} pattern - Pattern name
     */
    recordRecoveryAttempt(pattern) {
        const count = this.recoveryAttempts.get(pattern) || 0
        this.recoveryAttempts.set(pattern, count + 1)
    }

    /**
     * Check if recovery is needed
     * @returns {boolean}
     */
    needsRecovery() {
        return this.detectStuckPattern() !== null
    }

    /**
     * Get recovery suggestions
     * @returns {Array} - Array of recovery suggestions
     */
    getRecoverySuggestions() {
        const suggestions = []
        const pattern = this.detectStuckPattern()

        if (!pattern) return suggestions

        switch (pattern.severity) {
            case 'critical':
                suggestions.push('1. Reload the entire player')
                suggestions.push('2. Switch to a different channel')
                suggestions.push('3. Check network connection')
                break

            case 'high':
                suggestions.push('1. Skip to next video')
                suggestions.push('2. Try switching channels')
                suggestions.push('3. Wait a few seconds')
                break

            case 'medium':
                suggestions.push('1. Wait for stabilization')
                suggestions.push('2. Reload if persists')
                break
        }

        return suggestions
    }

    /**
     * Get diagnostic info
     * @returns {Object}
     */
    getDiagnostics() {
        const pattern = this.detectStuckPattern()
        const recovery = this.getRecoveryAction()

        return {
            isStuck: this.isPlayerStuck(),
            pattern,
            recovery,
            recoveryAttempts: Object.fromEntries(this.recoveryAttempts),
            historyLength: this.stateHistory.length,
            suggestions: this.getRecoverySuggestions()
        }
    }

    /**
     * Reset detection state
     */
    reset() {
        this.stateHistory = []
        this.recoveryAttempts.clear()
    }

    /**
     * Get last N state changes for debugging
     * @param {number} count - Number of entries
     * @returns {Array}
     */
    getRecentHistory(count = 20) {
        return this.stateHistory.slice(-count)
    }
}
