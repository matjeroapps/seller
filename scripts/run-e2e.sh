#!/usr/bin/env bash
set -euo pipefail

# Deterministic E2E Test Harness for Seller Storefront
# Spawns fake-core, storefront-api, Next.js storefront server, runs Playwright, and cleans up.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CORE_PORT=${FAKE_CORE_PORT:-18080}
STOREFRONT_API_PORT=${STOREFRONT_API_PORT:-8080}
NEXT_PORT=${NEXT_PORT:-3000}
REDIS_HOST=${REDIS_ADDR:-127.0.0.1:6379}

# Ephemeral service token
export CORE_API_TOKEN=${CORE_API_TOKEN:-"ephemeral-test-token-$(date +%s)"}
export FAKE_CORE_PORT=$CORE_PORT
export FAKE_CORE_CONTROL_URL="http://127.0.0.1:$CORE_PORT"

export CORE_API_BASE_URL="http://127.0.0.1:$CORE_PORT"
export STOREFRONT_API_BASE_URL="http://127.0.0.1:$STOREFRONT_API_PORT"
export STOREFRONT_CACHE_ENABLED=${STOREFRONT_CACHE_ENABLED:-true}
export REDIS_ADDR=$REDIS_HOST
export HTTP_ADDR=":$STOREFRONT_API_PORT"
export PORT=$NEXT_PORT
export HOSTNAME="0.0.0.0"

# Flush local Redis if present to prevent stale cache entries
docker exec seller-redis-test redis-cli flushall 2>/dev/null || redis-cli flushall 2>/dev/null || true

PIDS=()

cleanup() {
  echo "Cleaning up background services..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

wait_for_url() {
  local url="$1"
  local name="$2"
  local timeout=${3:-30}
  local elapsed=0

  echo "Waiting for $name at $url..."
  until curl -s -f -o /dev/null "$url" || [ "$elapsed" -ge "$timeout" ]; do
    sleep 0.5
    elapsed=$((elapsed + 1))
  done

  if [ "$elapsed" -ge "$timeout" ]; then
    echo "ERROR: Timeout waiting for $name at $url"
    exit 1
  fi
  echo "$name is ready!"
}

echo "1. Building fake-core and storefront-api..."
GOWORK=off go build -o /tmp/fake-core ./cmd/fake-core
GOWORK=off go build -o /tmp/storefront-api ./apps/storefront-api

echo "2. Starting fake-core..."
/tmp/fake-core &
PIDS+=($!)

echo "3. Starting storefront-api..."
/tmp/storefront-api &
PIDS+=($!)

wait_for_url "http://127.0.0.1:$CORE_PORT/test-control/calls" "Fake Core" 10
wait_for_url "http://127.0.0.1:$STOREFRONT_API_PORT/healthz" "Storefront API" 10

npm run build --workspace=@commerce/storefront-web

# Run Next.js server directly
NODE_ENV=production STOREFRONT_API_BASE_URL="http://127.0.0.1:$STOREFRONT_API_PORT" PORT=$NEXT_PORT HOSTNAME="0.0.0.0" node web/storefront/.next/standalone/web/storefront/server.js &
PIDS+=($!)

wait_for_url "http://store-a.localhost:$NEXT_PORT/en" "Next.js Storefront" 30

echo "5. Running Playwright E2E Tests..."
npx playwright test "$@"
