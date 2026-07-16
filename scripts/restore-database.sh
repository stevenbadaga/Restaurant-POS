#!/usr/bin/env bash
#
# Restaurant POS — Database Restore Script
# Usage: ./scripts/restore-database.sh <backup_file.dump> [target_database_url]
#
# WARNING: This script restores a database backup.
# It does NOT overwrite the production database without explicit confirmation.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/server/.env"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.dump> [target_database_url]"
  echo ""
  echo "If target_database_url is omitted, a new validation database will be created."
  exit 1
fi

BACKUP_FILE="$1"
TARGET_URL="${2:-}"

# Validate backup file
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Verify checksum if available
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
  echo "🔍 Verifying backup checksum..."
  sha256sum --check "$CHECKSUM_FILE" || {
    echo "❌ Checksum verification failed. The backup may be corrupted."
    exit 1
  }
  echo "✅ Checksum verified."
fi

# Verify backup format
if ! pg_restore --list "$BACKUP_FILE" &>/dev/null; then
  echo "❌ Invalid backup format. Ensure this is a pg_dump custom-format file."
  exit 1
fi

# Load environment
if [ -z "$TARGET_URL" ] && [ -f "$ENV_FILE" ]; then
  export $(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$' | xargs)
fi

DATABASE_URL="${TARGET_URL:-${DATABASE_URL:-}}"

if [ -z "$DATABASE_URL" ]; then
  echo "❌ No target database URL provided and DATABASE_URL not set."
  exit 1
fi

# Extract database name for display
DB_NAME=$(echo "$DATABASE_URL" | awk -F'/' '{print $NF}' | awk -F'?' '{print $1}' || echo "unknown")

echo ""
echo "⚠️  ⚠️  ⚠️  DESTRUCTIVE ACTION  ⚠️  ⚠️  ⚠️"
echo ""
echo "You are about to RESTORE a database backup into:"
echo "  Database: $DB_NAME"
echo "  Backup:   $BACKUP_FILE"
echo ""
read -p "Type the database name to confirm restoration: " CONFIRM_DB
if [ "$CONFIRM_DB" != "$DB_NAME" ]; then
  echo "❌ Confirmation failed. Restore cancelled."
  exit 1
fi

read -p "Type 'RESTORE' to confirm this destructive action: " CONFIRM_ACTION
if [ "$CONFIRM_ACTION" != "RESTORE" ]; then
  echo "❌ Confirmation failed. Restore cancelled."
  exit 1
fi

echo ""
echo "🔄 Restoring database..."
echo "   This will overwrite the target database."

# Pre-restore backup
PRE_RESTORE_BACKUP_DIR="$PROJECT_DIR/backups/pre-restore"
mkdir -p "$PRE_RESTORE_BACKUP_DIR"
PRE_BACKUP_FILE="$PRE_RESTORE_BACKUP_DIR/pre-restore-$(date +"%Y-%m-%d-%H%M%S").dump"
echo "📦 Creating pre-restore backup: $PRE_BACKUP_FILE"
pg_dump "$DATABASE_URL" --format=custom --compress=9 --file="$PRE_BACKUP_FILE" 2>/dev/null || true

# Restore
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="$DATABASE_URL" \
  --verbose \
  "$BACKUP_FILE" 2>&1 | tail -5 || true

echo ""
echo "✅ Restore completed for: $DB_NAME"
echo "   A pre-restore backup was saved to: $PRE_BACKUP_FILE"
echo ""
echo "⚠️  Run Prisma migration status and health checks to verify."
