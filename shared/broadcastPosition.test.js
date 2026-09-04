import { describe, it, expect } from 'vitest'
import { positionAt, nextUp, totalDurationOf, DEFAULT_VIDEO_DURATION } from './broadcastPosition.js'

// Every assertion uses a fixed timestamp. Nothing here reads the clock, so a
// failure always means the algorithm changed - never that the test got unlucky.
const EPOCH = Date.parse('2020-01-01T00:00:00.000Z')
const at = (seconds) => EPOCH + seconds * 1000

// 3 items, 60s total.
const PLAYLIST = [
	{ youtubeId: 'a', duration: 10 },
	{ youtubeId: 'b', duration: 20 },
	{ youtubeId: 'c', duration: 30 },
]

describe('positionAt', () => {
	it('starts at the first video at the epoch itself', () => {
		expect(positionAt(at(0), EPOCH, PLAYLIST)).toMatchObject({
			videoIndex: 0, offset: 0, cycleCount: 0, isValid: true,
		})
	})

	it('reports the offset inside the current video', () => {
		expect(positionAt(at(5), EPOCH, PLAYLIST)).toMatchObject({ videoIndex: 0, offset: 5 })
		expect(positionAt(at(15), EPOCH, PLAYLIST)).toMatchObject({ videoIndex: 1, offset: 5 })
		expect(positionAt(at(45), EPOCH, PLAYLIST)).toMatchObject({ videoIndex: 2, offset: 15 })
	})

	// A boundary belongs to the video that is starting, not the one that ended.
	it('places an exact boundary at the start of the next video', () => {
		expect(positionAt(at(10), EPOCH, PLAYLIST)).toMatchObject({ videoIndex: 1, offset: 0 })
		expect(positionAt(at(30), EPOCH, PLAYLIST)).toMatchObject({ videoIndex: 2, offset: 0 })
	})

	it('wraps around at the end of a cycle', () => {
		expect(positionAt(at(60), EPOCH, PLAYLIST)).toMatchObject({
			videoIndex: 0, offset: 0, cycleCount: 1,
		})
		expect(positionAt(at(65), EPOCH, PLAYLIST)).toMatchObject({ videoIndex: 0, offset: 5 })
	})

	it('keeps fractional seconds', () => {
		// Rounding here is what let the player and the overlay disagree by ~1s.
		const pos = positionAt(at(5.25), EPOCH, PLAYLIST)
		expect(pos.videoIndex).toBe(0)
		expect(pos.offset).toBeCloseTo(5.25, 6)
	})

	it('stays inside the playlist for times before the epoch', () => {
		// A device clock set behind the epoch must still land on a real video.
		const pos = positionAt(at(-5), EPOCH, PLAYLIST)
		expect(pos.videoIndex).toBe(2)
		expect(pos.offset).toBeCloseTo(25, 6)
		expect(pos.isValid).toBe(true)
	})

	it('handles a single-item playlist by looping it', () => {
		const single = [{ youtubeId: 'solo', duration: 30 }]
		expect(positionAt(at(10), EPOCH, single)).toMatchObject({ videoIndex: 0, offset: 10 })
		expect(positionAt(at(40), EPOCH, single)).toMatchObject({ videoIndex: 0, offset: 10 })
	})

	it('substitutes a default for unusable durations', () => {
		const items = [{ youtubeId: 'x' }, { youtubeId: 'y', duration: 0 }]
		expect(totalDurationOf(items)).toBe(DEFAULT_VIDEO_DURATION * 2)
		expect(positionAt(at(1), EPOCH, items)).toMatchObject({ videoIndex: 0, isValid: true })
	})

	// Previously produced NaN and crashed liveStateService with a TypeError.
	it('reports invalid instead of NaN when there is nothing to play', () => {
		for (const items of [[], null, undefined]) {
			expect(positionAt(at(10), EPOCH, items)).toMatchObject({ videoIndex: -1, isValid: false })
		}
	})

	it('reports invalid for a non-finite clock or epoch', () => {
		expect(positionAt(NaN, EPOCH, PLAYLIST).isValid).toBe(false)
		expect(positionAt(at(10), NaN, PLAYLIST).isValid).toBe(false)
	})

	it('never returns an offset past the end of its video', () => {
		// Walk a whole cycle in 0.5s steps; catches drift and off-by-one at every seam.
		for (let s = 0; s < 60; s += 0.5) {
			const pos = positionAt(at(s), EPOCH, PLAYLIST)
			expect(pos.offset).toBeGreaterThanOrEqual(0)
			expect(pos.offset).toBeLessThan(PLAYLIST[pos.videoIndex].duration)
		}
	})
})

describe('nextUp', () => {
	it('counts down to the next switch', () => {
		const pos = positionAt(at(5), EPOCH, PLAYLIST)
		expect(nextUp(PLAYLIST, pos.videoIndex, pos.cyclePosition)).toEqual({
			nextIndex: 1, secondsUntilSwitch: 5,
		})
	})

	it('wraps from the last video back to the first', () => {
		const pos = positionAt(at(45), EPOCH, PLAYLIST)
		expect(nextUp(PLAYLIST, pos.videoIndex, pos.cyclePosition)).toEqual({
			nextIndex: 0, secondsUntilSwitch: 15,
		})
	})

	it('has no next video for an empty playlist', () => {
		expect(nextUp([], 0, 0)).toEqual({ nextIndex: -1, secondsUntilSwitch: 0 })
	})
})
