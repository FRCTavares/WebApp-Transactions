#!/usr/bin/env bash
# Start the backend for local end-to-end runs against a throwaway database.
#
# The e2e suite creates categories, transactions and import batches on every
# run and does not fully clean up after itself. Started without DATABASE_URL
# the backend serves backend/data/finance.db, so those rows accumulate in real
# data - 239 of them had built up before this script existed. CI already points
# at a temp file; this makes local runs behave the same way.
#
# Usage:  backend/scripts/start_e2e_backend.sh [port]
set -euo pipefail

port="${1:-8000}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${repo_root}/frontend/e2e/.env.e2e.local"

if [[ -x "${repo_root}/backend/.venv/bin/python" ]]; then
  python_bin="${repo_root}/backend/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  python_bin="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  python_bin="$(command -v python)"
else
  echo "No usable Python interpreter found." >&2
  echo "Create backend/.venv or install python3." >&2
  exit 1
fi

if [[ ! -f "${env_file}" ]]; then
  echo "Missing ${env_file}." >&2
  echo "It must define SUPABASE_JWT_SECRET, E2E_TEST_EMAIL and VITE_SUPABASE_URL." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

db_path="$(mktemp -t e2e-backend-XXXXXX).db"
export APP_ENV="e2e"
export DATABASE_URL="sqlite:///${db_path}"
export ALLOWED_USER_EMAILS="${E2E_TEST_EMAIL}"
export CORS_ORIGINS="http://127.0.0.1:4173,http://localhost:4173"

echo "Throwaway database: ${db_path}"

cd "${repo_root}/backend"
"${python_bin}" -m alembic upgrade head >/dev/null

# Refuse to serve the real database even if something above is edited later.
if [[ "${DATABASE_URL}" == *"data/finance.db"* ]]; then
  echo "Refusing to run e2e against backend/data/finance.db." >&2
  exit 1
fi

echo "Starting backend on http://127.0.0.1:${port}"
exec "${python_bin}" -m uvicorn app.main:app --host 127.0.0.1 --port "${port}"
