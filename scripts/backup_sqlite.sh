#!/usr/bin/env bash
set -euo pipefail
umask 077

DB_PATH="${1:-backend/data/finance.db}"
BACKUP_DIR="${2:-backups}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if [ ! -f "$DB_PATH" ]; then
  echo "Database not found: $DB_PATH" >&2
  exit 1
fi

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Python executable not found: $PYTHON_BIN" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date +"%Y-%m-%d_%H-%M-%S")"
backup_path="$BACKUP_DIR/finance-$timestamp.db"

"$PYTHON_BIN" scripts/backup_sqlite.py \
  "$DB_PATH" \
  "$backup_path"
