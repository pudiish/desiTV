#!/usr/bin/env bash
# DesiTV Development Server Startup
# Initializes dependencies, validates environment, and starts dev servers
# Usage: ./start.sh

set -euo pipefail

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
RESET='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to check and install npm packages
check_and_install_npm() {
  local dir=$1
  local name=$2
  
  if [ ! -d "$dir/node_modules" ]; then
    echo "📦 Installing $name dependencies..."
    cd "$dir"
    npm install
    cd "$SCRIPT_DIR"
    echo "✅ $name dependencies installed"
    echo "💡 Tip: Run 'npm audit fix' manually in $dir/ if needed"
  else
    echo "✅ $name dependencies already installed"
  fi
}

# Function to start Redis (optional: app uses in-memory cache if Redis unavailable)
start_redis() {
  if redis-cli ping &>/dev/null; then
    echo "✅ Redis is already running"
    return 0
  fi

  if ! command -v redis-server &> /dev/null; then
    echo "ℹ️  Redis not installed (optional – in-memory cache will be used)"
    return 0
  fi

  # Only try to start if REDIS_URL suggests local Redis
  local url="${REDIS_URL:-}"
  if [[ -n "$url" && "$url" == *"localhost"* ]] || [[ -z "$url" ]]; then
    echo "🚀 Starting Redis server..."
    if [[ "$OSTYPE" == "darwin"* ]] && command -v brew &> /dev/null; then
      brew services start redis 2>/dev/null || redis-server --daemonize yes 2>/dev/null
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
      ( command -v systemctl &> /dev/null && sudo systemctl start redis-server 2>/dev/null ) || redis-server --daemonize yes 2>/dev/null
    else
      redis-server --daemonize yes 2>/dev/null
    fi
    sleep 1
    if redis-cli ping &> /dev/null; then
      echo "✅ Redis started"
      return 0
    fi
  fi

  echo "ℹ️  Redis not running (optional – in-memory cache will be used)"
  return 0
}

# Check and install all dependencies
echo "🔍 Checking dependencies..."
echo ""

# Check root dependencies (concurrently for npm run dev)
echo "[1/3] Root (concurrently)..."
check_and_install_npm "." "root"

# Check client dependencies (Vite, React)
echo "[2/3] Client (Vite, React)..."
check_and_install_npm "client" "client"

# Check server dependencies (Express, Mongoose, etc.)
echo "[3/3] Server (Express, Mongoose)..."
check_and_install_npm "server" "server"

# Redis: optional (server uses in-memory cache if unavailable)
if command -v redis-server &>/dev/null; then
  echo "ℹ️  Redis: found (will try to start if REDIS_URL points to localhost)"
else
  echo "ℹ️  Redis: not installed (optional – in-memory cache will be used)"
fi

echo ""
echo "✅ Dependencies ready"
echo ""

# Load or create .env file
if [ ! -f .env ]; then
  echo "📝 Creating .env from template..."
  cat > .env << 'EOF'
# DesiTV Environment
# Required
MONGO_URI=mongodb://localhost:27017/desitv
JWT_SECRET=dev-secret-change-in-production

# Server
PORT=5000
VITE_CLIENT_PORT=5173

# Optional: Redis (in-memory cache used if unset)
# REDIS_URL=redis://localhost:6379

# Optional: YouTube (metadata, thumbnails)
# YOUTUBE_API_KEY=

# Optional: Google AI / Gemini (DesiAgent chat)
# GOOGLE_AI_KEY=

# Optional: Admin (for seed.js)
# ADMIN_USERNAME=admin
# ADMIN_PASSWORD=
EOF
  echo "✅ .env created. Edit MONGO_URI and JWT_SECRET if needed."
  echo ""
fi

echo "📁 Loading .env from project root"
set -a
if [ -r .env ]; then
  source .env 2>/dev/null || {
    if [ -r .env.local ]; then
      source .env.local 2>/dev/null || true
    fi
  }
elif [ -r .env.local ]; then
  source .env.local 2>/dev/null || true
fi
set +a

# Defaults for ports only
PORT="${PORT:-5000}"
VITE_CLIENT_PORT="${VITE_CLIENT_PORT:-5173}"

# Export for child processes (server uses dotenv; exports for concurrent dev)
export PORT VITE_CLIENT_PORT NODE_ENV="${NODE_ENV:-development}"
export MONGO_URI JWT_SECRET YOUTUBE_API_KEY GOOGLE_AI_KEY
export REDIS_URL REDIS_FALLBACK_ENABLED ADMIN_USERNAME ADMIN_PASSWORD

# Bootstrap .env: add PORT/VITE_CLIENT_PORT only if missing
if [ -f .env ]; then
  grep -q "^PORT=" .env 2>/dev/null || echo "PORT=$PORT" >> .env
  grep -q "^VITE_CLIENT_PORT=" .env 2>/dev/null || echo "VITE_CLIENT_PORT=$VITE_CLIENT_PORT" >> .env
fi

REDIS_INFO="${REDIS_URL:+Redis: yes}"
REDIS_INFO="${REDIS_INFO:-Redis: no (in-memory)}"
echo "✅ Env loaded — PORT=$PORT, VITE_CLIENT_PORT=$VITE_CLIENT_PORT, $REDIS_INFO"

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

# Function to check if a port is free (not listening)
is_port_free() {
  local port=$1
  # Check if port is listening - use timeout to prevent hanging
  local result
  result=$(lsof -ti:$port -sTCP:LISTEN 2>/dev/null)
  [ -z "$result" ]
}

# Function to find next available port starting from a given port
find_free_port() {
  local start_port=$1
  local max_attempts=20
  local current_port=$start_port
  local attempts=0
  
  while [ $attempts -lt $max_attempts ]; do
    # Quick check - if no listening process, port is free
    if ! lsof -ti:$current_port -sTCP:LISTEN >/dev/null 2>&1; then
      echo $current_port
      return 0
    fi
    current_port=$((current_port + 1))
    attempts=$((attempts + 1))
  done
  
  # If no free port found, return original
  echo $start_port
  return 1
}

# Function to kill process on a port
kill_port() {
  local port=$1
  local name=$2
  
  # Check if port is actually listening (not just open)
  # Use lsof with LISTEN state filter to find processes actually listening
  local listening_pids=$(lsof -ti:$port -sTCP:LISTEN 2>/dev/null)
  
  # If no listening processes, check for any process using the port
  if [ -z "$listening_pids" ]; then
    listening_pids=$(lsof -ti:$port 2>/dev/null)
  fi
  
  if [ -n "$listening_pids" ]; then
    echo "🔍 Port $port ($name) is in use, finding and killing process..."
    
    # Get all PIDs using the port
    local pids=$(echo "$listening_pids" | sort -u)
    if [ -n "$pids" ]; then
      for pid in $pids; do
        local proc_info=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        local proc_path=$(ps -p $pid -o command= 2>/dev/null | head -c 60 || echo "")
        
        # Check if it's a system process
        if [[ "$proc_path" == *"/System/Library"* ]] || [[ "$proc_path" == *"/usr/libexec"* ]]; then
          echo "   ⚠️  Skipping system process PID $pid ($proc_info)"
          echo "   💡 Tip: System processes may be using this port. Consider changing PORT in .env"
          continue
        fi
        
        echo "   Killing PID $pid ($proc_info)"
        # Try graceful kill first
        kill $pid 2>/dev/null || true
        sleep 0.3
        # Force kill if still running
        if kill -0 $pid 2>/dev/null; then
          kill -9 $pid 2>/dev/null || true
        fi
      done
      
      # Wait longer for port to be released, with multiple checks
      local wait_count=0
      local max_wait=15
      while [ $wait_count -lt $max_wait ]; do
        if ! lsof -ti:$port >/dev/null 2>&1; then
          break
        fi
        sleep 0.5
        wait_count=$((wait_count + 1))
      done
      
      # Final check - only check for listening processes
      local still_listening=$(lsof -ti:$port -sTCP:LISTEN 2>/dev/null)
      if [ -n "$still_listening" ]; then
        local remaining_pids=$(echo "$still_listening" | tr '\n' ' ')
        echo "   ⚠️  Warning: Port $port is still listening on PIDs: $remaining_pids"
        return 1
      else
        echo "   ✅ Port $port is now free"
        return 0
      fi
    fi
  else
    echo "✅ Port $port ($name) is free"
    return 0
  fi
}

# Clean up and find available ports
echo "🧹 Checking and cleaning up ports..."

# Store original ports
ORIGINAL_SERVER_PORT=$SERVER_PORT
ORIGINAL_CLIENT_PORT=$CLIENT_PORT

# Quick check and kill non-system processes on ports
echo "Checking port $SERVER_PORT (server)..."
pids=$(lsof -ti:$SERVER_PORT -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$pids" ]; then
  echo "   Port $SERVER_PORT is in use, attempting to free it..."
  for pid in $pids; do
    proc_path=$(ps -p $pid -o command= 2>/dev/null | head -c 60 || echo "")
    if [[ "$proc_path" != *"/System/Library"* ]] && [[ "$proc_path" != *"/usr/libexec"* ]]; then
      echo "   Killing PID $pid"
      kill -9 $pid 2>/dev/null || true
    else
      echo "   Skipping system process PID $pid"
    fi
  done
  sleep 1
else
  echo "   ✅ Port $SERVER_PORT is free"
fi

echo "Checking port $CLIENT_PORT (client)..."
pids=$(lsof -ti:$CLIENT_PORT -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$pids" ]; then
  echo "   Port $CLIENT_PORT is in use, attempting to free it..."
  for pid in $pids; do
    proc_path=$(ps -p $pid -o command= 2>/dev/null | head -c 60 || echo "")
    if [[ "$proc_path" != *"/System/Library"* ]] && [[ "$proc_path" != *"/usr/libexec"* ]]; then
      echo "   Killing PID $pid"
      kill -9 $pid 2>/dev/null || true
    else
      echo "   Skipping system process PID $pid"
    fi
  done
sleep 1
else
  echo "   ✅ Port $CLIENT_PORT is free"
fi

# Check if ports are free, if not find alternative ports
if ! is_port_free "$SERVER_PORT"; then
  echo "🔍 Port $SERVER_PORT (server) is still in use, finding alternative..."
  NEW_SERVER_PORT=$(find_free_port $SERVER_PORT)
  if [ "$NEW_SERVER_PORT" != "$SERVER_PORT" ]; then
    echo "   ✅ Found free port: $NEW_SERVER_PORT"
    SERVER_PORT=$NEW_SERVER_PORT
    PORT=$NEW_SERVER_PORT
  else
    echo "   ⚠️  Could not find free port nearby, will try to use $SERVER_PORT anyway"
  fi
else
  echo "✅ Port $SERVER_PORT (server) is free"
fi

if ! is_port_free "$CLIENT_PORT"; then
  echo "🔍 Port $CLIENT_PORT (client) is still in use, finding alternative..."
  NEW_CLIENT_PORT=$(find_free_port $CLIENT_PORT)
  if [ "$NEW_CLIENT_PORT" != "$CLIENT_PORT" ]; then
    echo "   ✅ Found free port: $NEW_CLIENT_PORT"
    CLIENT_PORT=$NEW_CLIENT_PORT
    VITE_CLIENT_PORT=$NEW_CLIENT_PORT
  else
    echo "   ⚠️  Could not find free port nearby, will try to use $CLIENT_PORT anyway"
  fi
else
  echo "✅ Port $CLIENT_PORT (client) is free"
fi

# Update .env if ports changed
PORTS_CHANGED=false
if [ "$SERVER_PORT" != "$ORIGINAL_SERVER_PORT" ]; then
  echo "📝 Updating .env: PORT=$SERVER_PORT (was $ORIGINAL_SERVER_PORT)"
  # Update or add PORT in .env
  if grep -q "^PORT=" .env 2>/dev/null; then
    sed -i.bak "s/^PORT=.*/PORT=$SERVER_PORT/" .env && rm -f .env.bak 2>/dev/null || \
    sed -i '' "s/^PORT=.*/PORT=$SERVER_PORT/" .env 2>/dev/null
  else
    echo "PORT=$SERVER_PORT" >> .env
  fi
  PORTS_CHANGED=true
fi

if [ "$CLIENT_PORT" != "$ORIGINAL_CLIENT_PORT" ]; then
  echo "📝 Updating .env: VITE_CLIENT_PORT=$CLIENT_PORT (was $ORIGINAL_CLIENT_PORT)"
  # Update or add VITE_CLIENT_PORT in .env
  if grep -q "^VITE_CLIENT_PORT=" .env 2>/dev/null; then
    sed -i.bak "s/^VITE_CLIENT_PORT=.*/VITE_CLIENT_PORT=$CLIENT_PORT/" .env && rm -f .env.bak 2>/dev/null || \
    sed -i '' "s/^VITE_CLIENT_PORT=.*/VITE_CLIENT_PORT=$CLIENT_PORT/" .env 2>/dev/null
  else
    echo "VITE_CLIENT_PORT=$CLIENT_PORT" >> .env
  fi
  PORTS_CHANGED=true
fi

if [ "$PORTS_CHANGED" = true ]; then
  echo "✅ Port configuration updated in .env"
  echo "🔄 Reloading .env with new port values..."
  set -a
  source .env
  set +a
  echo ""
fi

# Export the port values for use in the script (ensure they're set)
export PORT=${PORT:-$SERVER_PORT}
export VITE_CLIENT_PORT=${VITE_CLIENT_PORT:-$CLIENT_PORT}

# Update local variables to match exported values
SERVER_PORT=$PORT
CLIENT_PORT=$VITE_CLIENT_PORT

echo "✅ Using ports: Server=$SERVER_PORT, Client=$CLIENT_PORT"
echo ""

# Verify required environment variables (only MONGO_URI and JWT_SECRET)
echo "🔍 Verifying environment variables..."
MISSING=()
[ -z "${MONGO_URI:-}" ] && MISSING+=("MONGO_URI")
[ -z "${JWT_SECRET:-}" ] && MISSING+=("JWT_SECRET")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "❌ Missing required variables: ${MISSING[*]}"
  echo "   Add them to .env. Example: MONGO_URI=mongodb://localhost:27017/desitv  JWT_SECRET=your-secret"
  exit 1
fi

echo "✅ Required: MONGO_URI, JWT_SECRET"
# Optional: warn if missing (features degraded)
[ -z "${YOUTUBE_API_KEY:-}" ] && echo "   ⚠️  YOUTUBE_API_KEY not set — metadata/thumbnails may be limited"
[ -z "${GOOGLE_AI_KEY:-}" ]   && echo "   ⚠️  GOOGLE_AI_KEY not set — DesiAgent chat will not work"
[ -z "${ADMIN_USERNAME:-}" ]  && echo "   ℹ️  ADMIN_USERNAME not set — required only for seed.js"
echo ""
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
echo "║  📱 To access from mobile:                                    ║"
printf "║     Open http://%-15s:%-6s on your phone         ║\n" "$LOCAL_IP" "$CLIENT_PORT"
echo "║                                                               ║"
# Beautiful startup banner
show_startup_banner() {
  echo -e ""
  echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${MAGENTA}║${RESET}                  ${BOLD}🎬 DesiTV Development Server${RESET}                 ${MAGENTA}║${RESET}"
  echo -e "${MAGENTA}╠═══════════════════════════════════════════════════════════════╣${RESET}"
  echo -e "${MAGENTA}║${RESET}                                                               ${MAGENTA}║${RESET}"
  echo -e "${MAGENTA}║${RESET}  ${CYAN}📺 Your Indian Entertainment Hub${RESET}                         ${MAGENTA}║${RESET}"
  echo -e "${MAGENTA}║${RESET}                                                               ${MAGENTA}║${RESET}"
  echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${RESET}"
  echo -e ""
}

echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Show startup banner
show_startup_banner

echo "🚀 Initializing services..."
echo ""

# Start Redis
start_redis

echo ""
echo -e "${GREEN}✅ All systems ready!${RESET}"
echo -e "${CYAN}Starting development servers...${RESET}"
echo ""

# Start the dev servers
exec npm run dev
