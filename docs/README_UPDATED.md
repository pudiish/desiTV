# Retro TV — Simplified (Updated README)

This repository implements the simplified Retro TV web app per your requirements.

Key points
- Channels = categories (Music, Movies, Cartoons, etc.)
- Pseudo-live playback: backend stores `playlistStartEpoch`; frontend calculates current video and offset
- No decades, no auth, simple Admin UI for adding/removing channels and videos

Quick start
1. Install dependencies

```bash
npm install
cd server && npm install
cd ../client && npm install
```

2. Create `.env` at repo root (example shown below). You requested a single env file — do not add `.env.example`.

```env
MONGO_URI=mongodb://localhost:27017/retro-tv
JWT_SECRET=replace_with_strong_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
PORT=5002
VITE_API_BASE=http://localhost:5002
VITE_CLIENT_PORT=5173
# Optional: YOUTUBE_API_KEY=your_key_here
```

3. Seed sample data (optional)

```bash
cd server
npm run seed
```

4. Start dev servers

```bash
# from repo root
npm run dev
# or individually
cd server && npm run dev
cd client && npm run dev
```

API endpoints
- `GET /api/channels` — list channels
- `GET /api/channels/:id` — channel data
- `GET /api/channels/:id/current` — current pseudo-live item + offset
- `POST /api/channels` — create channel
- `POST /api/channels/:id/videos` — add video
- `DELETE /api/channels/:id/videos/:videoId` — delete video
- `POST /api/youtube/metadata` — (optional) fetch video metadata (requires `YOUTUBE_API_KEY` in `.env`)

Notes & next steps I can take
- Add README to explain pseudo-live calculation details
- Add unit tests for `getPseudoLiveItem`
- Wire server-side metadata into Admin UI (auto-fill title/duration)
- Add basic authentication if you later want to protect admin routes

If you want this README to replace the existing `README.md`, I can rename it now.
