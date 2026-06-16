#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:-backend/data/finance.db}"
BACKUP_DIR="${2:-backups}"

if [ ! -f "$DB_PATH" ]; then
  echo "Database not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date +"%Y-%m-%d_%H-%M-%S")"
backup_path="$BACKUP_DIR/finance-$timestamp.db"

cp "$DB_PATH" "$backup_path"

integrity_result="$(sqlite3 "$backup_path" "PRAGMA integrity_check;")"

if [ "$integrity_result" != "ok" ]; then
  echo "Backup failed integrity check: $integrity_result" >&2
  rm -f "$backup_path"
  exit 1
fi

echo "Backup created: $backup_path"
