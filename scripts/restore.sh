#!/usr/bin/env bash
# Restore a pg_dump dump produced by ./scripts/backup.sh into a target database.
#
# Usage:
#   ./scripts/restore.sh <dump-path> <target-database-url> [--clean]
#
# Safety: the target database MUST be empty or you must pass --clean.
# This script never targets $DATABASE_URL by default - pass a separate URL for
# the restore target to avoid clobbering production.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <dump-path> <target-database-url> [--clean]" >&2
  exit 1
fi

DUMP_PATH="$1"
TARGET_URL="$2"
CLEAN_FLAG="${3:-}"

if [[ ! -f "$DUMP_PATH" ]]; then
  echo "Dump file not found: $DUMP_PATH" >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore not found on PATH" >&2
  exit 1
fi

SIDECAR="$DUMP_PATH.sha256"
if [[ -f "$SIDECAR" ]]; then
  EXPECTED="$(cat "$SIDECAR")"
  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL="$(sha256sum "$DUMP_PATH" | awk '{print $1}')"
  else
    ACTUAL="$(shasum -a 256 "$DUMP_PATH" | awk '{print $1}')"
  fi
  if [[ "$EXPECTED" != "$ACTUAL" ]]; then
    echo "Checksum mismatch for $DUMP_PATH" >&2
    echo "  expected: $EXPECTED" >&2
    echo "  actual:   $ACTUAL" >&2
    exit 1
  fi
  echo "Checksum OK ($ACTUAL)"
else
  echo "No .sha256 sidecar found; skipping integrity check." >&2
fi

ARGS=(--no-owner --no-privileges --dbname="$TARGET_URL")
if [[ "$CLEAN_FLAG" == "--clean" ]]; then
  ARGS=(--clean "${ARGS[@]}")
fi

echo "Restoring $DUMP_PATH into $TARGET_URL"
pg_restore "${ARGS[@]}" "$DUMP_PATH"

echo "Restore complete."
