/**
 * broadcastPosition.js - the single source of truth for "what is playing right now"
 *
 * The entire pseudolive product is this one formula:
 *
 *     position = (now - epoch) mod totalPlaylistDuration
 *
 * Every viewer computes it from the same epoch, so everyone lands on the same
 * video at the same offset without any server round-trip.
 *
 * This module is pure ESM with zero dependencies so both sides can use it:
 *   - the client imports it directly (Vite alias '@shared')
 *   - the CommonJS server loads it with `await import(...)`
 *
 * It is deliberately pure: no clock reads, no I/O, no logging. `nowMs` is passed
 * in, which is what makes the behaviour testable at fixed timestamps.
 */

/** Used when an item has no usable duration, so one bad record can't stall a channel. */
export const DEFAULT_VIDEO_DURATION = 300

/**
 * Duration of a single playlist item, in seconds.
 * Guards against missing, zero, negative and non-numeric durations.
 */
function durationOf(item) {
	const duration = item?.duration
	return typeof duration === 'number' && isFinite(duration) && duration > 0
		? duration
		: DEFAULT_VIDEO_DURATION
}

/**
 * Total running time of a playlist, in seconds.
 */
export function totalDurationOf(items) {
	if (!Array.isArray(items) || items.length === 0) return 0
	return items.reduce((sum, item) => sum + durationOf(item), 0)
}

/**
 * Which video is playing at `nowMs`, and how far into it.
 *
 * Fractional seconds are preserved throughout. Rounding here is what previously
 * let the player and the "What's Next" overlay disagree by up to a second, so
 * callers round at the edge (e.g. YouTube's startSeconds) rather than in here.
 *
 * @param {number} nowMs   - current time in ms (clock-corrected; see services/time.js)
 * @param {number} epochMs - broadcast epoch in ms; the timeline's zero point
 * @param {Array}  items   - playlist items, each optionally { duration }
 * @returns {{
 *   videoIndex: number, offset: number, cyclePosition: number,
 *   totalDuration: number, cycleCount: number, isValid: boolean
 * }} `isValid: false` means there is nothing to play; videoIndex is then -1.
 */
export function positionAt(nowMs, epochMs, items) {
	const empty = {
		videoIndex: -1,
		offset: 0,
		cyclePosition: 0,
		totalDuration: 0,
		cycleCount: 0,
		isValid: false,
	}

	if (!Array.isArray(items) || items.length === 0) return empty
	if (!isFinite(nowMs) || !isFinite(epochMs)) return empty

	const totalDuration = totalDurationOf(items)
	// A zero-length playlist would make the modulo below NaN.
	if (totalDuration <= 0) return empty

	const elapsedSec = (nowMs - epochMs) / 1000

	// Before the epoch, or a device clock set behind it, must still land somewhere
	// real: JS `%` keeps the sign of the dividend, so normalise into [0, total).
	let cyclePosition = elapsedSec % totalDuration
	if (cyclePosition < 0) cyclePosition += totalDuration

	const cycleCount = Math.floor(elapsedSec / totalDuration)

	let accumulated = 0
	for (let i = 0; i < items.length; i++) {
		const duration = durationOf(items[i])
		if (cyclePosition < accumulated + duration) {
			return {
				videoIndex: i,
				offset: cyclePosition - accumulated,
				cyclePosition,
				totalDuration,
				cycleCount,
				isValid: true,
			}
		}
		accumulated += duration
	}

	// Unreachable while cyclePosition < totalDuration, but float accumulation
	// could leave a sliver at the very end; treat it as the last item.
	const lastIndex = items.length - 1
	return {
		videoIndex: lastIndex,
		offset: Math.max(0, cyclePosition - (totalDuration - durationOf(items[lastIndex]))),
		cyclePosition,
		totalDuration,
		cycleCount,
		isValid: true,
	}
}

/**
 * The item after `videoIndex`, and how long until the switch.
 * Wraps to the start of the playlist, since a broadcast never ends.
 */
export function nextUp(items, videoIndex, cyclePosition) {
	if (!Array.isArray(items) || items.length === 0) {
		return { nextIndex: -1, secondsUntilSwitch: 0 }
	}

	let videoStart = 0
	for (let i = 0; i < videoIndex; i++) videoStart += durationOf(items[i])

	const videoEnd = videoStart + durationOf(items[videoIndex])

	return {
		nextIndex: (videoIndex + 1) % items.length,
		secondsUntilSwitch: Math.max(0, videoEnd - cyclePosition),
	}
}
