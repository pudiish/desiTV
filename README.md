# DesiTV™ 📺
### *Relive the 2000s. One Channel at a Time.*

[![Created by PudiIsh](https://img.shields.io/badge/Created%20by-PudiIsh-blue)](https://pudiish.github.io/pudi/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0077B5)](https://www.linkedin.com/in/swarnapudi-ishwar-baa1411b0/)
[![Made with Love](https://img.shields.io/badge/Made%20with-%E2%9D%A4%EF%B8%8F-red)](mailto:swarnapudiishwar@gmail.com)

---

> *"Woh 9XM pe gaane dekhna, SAB TV pe hasna, aur Emraan Hashmi ka latest song wait karna... those were the days."*

**DesiTV™** is a nostalgic retro TV streaming platform that recreates the golden era of Indian television - the 2000s when **9XM**, **SAB TV**, **MTV**, and **Channel V** ruled our screens. Built for **Millennials** and **Hybrid Gen-Z** who miss the simpler times.

## 🎬 What is DesiTV™?

DesiTV™ creates a **pseudo-live broadcast experience** where all users watching the same channel see the same content at the same time - just like real TV. No choosing, no seeking, no decision fatigue. Just sit back and vibe.

## ✨ Key Features
- 📺 **Retro TV UI** - CRT effects, scanlines, static noise, authentic TV sounds
- 📡 **Pseudo-Live Broadcast** - Synchronized viewing, everyone sees the same thing
- 🎵 **2000s Music Vibes** - Emraan Hashmi era, 9XM nostalgia, Atif Aslam classics
- 😂 **SAB TV Comedy** - Taarak Mehta, Sarabhai, Office Office
- 📱 **Session Recovery** - Resume where you left off
- ⚙️ **Admin Dashboard** - Full control over channels and content
- 🌙 **Late Night Mode** - Perfect for 2 AM vibes

## Quick links
- Project root: `./`
- Server: `./server`
- Client: `./client`

## Prerequisites
- Node.js (v18+ recommended)
- npm (or yarn)
- MongoDB instance (local or hosted)

## Environment variables
The server reads environment variables from a `.env` file. The project will load a `.env` at the repository root (preferred) and then `server/.env` (overrides root values) if present.

Common variables used by the project:
- `MONGO_URI` : MongoDB connection string (required for server and seed)
- `JWT_SECRET` : Secret for signing auth tokens (required for protected routes)
- `PORT` : Server port (default: `5002`)
- `VITE_CLIENT_PORT` : Client dev port used by Vite (e.g. `5173`)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` : Optional values used by `server/seed.js` when creating a default admin user

Example `.env` (project root):

```
MONGO_URI=mongodb://localhost:27017/retro-tv
JWT_SECRET=change_this_to_a_secure_value
PORT=5002
VITE_CLIENT_PORT=5173
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
```

## Installation
1. Install dependencies for the whole project and workspaces:

```bash
npm install
cd server && npm install
cd ../client && npm install
```

Alternatively, from the repo root you can run the following to install each package (preferred on CI):

```bash
npm install
npm --prefix server install
npm --prefix client install
```

## Development
- Start both client and server with hot-reload from the project root:

```bash
npm run dev
```

- Or run each side independently:

```bash
# Server (nodemon)
cd server && npm run dev

# Client (vite)
cd client && npm run dev
```

When running the client in dev mode, set `VITE_CLIENT_PORT` if you want a custom port.

## Production (build & run)
1. Build the client assets:

```bash
npm run build
```

2. Start the server (it will serve the API; static serving of client depends on server config):

```bash
npm start
```

Note: `npm run build` runs `cd client && npm run build` and `npm start` runs `node server/index.js` from the project root.

## Database seeding
To populate the database with example channels and a default admin, run the seed script:

```bash
cd server && npm run seed
# or from project root
npm --prefix server run seed
```

The seed script uses `MONGO_URI` and optional `ADMIN_USERNAME` / `ADMIN_PASSWORD` from your `.env`.

## API overview
- Health: `GET /health`
- Channels: `GET /api/channels` and related channel endpoints in `server/routes/channels.js`
- Auth: `POST /api/auth` and admin-related routes in `server/routes/auth.js`
- Categories: `GET /api/categories` in `server/routes/categories.js`
- YouTube helper endpoints: `server/routes/youtube.js`

Check the `server/routes` folder for full route details.

## Project structure (top-level)
- `client/` — Vite + React frontend
- `server/` — Express API, models, routes, and seed script
- `start.sh` — helper shell script (present in root)

## Development notes
- The server will attempt to load `.env` from the project root first, then `server/.env`. This makes it easy to run both local and CI setups.
- Dev convenience: `npm run dev` from the repository root launches both the server and client concurrently.

## Contributing
- Open an issue or pull request with a clear description and steps to reproduce.
- Keep changes focused and add/update tests or a brief manual verification checklist where appropriate.

---

## 👨‍💻 Created By

**Swarnapudi Ishwar** (PudiIsh)

| | |
|---|---|
| 💼 LinkedIn | [linkedin.com/in/swarnapudi-ishwar-baa1411b0](https://www.linkedin.com/in/swarnapudi-ishwar-baa1411b0/) |
| 🌐 Portfolio | [pudiish.github.io/pudi](https://pudiish.github.io/pudi/) |
| 📧 Email | [swarnapudiishwar@gmail.com](mailto:swarnapudiishwar@gmail.com) |
| 🐙 GitHub | [github.com/pudiish](https://github.com/pudiish) |

### Why I Built This

> *"I missed the 9XM days, Emraan Hashmi era songs, SAB TV laughs. Built DesiTV™ to chill like we used to - when TV was simple and everyone watched together."*

---

## 📄 License

**DesiTV™** is a trademark of Swarnapudi Ishwar (PudiIsh).  
This project is open source under the MIT License.

```
Copyright © 2025 Swarnapudi Ishwar (PudiIsh)
All rights reserved.

DesiTV™ - Relive the 2000s. One Channel at a Time.
```

---

<p align="center">
  <b>DesiTV™</b> - Made with ❤️ for the 2000s generation
  <br>
  <i>"Chill karo. TV pe kuch chal raha hai."</i>
</p>
