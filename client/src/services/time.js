/**
 * time.js - one clock for every viewer
 *
 * Playback position is derived from (now - epoch), so a device whose clock is
 * off by 30s plays 30s away from everyone else. This measures that skew once
 * against the server and corrects for it.
 *
 * Deliberately small: one round-trip, best of three samples. Not NTP - we need
 * to be right to within a second or so, not a millisecond.
 */

import logger from '../utils/logger.js'
import { envConfig } from '../config/environment.js'

/** Ignore a sample this slow; the midpoint estimate stops being meaningful. */
const MAX_ACCEPTABLE_RTT_MS = 1000
const SAMPLE_COUNT = 3
const RESYNC_INTERVAL_MS = 30 * 60 * 1000

let clockOffsetMs = 0
let synced = false
let inFlight = null

/**
 * Current time, corrected toward the server's clock.
 * Every position calculation must use this rather than Date.now().
 */
export function now() {
	return Date.now() + clockOffsetMs
}

export function getClockOffset() {
	return clockOffsetMs
}

export function isClockSynced() {
	return synced
}

/**
 * One round-trip. Returns null if the request fails or looks malformed.
 *
 * Assumes the request and response legs take about the same time, so the
 * server's clock reading corresponds to the local midpoint of the round-trip.
 */
async function sample() {
	const startedAt = Date.now()

	const response = await fetch(envConfig.getApiUrl('/api/time'), { cache: 'no-store' })
	if (!response.ok) return null

	const { t: serverTimeMs } = await response.json()
	if (typeof serverTimeMs !== 'number' || !isFinite(serverTimeMs)) return null

	const finishedAt = Date.now()
	const rtt = finishedAt - startedAt

	return { rtt, offset: serverTimeMs + rtt / 2 - finishedAt }
}

/**
 * Measure the offset between this device's clock and the server's.
 *
 * Keeps the lowest-RTT sample rather than averaging: a fast round-trip is the
 * one least distorted by queueing, so it carries the least error. Averaging
 * would fold the slow samples' error back in.
 *
 * On failure the offset stays 0, which is exactly the old behaviour - a device
 * with a good clock still plays in sync.
 */
export async function syncClock() {
	if (inFlight) return inFlight

	inFlight = (async () => {
		const samples = []
		for (let i = 0; i < SAMPLE_COUNT; i++) {
			try {
				const result = await sample()
				if (result) samples.push(result)
			} catch (err) {
				logger.warn('[Time] Clock sample failed:', err.message)
			}
		}

		if (samples.length === 0) {
			logger.warn('[Time] Clock sync failed, using device clock as-is')
			return clockOffsetMs
		}

		const best = samples.reduce((a, b) => (a.rtt <= b.rtt ? a : b))

		if (best.rtt > MAX_ACCEPTABLE_RTT_MS) {
			logger.warn(`[Time] Discarding clock sync, RTT ${best.rtt}ms too high`)
			return clockOffsetMs
		}

		clockOffsetMs = best.offset
		synced = true
		logger.info(`[Time] Clock offset ${Math.round(best.offset)}ms (RTT ${best.rtt}ms)`)

		return clockOffsetMs
	})()

	try {
		return await inFlight
	} finally {
		inFlight = null
	}
}

/**
 * Sync now, then keep it fresh. Re-syncs when the tab becomes visible, which
 * is what catches a laptop waking from sleep - the case where a device clock
 * realistically drifts far enough to matter.
 */
export function startClockSync() {
	syncClock()

	const interval = setInterval(syncClock, RESYNC_INTERVAL_MS)

	const onVisible = () => {
		if (document.visibilityState === 'visible') syncClock()
	}
	document.addEventListener('visibilitychange', onVisible)

	return () => {
		clearInterval(interval)
		document.removeEventListener('visibilitychange', onVisible)
	}
}
