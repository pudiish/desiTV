#!/usr/bin/env bash
# start.sh - load project .env and run dev servers with network access
# Usage: ./start.sh
# 
# All configuration is loaded from .env file - no hardcoded values

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env file (required)
if [ -f .env ]; then
  echo "📁 Loading .env from project root"
  set -a
  source .env
  set +a
else
  echo "❌ Error: .env file not found!"
  echo "   Copy .env.example to .env and configure it."
  exit 1
fi

# Validate required env vars
if [ -z "${PORT:-}" ] || [ -z "${VITE_CLIENT_PORT:-}" ]; then
  echo "❌ Error: PORT and VITE_CLIENT_PORT must be set in .env"
  exit 1
fi

# Get local network IP
get_local_ip() {
  # macOS
  if command -v ipconfig &> /dev/null; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost"
  # Linux
  elif command -v hostname &> /dev/null; then
    hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost"
  else
    echo "localhost"
  fi
}

LOCAL_IP=$(get_local_ip)

# Use env vars from .env (no defaults)
CLIENT_PORT="$VITE_CLIENT_PORT"
SERVER_PORT="$PORT"

# Kill any existing processes on required ports
echo "🧹 Cleaning up ports $SERVER_PORT and $CLIENT_PORT..."
lsof -ti:$SERVER_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:$CLIENT_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
echo "✅ Ports cleared"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                🎬 DesiTV™ Development Server                  ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
echo "║  📺 Frontend (Vite):                                          ║"
printf "║     Local:   http://localhost:%-6s                         ║\n" "$CLIENT_PORT"
printf "║     Network: http://%-15s:%-6s                  ║\n" "$LOCAL_IP" "$CLIENT_PORT"
echo "║                                                               ║"
echo "║  🖥️  Backend (Express):                                        ║"
printf "║     Local:   http://localhost:%-6s                         ║\n" "$SERVER_PORT"
printf "║     Network: http://%-15s:%-6s                  ║\n" "$LOCAL_IP" "$SERVER_PORT"
echo "║                                                               ║"
echo "║  �� To access from mobile:                                    ║"
printf "║     Open http://%-15s:%-6s on your phone         ║\n" "$LOCAL_IP" "$CLIENT_PORT"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "🚀 Starting dev servers..."
echo ""

npm run dev
