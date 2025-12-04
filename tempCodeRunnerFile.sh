#!/usr/bin/env bash
# start.sh - load project .env and run dev servers
# Usage: ./start.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f .env ]; then
  echo "Loading .env from project root"
  # export all variables in .env to environment for child processes
  set -a
  # shellcheck disable=SC1090
  source .env
  set +a
fi

echo "Starting dev servers (root: npm run dev)"
npm run dev
