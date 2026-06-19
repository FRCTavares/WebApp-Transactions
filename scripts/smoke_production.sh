#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-https://f-transactions-api.onrender.com}"
ORIGIN="${ORIGIN:-https://web-app-transactions.vercel.app}"

echo "Checking health..."
curl -fsS "$API_BASE_URL/api/health" | python3 -m json.tool

echo ""
echo "Checking /api/me rejects missing bearer token..."
status="$(
  curl -sS -o /tmp/f_transactions_me_response.json -w "%{http_code}" \
    "$API_BASE_URL/api/me"
)"

cat /tmp/f_transactions_me_response.json | python3 -m json.tool

if [ "$status" != "401" ]; then
  echo "Expected /api/me without token to return 401, got $status"
  exit 1
fi

echo ""
echo "Checking CORS preflight..."
curl -fsS -i -X OPTIONS "$API_BASE_URL/api/summary?year=2026&month=6" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  | grep -i "access-control-allow-origin"

echo ""
echo "Production smoke checks passed."
