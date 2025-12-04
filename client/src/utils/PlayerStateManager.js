/**
 * PlayerStateManager - Enforces valid state machine for video player
 * Prevents invalid state combinations and provides state history tracking
 */
export class PlayerStateManager {
    // Define all possible player states
    static STATES = {
        IDLE: 'idle',
        LOADING: 'loading',
        PLAYING: 'playing',
        BUFFERING: 'buffering',
        TRANSITIONING: 'transitioning',
        ERROR: 'error',
        RECOVERING: 'recovering'
    }

    constructor() {
        // Define valid transitions between states
        this.validTransitions = {
            [PlayerStateManager.STATES.IDLE]: [
                PlayerStateManager.STATES.LOADING
            ],
            [PlayerStateManager.STATES.LOADING]: [
                PlayerStateManager.STATES.PLAYING,
                PlayerStateManager.STATES.ERROR,
                PlayerStateManager.STATES.IDLE
            ],
            [PlayerStateManager.STATES.PLAYING]: [
                PlayerStateManager.STATES.BUFFERING,
                PlayerStateManager.STATES.TRANSITIONING,
                PlayerStateManager.STATES.ERROR,
                PlayerStateManager.STATES.IDLE
            ],
            [PlayerStateManager.STATES.BUFFERING]: [
                PlayerStateManager.STATES.PLAYING,
                PlayerStateManager.STATES.ERROR,
                PlayerStateManager.STATES.IDLE
            ],
            [PlayerStateManager.STATES.TRANSITIONING]: [
                PlayerStateManager.STATES.IDLE,
                PlayerStateManager.STATES.LOADING,
                PlayerStateManager.STATES.ERROR
            ],
            [PlayerStateManager.STATES.ERROR]: [
                PlayerStateManager.STATES.RECOVERING,
                PlayerStateManager.STATES.TRANSITIONING,
                PlayerStateManager.STATES.LOADING,
                PlayerStateManager.STATES.IDLE
            ],
            [PlayerStateManager.STATES.RECOVERING]: [
                PlayerStateManager.STATES.LOADING,
                PlayerStateManager.STATES.PLAYING,
                PlayerStateManager.STATES.ERROR,
                PlayerStateManager.STATES.IDLE
            ]
        }

        this.currentState = PlayerStateManager.STATES.IDLE
        this.previousState = null
        this.stateChangedAt = Date.now()
        this.stateHistory = []
        this.listeners = new Set()

        // Record initial state
        this.stateHistory.push({
            state: this.currentState,
            timestamp: Date.now(),
            source: 'init'
        })
    }

    /**
     * Check if transition is valid
     * @param {string} newState - Target state
     * @returns {boolean}
     */
    canTransitionTo(newState) {
        const allowed = this.validTransitions[this.currentState] || []
        return allowed.includes(newState)
    }

    /**
     * Transition to a new state if valid
     * @param {string} newState - Target state
     * @param {string} source - Where transition originated from
     * @returns {boolean} - True if successful
     */
    transitionTo(newState, source = 'unknown') {
        if (!this.canTransitionTo(newState)) {
            console.warn(
                `[PlayerStateManager] Invalid transition: ${this.currentState} -> ${newState} (source: ${source})`
            )
            return false
        }

        this.previousState = this.currentState
        this.currentState = newState
        this.stateChangedAt = Date.now()

        // Record in history
        this.stateHistory.push({
            state: newState,
            from: this.previousState,
            timestamp: this.stateChangedAt,
            source
        })

        // Keep only last 100 state changes
        if (this.stateHistory.length > 100) {
            this.stateHistory.shift()
        }

        this.notifyListeners()
        return true
    }

    /**
     * Force state transition (use with caution - for recovery)
     * @param {string} newState - Target state
     * @param {string} reason - Reason for force
     */
    forceTransitionTo(newState, reason = 'forced') {
        console.warn(
            `[PlayerStateManager] FORCE transition: ${this.currentState} -> ${newState} (${reason})`
        )
        this.previousState = this.currentState
        this.currentState = newState
        this.stateChangedAt = Date.now()

        this.stateHistory.push({
            state: newState,
            from: this.previousState,
            timestamp: this.stateChangedAt,
            source: `force:${reason}`
        })

        this.notifyListeners()
    }

    /**
     * Get current state
     * @returns {string}
     */
    getState() {
        return this.currentState
    }

    /**
     * Get previous state
     * @returns {string|null}
     */
    getPreviousState() {
        return this.previousState
    }

    /**
     * Get how long we've been in current state (ms)
     * @returns {number}
     */
    getStateAge() {
        return Date.now() - this.stateChangedAt
    }

    /**
     * Check if stuck in same state too long
     * @param {number} maxDuration - Max time in state (ms)
     * @returns {boolean}
     */
    isStuck(maxDuration = 15000) {
        return this.getStateAge() > maxDuration
    }

    /**
     * Check if in a "bad" state
     * @returns {boolean}
     */
    isInBadState() {
        return [
            PlayerStateManager.STATES.ERROR,
            PlayerStateManager.STATES.RECOVERING
        ].includes(this.currentState)
    }

    /**
     * Check if ready for playback
     * @returns {boolean}
     */
    isReadyForPlayback() {
        return this.currentState === PlayerStateManager.STATES.PLAYING
    }

    /**
     * Register listener for state changes
     * @param {Function} listener - Called with { current, previous, age }
     * @returns {Function} - Unsubscribe function
     */
    onStateChange(listener) {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    /**
     * Notify all listeners of state change
     */
    notifyListeners() {
        const info = {
            current: this.currentState,
            previous: this.previousState,
            age: this.getStateAge()
        }
        this.listeners.forEach(listener => {
            try {
                listener(info)
            } catch (err) {
                console.error('[PlayerStateManager] Error in listener:', err)
            }
        })
    }

    /**
     * Get state history for debugging
     * @param {number} count - Last N entries
     * @returns {Array}
     */
    getStateHistory(count = 20) {
        return this.stateHistory.slice(-count)
    }

    /**
     * Reset to idle state
     */
    reset() {
        this.forceTransitionTo(PlayerStateManager.STATES.IDLE, 'reset')
    }

    /**
     * Get current state info for debugging
     */
    getInfo() {
        return {
            current: this.currentState,
            previous: this.previousState,
            age: this.getStateAge(),
            isStuck: this.isStuck(),
            isInBadState: this.isInBadState(),
            isReadyForPlayback: this.isReadyForPlayback(),
            historyLength: this.stateHistory.length,
            listenersCount: this.listeners.size
        }
    }
}
