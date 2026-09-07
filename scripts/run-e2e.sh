#!/usr/bin/env bash
set -euo pipefail

# Deterministic E2E Test Harness for the Seller platform
# Spawns fake-core, storefront-api, seller-api, the seller portal dev
# server, MinIO, and the Next.js storefront server, runs Playwright, and cleans
# up everything afterwards.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
export PATH="$ROOT_DIR/node_modules/.bin:$ROOT_DIR/web/storefront/node_modules/.bin:$ROOT_DIR/web/seller/node_modules/.bin:$PATH"

CORE_PORT=${FAKE_CORE_PORT:-18080}
STOREFRONT_API_PORT=${STOREFRONT_API_PORT:-8080}
NEXT_PORT=${NEXT_PORT:-3000}
SELLER_API_PORT=${SELLER_API_PORT:-18081}
SELLER_WEB_PORT=${SELLER_WEB_PORT:-3001}
MINIO_PORT=${MINIO_PORT:-19000}
REDIS_HOST=${REDIS_ADDR:-127.0.0.1:6379}

# MinIO images: the local default is a pinned release already present in the
# developer machine's image cache; CI overrides both to :latest (see ci.yml).
MINIO_IMAGE=${MINIO_IMAGE:-minio/minio:RELEASE.2025-04-22T22-12-26Z}
MC_IMAGE=${MC_IMAGE:-minio/mc:latest}
MINIO_CONTAINER=${MINIO_CONTAINER:-matjero-minio-e2e}

# Ephemeral service token
export CORE_API_TOKEN=${CORE_API_TOKEN:-"ephemeral-test-token-$(date +%s)"}
export FAKE_CORE_PORT=$CORE_PORT
export FAKE_CORE_CONTROL_URL="http://127.0.0.1:$CORE_PORT"

# Test-double OIDC issuer served by fake-core itself. seller-api discovers the
# JWKS from it for backend E2E contracts.
export FAKE_CORE_ISSUER_URL=${FAKE_CORE_ISSUER_URL:-"http://127.0.0.1:$CORE_PORT"}
export FAKE_CORE_SELLER_SUBJECT=${FAKE_CORE_SELLER_SUBJECT:-"usr_seller_dev"}
export SELLER_SESSION_SECRET=${SELLER_SESSION_SECRET:-"seller-e2e-session-secret"}

# S3-compatible media storage (MinIO) backing the P5.8 media flow.
export S3_ENDPOINT=${S3_ENDPOINT:-"http://127.0.0.1:$MINIO_PORT"}
export S3_BUCKET=${S3_BUCKET:-"matjero-media"}
export S3_ACCESS_KEY=${S3_ACCESS_KEY:-"minioadmin"}
export S3_SECRET_KEY=${S3_SECRET_KEY:-"minioadmin"}
export S3_REGION=${S3_REGION:-"us-east-1"}

export CORE_API_BASE_URL="http://127.0.0.1:$CORE_PORT"
export STOREFRONT_API_BASE_URL="http://127.0.0.1:$STOREFRONT_API_PORT"
export STOREFRONT_CACHE_ENABLED=${STOREFRONT_CACHE_ENABLED:-true}
export STOREFRONT_CHECKOUT_ENABLED=${STOREFRONT_CHECKOUT_ENABLED:-true}
export REDIS_ADDR=$REDIS_HOST
export HTTP_ADDR=":$STOREFRONT_API_PORT"
export PORT=$NEXT_PORT
export HOSTNAME="0.0.0.0"
export SELLER_APP_URL="http://127.0.0.1:$SELLER_WEB_PORT"
export STORE_A_HOST="store-a.localhost:$NEXT_PORT"
export STORE_B_HOST="store-b.localhost:$NEXT_PORT"
export STORE_A_BASE_URL="http://$STORE_A_HOST"
export STORE_B_BASE_URL="http://$STORE_B_HOST"

# Flush local Redis if present to prevent stale cache entries
docker exec seller-redis-test redis-cli flushall 2>/dev/null || redis-cli flushall 2>/dev/null || true

PIDS=()
MINIO_STARTED_BY_US=0
SELLER_WEB_PID=""

cleanup() {
  echo "Cleaning up background services..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  if [ -n "$SELLER_WEB_PID" ] && kill -0 "$SELLER_WEB_PID" 2>/dev/null; then
    # The seller web server runs in its own session so the whole tree dies with it.
    kill -TERM -- -"$SELLER_WEB_PID" 2>/dev/null || kill "$SELLER_WEB_PID" 2>/dev/null || true
  fi
  if [ "$MINIO_STARTED_BY_US" = "1" ]; then
    docker rm -f "$MINIO_CONTAINER" >/dev/null 2>&1 || true
  fi
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

echo "0. Starting MinIO (media storage)..."
if curl -s -f -o /dev/null "http://127.0.0.1:$MINIO_PORT/minio/health/live"; then
  echo "MinIO already running on port $MINIO_PORT."
else
  docker rm -f "$MINIO_CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$MINIO_CONTAINER" \
    -p "$MINIO_PORT:9000" \
    -e MINIO_ROOT_USER="$S3_ACCESS_KEY" \
    -e MINIO_ROOT_PASSWORD="$S3_SECRET_KEY" \
    "$MINIO_IMAGE" server /data >/dev/null
  MINIO_STARTED_BY_US=1
fi
wait_for_url "http://127.0.0.1:$MINIO_PORT/minio/health/live" "MinIO" 30

echo "0b. Ensuring bucket $S3_BUCKET exists and is publicly readable..."
# The minio/mc image entrypoint is `mc` itself.
docker run --rm --network host \
  -e MC_HOST_local="http://$S3_ACCESS_KEY:$S3_SECRET_KEY@127.0.0.1:$MINIO_PORT" \
  "$MC_IMAGE" mb --ignore-existing "local/$S3_BUCKET" >/dev/null
docker run --rm --network host \
  -e MC_HOST_local="http://$S3_ACCESS_KEY:$S3_SECRET_KEY@127.0.0.1:$MINIO_PORT" \
  "$MC_IMAGE" anonymous set download "local/$S3_BUCKET" >/dev/null

echo "1. Building fake-core, storefront-api, and seller-api..."
GOWORK=off go build -o /tmp/fake-core ./cmd/fake-core
GOWORK=off go build -o /tmp/storefront-api ./apps/storefront-api
GOWORK=off go build -o /tmp/seller-api ./apps/seller-api

echo "2. Starting fake-core..."
/tmp/fake-core &
PIDS+=($!)

echo "3. Starting storefront-api..."
TRUSTED_FORWARDED_HOST=true /tmp/storefront-api &
PIDS+=($!)

wait_for_url "http://127.0.0.1:$CORE_PORT/test-control/calls" "Fake Core" 10
wait_for_url "http://127.0.0.1:$STOREFRONT_API_PORT/healthz" "Storefront API" 10

echo "4. Starting seller-api (issuer: $FAKE_CORE_ISSUER_URL)..."
HTTP_ADDR=":$SELLER_API_PORT" \
ZITADEL_ISSUER="$FAKE_CORE_ISSUER_URL" \
ZITADEL_AUDIENCE="${ZITADEL_AUDIENCE:-seller-api}" \
CORE_API_BASE_URL="$CORE_API_BASE_URL" \
CORE_API_TOKEN="$CORE_API_TOKEN" \
REDIS_ADDR="$REDIS_HOST" \
/tmp/seller-api &
PIDS+=($!)

wait_for_url "http://127.0.0.1:$SELLER_API_PORT/healthz" "Seller API" 15

echo "5. Starting seller portal (Next.js dev server)..."
# setsid gives Next.js its own process group so cleanup can kill the whole tree.
setsid env \
  NEXT_PUBLIC_SELLER_APP_URL="$SELLER_APP_URL" \
  SELLER_SESSION_SECRET="$SELLER_SESSION_SECRET" \
  npm run dev --workspace=@commerce/seller-web \
  >/tmp/seller-web-e2e.log 2>&1 &
SELLER_WEB_PID=$!
PIDS+=("$SELLER_WEB_PID")

wait_for_url "http://127.0.0.1:$SELLER_WEB_PORT/" "Seller Web" 60

npm run build --workspace=@commerce/storefront-web
rm -rf web/storefront/.next/standalone/web/storefront/.next/static
cp -r web/storefront/.next/static web/storefront/.next/standalone/web/storefront/.next/static
cp -r web/storefront/public web/storefront/.next/standalone/web/storefront/public 2>/dev/null || true

# Run Next.js server directly
NODE_ENV=production STOREFRONT_API_BASE_URL="http://127.0.0.1:$STOREFRONT_API_PORT" PORT=$NEXT_PORT HOSTNAME="0.0.0.0" node web/storefront/.next/standalone/web/storefront/server.js &
PIDS+=($!)

wait_for_url "$STORE_A_BASE_URL/en" "Next.js Storefront" 30

echo "6. Running Playwright E2E Tests..."
npx playwright test "$@"
