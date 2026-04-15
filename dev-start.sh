#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# WorkNow — Development Environment Startup (macOS / Linux)
# Usage: ./dev-start.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo ""
echo "============================================================"
echo "  WorkNow — Development Environment Startup"
echo "============================================================"
echo ""

# ── 1. Java ──────────────────────────────────────────────────
echo "[1/6] Checking Java..."
if ! command -v java &>/dev/null; then
  err "Java not found. Install Java 21:\n  macOS: brew install --cask temurin@21\n  Ubuntu: sudo apt install openjdk-21-jdk"
fi
JAVA_VER=$(java -version 2>&1 | awk -F'"' '/version/ {print $2}')
ok "Java $JAVA_VER"

# ── 2. Node.js ───────────────────────────────────────────────
echo "[2/6] Checking Node.js..."
command -v node &>/dev/null || err "Node.js not found. Install: https://nodejs.org"
NODE_VER=$(node --version)
ok "Node.js $NODE_VER"
[[ "$NODE_VER" == v24* ]] && warn "Node 24 detected. Expo works best with Node 20 LTS.\n  Run: nvm use 20"

# ── 3. pnpm ──────────────────────────────────────────────────
echo "[3/6] Checking pnpm..."
if ! command -v pnpm &>/dev/null; then
  warn "pnpm not found. Installing..."
  npm install -g pnpm@9 || err "Failed to install pnpm"
fi
ok "pnpm $(pnpm --version)"

# ── 4. Firebase CLI ──────────────────────────────────────────
echo "[4/6] Checking Firebase CLI..."
if ! command -v firebase &>/dev/null; then
  warn "Firebase CLI not found. Installing..."
  npm install -g firebase-tools || err "Failed to install Firebase CLI"
fi
ok "Firebase CLI $(firebase --version)"

# ── 5. Install dependencies ───────────────────────────────────
echo "[5/6] Installing dependencies..."
pnpm install --frozen-lockfile
ok "Dependencies installed"

# ── 6. Build packages + functions ────────────────────────────
echo "[6/6] Building packages..."
pnpm turbo build --filter=@workfix/types --filter=@workfix/utils --filter=@workfix/config
(cd functions && pnpm build)
ok "All packages built (functions/dist/ ready)"

echo ""
echo "============================================================"
echo "  All checks passed! Choose a startup mode:"
echo "============================================================"
echo "  1) Firebase Emulators + Expo LAN (recommended for phone)"
echo "  2) Firebase Emulators only"
echo "  3) Expo only (uses production Firebase)"
echo "  4) Exit"
echo ""
read -rp "Enter choice [1]: " CHOICE
CHOICE="${CHOICE:-1}"

case "$CHOICE" in
  1)
    echo "Starting Firebase Emulators in background..."
    firebase emulators:start --import=./emulator-data --export-on-exit &
    EMULATOR_PID=$!
    echo "Waiting for emulators to initialize (8s)..."
    sleep 8
    echo "Starting Expo Metro bundler (LAN mode)..."
    cd apps/mobile
    EXPO_PUBLIC_USE_EMULATOR=true pnpm start --lan --clear
    kill "$EMULATOR_PID" 2>/dev/null || true
    ;;
  2)
    firebase emulators:start --import=./emulator-data --export-on-exit
    ;;
  3)
    cd apps/mobile
    EXPO_PUBLIC_USE_EMULATOR=false pnpm start --clear
    ;;
  *)
    echo "Goodbye."
    ;;
esac
