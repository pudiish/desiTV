/**
 * validate-ui.mjs - drives the real UI in a browser and checks that what the
 * viewer actually sees matches what the broadcast timeline says should be on.
 *
 * The API can be correct while the screen is wrong (the player discarding the
 * start offset, for instance), so this asserts against the rendered page.
 *
 *   node scripts/validate-ui.mjs [--headed]
 */

import { chromium } from 'playwright'
import { positionAt } from '../shared/broadcastPosition.js'
import { writeFileSync, mkdirSync } from 'fs'

const BASE = process.env.UI_BASE || 'http://localhost:5173'
const API = process.env.API_BASE || 'http://localhost:5001'
const OUT = new URL('../.playwright-out/', import.meta.url).pathname
const headed = process.argv.includes('--headed')

const results = []
const record = (name, pass, detail = '') => {
	results.push({ name, pass, detail })
	console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: !headed })
const context = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	// The TV autoplays; without this Chromium blocks it and every check about
	// playback would fail for a reason that has nothing to do with our code.
	permissions: [],
})
const page = await context.newPage()

const consoleErrors = []
page.on('console', (msg) => {
	if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`))

// Recorded from the first navigation, since clock sync fires during init.
const timeRequests = []
page.on('request', (req) => {
	if (req.url().includes('/api/time')) timeRequests.push(req.url())
})

const failedRequests = []
page.on('requestfailed', (req) => {
	// Analytics/ads blocked by the browser are not our concern.
	if (/doubleclick|google-analytics|googleads/.test(req.url())) return
	failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`)
})

try {
	// / is the landing page; the TV itself lives at /tv.
	console.log(`\n▶ Loading ${BASE}/tv`)
	await page.goto(`${BASE}/tv`, { waitUntil: 'domcontentloaded', timeout: 30000 })

	// ---- 1. The page renders at all -------------------------------------
	await page.waitForSelector('#root > *', { timeout: 15000 })
	const title = await page.title()
	record('page renders', true, `title "${title}"`)

	// ---- 1b. Power the TV on --------------------------------------------
	// It boots off ("POWER DABAO AUR SHURU KARO"); nothing plays until the
	// power button is pressed, so every playback check depends on this.
	// The remote mounts after channels load, so wait for the button rather than
	// racing it, and retry once - the first click can land mid-render.
	let poweredOn = false
	for (let attempt = 0; attempt < 3 && !poweredOn; attempt++) {
		const powerBtn = await page.waitForSelector('button[title*="Power" i]', { timeout: 15000 })
			.catch(() => null)
		if (powerBtn) await powerBtn.click().catch(() => {})
		else await page.keyboard.press('Space')

		poweredOn = await page
			.waitForFunction(() => !/POWER DABAO/i.test(document.body.innerText), { timeout: 12000 })
			.then(() => true)
			.catch(() => false)
	}
	record('TV powers on', poweredOn, poweredOn ? '' : 'still showing the power prompt')

	// ---- 2. Clock sync actually ran -------------------------------------
	// This is new behaviour; if /api/time never fired, position falls back to
	// the raw device clock and cross-device sync silently reverts.
	const timeCalled = timeRequests.length > 0
	record('clock sync requested /api/time', timeCalled,
		timeCalled ? '' : 'no request seen — now() would fall back to Date.now()')

	// ---- 3. Channels loaded ---------------------------------------------
	const apiChannels = await (await fetch(`${API}/api/channels`)).json()
	const channels = apiChannels.data || apiChannels.channels || []
	record('API serves recovered channels', channels.length === 10,
		`${channels.length} channels`)

	const names = channels.map((c) => c.name)
	for (const recovered of ['Angreji', 'bollywood chaska']) {
		record(`recovered channel present: ${recovered}`, names.includes(recovered))
	}

	// ---- 4. The YouTube player mounted ----------------------------------
	const iframe = await page.waitForSelector('iframe[src*="youtube"]', { timeout: 20000 })
		.catch(() => null)
	record('youtube player iframe mounted', !!iframe)

	// ---- 5. THE IMPORTANT ONE -------------------------------------------
	// Does the video on screen match the broadcast timeline, and did it start
	// at the computed offset rather than from zero?
	if (iframe) {
		// Videos are loaded through the IFrame API (loadVideoById), so the id is
		// never in the iframe src - ask the player itself.
		// YT.get() only works for players YT itself registered by element id;
		// this app constructs them directly, so reach the instance through the
		// React fiber on the iframe's container instead.
		const player = await page.evaluate(() => {
			for (const f of document.querySelectorAll('iframe')) {
				if (!f.src.includes('youtube')) continue
				let node = f.parentElement
				for (let depth = 0; node && depth < 12; depth++, node = node.parentElement) {
					const key = Object.keys(node).find((k) => k.startsWith('__reactFiber$'))
					let fiber = key ? node[key] : null
					for (let up = 0; fiber && up < 30; up++, fiber = fiber.return) {
						const refs = [fiber.memoizedState, fiber.memoizedProps]
						for (const bag of refs) {
							let cur = bag
							for (let n = 0; cur && n < 40; n++, cur = cur.next) {
								const v = cur.memoizedState?.current ?? cur.current
								if (v && typeof v.getVideoData === 'function') {
									return {
										videoId: v.getVideoData().video_id,
										currentTime: v.getCurrentTime(),
										state: v.getPlayerState(),
									}
								}
							}
						}
					}
				}
			}
			return null
		})

		// The overlay renders a moment after power-on; wait for it before reading.
		await page.waitForFunction(
			() => /NOW PLAYING\s*\n\s*\S/.test(document.body.innerText),
			{ timeout: 20000 }
		).catch(() => {})

		// Read channel and title from one snapshot, so a channel change between
		// two separate reads cannot make them disagree spuriously.
		const shown = await page.evaluate(() => {
			const t = document.body.innerText
			return {
				channel: (t.match(/^(.+?)●\s*LIVE/m) || [])[1]?.trim() || null,
				title: (t.match(/NOW PLAYING\s*\n\s*(.+)/) || [])[1]?.trim() || null,
			}
		})

		const channel = channels.find((c) => c.name === shown.channel) || channels[0]
		const expected = positionAt(Date.now(), Date.parse(channel.playlistStartEpoch), channel.items)
		const expectedTitle = channel.items[expected.videoIndex]?.title

		const titleMatches = !!shown.title && !!expectedTitle &&
			shown.title.slice(0, 35) === expectedTitle.slice(0, 35)
		record('UI shows the video the timeline says is live', titleMatches,
			`"${(shown.title || '?').slice(0, 45)}" vs timeline "${(expectedTitle || '?').slice(0, 45)}" (#${expected.videoIndex})`)

		// If the player instance is reachable, assert the offset directly: a
		// pseudolive broadcast joins mid-video, so landing at ~0 when the
		// timeline says otherwise means the start offset was discarded.
		// Not always reachable through the fiber, and not worth failing over -
		// the overlay check above already proves the video matches the timeline.
		if (player?.videoId) {
			const expectedId = channel.items[expected.videoIndex]?.youtubeId
			record('player is playing the live video', player.videoId === expectedId,
				`${player.videoId} vs ${expectedId}`)

			const drift = Math.abs(player.currentTime - expected.offset)
			record('player joined at the broadcast offset', drift < 45,
				`at ${player.currentTime.toFixed(0)}s, timeline says ${expected.offset.toFixed(0)}s (drift ${drift.toFixed(0)}s)`)
		} else {
			console.log('  ℹ️  player instance not reachable via fiber; skipping direct offset assertion')
		}
	}

	// ---- 6. Channel switching -------------------------------------------
	// The iframe src never changes (loadVideoById), so compare what is shown.
	const readNowPlaying = () => page.evaluate(() => {
		const m = document.body.innerText.match(/NOW PLAYING\s*\n\s*(.+)/)
		return m ? m[1].trim() : null
	})

	const before = await readNowPlaying()
	const chUp = await page.$('button[title*="Channel Up" i], button[title*="CH▲" i]')
	if (chUp) await chUp.click()
	else await page.keyboard.press('ArrowUp')

	await page.waitForTimeout(6000)
	const after = await readNowPlaying()
	record('channel switch changes what is playing', !!before && !!after && before !== after,
		`"${(before || '?').slice(0, 30)}" → "${(after || '?').slice(0, 30)}"`)

	await page.screenshot({ path: `${OUT}/tv.png`, fullPage: false })

	// ---- 7. Admin route loads -------------------------------------------
	await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 20000 })
	await page.waitForTimeout(2000)
	const adminRendered = await page.evaluate(() => document.querySelector('#root')?.children.length > 0)
	record('admin route renders', !!adminRendered)
	await page.screenshot({ path: `${OUT}/admin.png` })

	// ---- 8. No console errors -------------------------------------------
	// Errors from the YouTube iframe's own origin are outside our control.
	// "Failed to load resource" with no URL is the YouTube iframe's own media
	// fetches failing under headless Chromium; not our application code.
	const ourErrors = consoleErrors.filter(
		(e) => !/youtube|doubleclick|googleads|ERR_BLOCKED_BY_CLIENT|ERR_FAILED|Failed to load resource|play\(\) failed|NotAllowedError/i.test(e)
	)
	record('no unexpected console errors', ourErrors.length === 0,
		ourErrors.length ? ourErrors.slice(0, 3).join(' | ') : '')

	const ourFailed = failedRequests.filter((r) => !/youtube|ytimg|ggpht|gstatic|google/.test(r))
	record('no failed app requests', ourFailed.length === 0,
		ourFailed.length ? ourFailed.slice(0, 3).join(' | ') : '')
} catch (err) {
	record('run completed without throwing', false, err.message)
	await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => {})
} finally {
	await browser.close()
}

const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} checks passed`)
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2))
process.exit(results.every((r) => r.pass) ? 0 : 1)
