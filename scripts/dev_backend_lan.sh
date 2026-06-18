#!/usr/bin/env bash
set -euo pipefail

if [ -z "${APP_ACCESS_TOKEN:-}" ]; then
  echo "APP_ACCESS_TOKEN is not set." >&2
  echo "Run this first:" >&2
  echo "  export APP_ACCESS_TOKEN=\"your-real-local-token\"" >&2
  exit 1
fi

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"

if [ -z "$LAN_IP" ]; then
  LAN_IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi

if [ -z "$LAN_IP" ]; then
  echo "Could not detect LAN IP from en0 or en1." >&2
  echo "Check Wi-Fi is connected, then run:" >&2
  echo "  ipconfig getifaddr en0" >&2
  exit 1
fi

export CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://$LAN_IP:5173"

echo "Starting backend on local network"
echo "Backend URL: http://$LAN_IP:8000"
echo "Allowed frontend origins: $CORS_ORIGINS"
echo ""

cd backend

UVICORN_BIN=".venv/bin/uvicorn"
if [ ! -x "$UVICORN_BIN" ]; then
  echo "Error: $UVICORN_BIN not found or not executable"
  echo "Run this first: cd backend && .venv/bin/pip install -r requirements.txt"
  exit 1
fi
PYTHONPATH=. "$UVICORN_BIN" app.main:app --host 0.0.0.0 --port 8000 --reload
