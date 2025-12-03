# Retro TV (desiTV)

Retro TV is a simple MERN demo that mimics a retro television experience by streaming curated YouTube clips on themed channels. This repository includes a Vite + React client and an Express + MongoDB backend.

## Key Features
- Lightweight React + Vite frontend with simple TV UI components.
- Express API for channels, categories and auth.
- MongoDB-backed content model with a seeding script for example data.
- Dev-friendly setup with live-reload for server (`nodemon`) and client (`vite`).

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

## Next steps you might want me to help with
- Add a short CONTRIBUTING.md and CODE_OF_CONDUCT
- Add GitHub Actions for linting/testing and a deploy workflow
- Add a small README snippet inside `client/` explaining Vite env variables

---
If you'd like, I can also add a minimal `CONTRIBUTING.md` or update `README.md` with screenshots and more API examples. What would you like next?
