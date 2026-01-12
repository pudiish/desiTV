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

# Function to check and install Python packages
check_and_install_python() {
  if [ -f "scripts/requirements.txt" ]; then
    if ! python3 -c "import pymongo" 2>/dev/null || ! python3 -c "import dotenv" 2>/dev/null; then
      echo "📦 Installing Python dependencies..."
      if command -v pip3 &> /dev/null; then
        pip3 install -r scripts/requirements.txt
        echo "✅ Python dependencies installed"
      elif command -v pip &> /dev/null; then
        pip install -r scripts/requirements.txt
        echo "✅ Python dependencies installed"
      else
        echo "⚠️  Warning: pip not found. Skipping Python dependencies."
      fi
    else
      echo "✅ Python dependencies already installed"
    fi
  fi
}

# Function to check and install Redis
check_and_install_redis() {
  if command -v redis-server &> /dev/null; then
    echo "✅ Redis is already installed"
    return 0
  fi
  
  echo "📦 Redis not found. Installing Redis..."
  
  # Check if we're on macOS
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # Check if Homebrew is installed
    if command -v brew &> /dev/null; then
      echo "🍎 Installing Redis via Homebrew..."
      brew install redis
      echo "✅ Redis installed successfully"
      return 0
    else
      echo "⚠️  Homebrew not found. Please install Redis manually:"
      echo "   1. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
      echo "   2. Install Redis: brew install redis"
      return 1
    fi
  # Check if we're on Linux
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Installing Redis via package manager..."
    if command -v apt-get &> /dev/null; then
      sudo apt-get update
      sudo apt-get install -y redis-server
      echo "✅ Redis installed successfully"
      return 0
    elif command -v yum &> /dev/null; then
      sudo yum install -y redis
      echo "✅ Redis installed successfully"
      return 0
    else
      echo "⚠️  Could not detect package manager. Please install Redis manually."
      return 1
    fi
  else
    echo "⚠️  Unsupported OS. Please install Redis manually."
    return 1
  fi
}

# Function to start Redis
start_redis() {
  # Check if Redis is already running
  if redis-cli ping &> /dev/null; then
    echo "✅ Redis is already running"
    return 0
  fi
  
  echo "🚀 Starting Redis server..."
  
  # Check if we're on macOS
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &> /dev/null; then
      brew services start redis
      sleep 1
      if redis-cli ping &> /dev/null; then
        echo "✅ Redis started successfully"
        return 0
      else
        echo "⚠️  Failed to start Redis via Homebrew. Trying direct command..."
        redis-server --daemonize yes
        sleep 1
        if redis-cli ping &> /dev/null; then
          echo "✅ Redis started successfully"
          return 0
        fi
      fi
    else
      redis-server --daemonize yes
      sleep 1
      if redis-cli ping &> /dev/null; then
        echo "✅ Redis started successfully"
        return 0
      fi
    fi
  # Check if we're on Linux
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo systemctl start redis-server
    sleep 1
    if redis-cli ping &> /dev/null; then
      echo "✅ Redis started successfully"
      return 0
    fi
  fi
  
  echo "⚠️  Could not start Redis. Please start it manually."
  return 1
}

# Check and install all dependencies
echo "🔍 Checking dependencies..."
echo ""

# Check root dependencies
echo "[1/5] Checking root dependencies..."
check_and_install_npm "." "root"

# Check client dependencies
echo "[2/5] Checking client dependencies..."
check_and_install_npm "client" "client"

# Check server dependencies
echo "[3/5] Checking server dependencies..."
check_and_install_npm "server" "server"

# Check Python dependencies
echo "[4/5] Checking Python dependencies..."
check_and_install_python

# Check and install Redis
echo "[5/5] Checking Redis..."
check_and_install_redis

echo ""
echo "✅ All dependencies checked and installed"
echo ""

# Load or create .env file
if [ ! -f .env ]; then
  echo "📝 Creating .env file with default values..."
  cat > .env << 'EOF'
# DesiTV Environment Configuration
# Server Configuration
PORT=5000
VITE_CLIENT_PORT=5173

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Database (add your MongoDB URI)
# MONGO_URI=mongodb://localhost:27017/desitv

# Other environment variables can be added here
EOF
  echo "✅ .env file created with default values"
  echo "⚠️  Please update MONGO_URI and other variables as needed"
  echo ""
fi

  echo "📁 Loading .env from project root"
  set -a
  source .env
  set +a

# Set defaults if not provided
PORT="${PORT:-5000}"
VITE_CLIENT_PORT="${VITE_CLIENT_PORT:-5173}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

# Export critical environment variables for child processes
export MONGO_URI
export JWT_SECRET
export ADMIN_USERNAME
export ADMIN_PASSWORD
export YOUTUBE_API_KEY
export VITE_CLIENT_PORT
export PORT
export REDIS_URL
export REDIS_FALLBACK_ENABLED
export GOOGLE_AI_KEY
export NODE_ENV="${NODE_ENV:-development}"

# Update .env if values were missing
if ! grep -q "^PORT=" .env 2>/dev/null; then
  echo "PORT=$PORT" >> .env
fi
if ! grep -q "^VITE_CLIENT_PORT=" .env 2>/dev/null; then
  echo "VITE_CLIENT_PORT=$VITE_CLIENT_PORT" >> .env
fi
if ! grep -q "^REDIS_URL=" .env 2>/dev/null; then
  echo "REDIS_URL=$REDIS_URL" >> .env
fi

echo "✅ Environment variables loaded (PORT=$PORT, VITE_CLIENT_PORT=$VITE_CLIENT_PORT, REDIS_URL=$REDIS_URL)"

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

# Verify all critical environment variables are set
echo "🔍 Verifying environment variables..."
MISSING_VARS=()

# Use safe parameter expansion to avoid "unbound variable" errors
if [ -z "${MONGO_URI:-}" ]; then MISSING_VARS+=("MONGO_URI"); fi
if [ -z "${GOOGLE_AI_KEY:-}" ]; then MISSING_VARS+=("GOOGLE_AI_KEY"); fi
if [ -z "${YOUTUBE_API_KEY:-}" ]; then MISSING_VARS+=("YOUTUBE_API_KEY"); fi
if [ -z "${JWT_SECRET:-}" ]; then MISSING_VARS+=("JWT_SECRET"); fi
if [ -z "${ADMIN_USERNAME:-}" ]; then MISSING_VARS+=("ADMIN_USERNAME"); fi
if [ -z "${ADMIN_PASSWORD:-}" ]; then MISSING_VARS+=("ADMIN_PASSWORD"); fi
if [ -z "${REDIS_URL:-}" ]; then MISSING_VARS+=("REDIS_URL"); fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "❌ ERROR: Missing environment variables:"
  printf '   - %s\n' "${MISSING_VARS[@]}"
  echo ""
  echo "💡 Tip: Update your .env file with the missing variables"
  exit 1
else
  echo "✅ All critical environment variables are loaded:"
  echo "   ✓ MONGO_URI=$(echo ${MONGO_URI:-} | cut -c1-40)..."
  echo "   ✓ GOOGLE_AI_KEY=$(echo ${GOOGLE_AI_KEY:-} | cut -c1-20)..."
  echo "   ✓ YOUTUBE_API_KEY=$(echo ${YOUTUBE_API_KEY:-} | cut -c1-20)..."
  echo "   ✓ JWT_SECRET=$(echo ${JWT_SECRET:-} | cut -c1-20)..."
  echo "   ✓ ADMIN_USERNAME=${ADMIN_USERNAME:-}"
  echo "   ✓ REDIS_URL=${REDIS_URL:-}"
fi
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
echo "║  �� To access from mobile:                                    ║"
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
