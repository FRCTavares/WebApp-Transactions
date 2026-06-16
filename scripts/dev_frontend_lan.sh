#!/usr/bin/env bash
set -euo pipefail

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

export VITE_API_BASE_URL="http://$LAN_IP:8000"

echo "Starting frontend on local network"
echo "Frontend URL for Mac/iPhone: http://$LAN_IP:5173"
echo "API URL: $VITE_API_BASE_URL"
echo ""

cd frontend
npm run dev -- --host 0.0.0.0
