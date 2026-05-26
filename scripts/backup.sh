#!/usr/bin/env bash
# Backup the production database using pg_dump.
#
# Usage:
#   ./scripts/backup.sh                       # writes ./backups/<timestamp>.dump
#   OUT_DIR=/srv/backups ./scripts/backup.sh  # writes to a custom directory
#
# Requires:
#   - DATABASE_URL set in the environment.
#   - pg_dump on PATH (matching Postgres major version).
#
# Writes a custom-format dump plus a SHA-256 sidecar.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL not set" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found on PATH" >&2
  exit 1
fi

OUT_DIR="${OUT_DIR:-./backups}"
mkdir -p "$OUT_DIR"

TIMESTAMP="$(date -u +"%Y%m%d-%H%M%S")"
DUMP_PATH="$OUT_DIR/erp-agencia-$TIMESTAMP.dump"

echo "Writing backup to $DUMP_PATH"
pg_dump --format=custom --no-owner --no-privileges --file="$DUMP_PATH" "$DATABASE_URL"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$DUMP_PATH" | awk '{print $1}' > "$DUMP_PATH.sha256"
else
  shasum -a 256 "$DUMP_PATH" | awk '{print $1}' > "$DUMP_PATH.sha256"
fi

echo "Backup complete: $DUMP_PATH"
echo "SHA-256: $(cat "$DUMP_PATH.sha256")"
