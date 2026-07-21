#!/usr/bin/env bash
#
# Restaurant POS — Database Backup Script
# Usage: ./scripts/backup-database.sh [output_directory]
#
# Requirements: pg_dump must be installed and in PATH.
# Reads DATABASE_URL from backend/.env, .env.production, or environment.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/backend/.env}"
PROD_ENV_FILE="$PROJECT_DIR/.env.production"
BACKUP_DIR="${1:-$PROJECT_DIR/backups}"
TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
BACKUP_FILE="$BACKUP_DIR/restaurant-pos-$TIMESTAMP.dump"
CHECKSUM_FILE="$BACKUP_FILE.sha256"

# Load environment variables
if [ -f "$PROD_ENV_FILE" ]; then
  export $(grep -v '^\s*#' "$PROD_ENV_FILE" | grep -v '^\s*$' | xargs)
elif [ -f "$ENV_FILE" ]; then
  export $(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$' | xargs)
fi

# Validate
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL is not set. Create server/.env from .env.example first."
  exit 1
fi

if ! command -v pg_dump &>/dev/null; then
  echo "❌ pg_dump is not installed. Install PostgreSQL client tools."
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check for existing backup today
TODAY_BACKUP=$(find "$BACKUP_DIR" -maxdepth 1 -name "restaurant-pos-$TIMESTAMP*" 2>/dev/null | head -1)
if [ -n "$TODAY_BACKUP" ]; then
  echo "⚠️  A backup for this timestamp already exists: $TODAY_BACKUP"
  echo "   Remove it manually or wait for the next minute."
  exit 1
fi

echo "📦 Creating database backup..."
echo "   Output: $BACKUP_FILE"

# Create compressed custom-format backup
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="$BACKUP_FILE" 2>&1 | grep -v "^$\|^pg_dump: dumping" || true

# Verify backup
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file was not created."
  exit 1
fi

# Generate checksum
sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"

# Get file size
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo ""
echo "✅ Backup completed successfully!"
echo "   File: $BACKUP_FILE"
echo "   Size: $FILE_SIZE"
echo "   Checksum: $CHECKSUM_FILE"
echo ""
echo "🔐 Ensure this backup is encrypted and stored securely."
echo "   Never commit backup files to version control."
