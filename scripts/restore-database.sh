#!/usr/bin/env bash
# ==========================================
# Restaurant POS — Database Restore Script
# ==========================================
# Usage:
#   ./scripts/restore-database.sh <backup_file.dump> [target_database_url]
#   ./scripts/restore-database.sh --dry-run <backup_file.dump> [target_database_url]
#   ./scripts/restore-database.sh --list <backup_file.dump>
#   ./scripts/restore-database.sh --latest [target_database_url]
#
# WARNING: This script restores a database backup.
# It requires explicit confirmation and logs every step.
# A pre-restore backup is always created automatically.
# ==========================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/backend/.env}"
PROD_ENV_FILE="$PROJECT_DIR/.env.production"
LOG_DIR="$PROJECT_DIR/backups/logs"
MAIN_BACKUP_DIR="$PROJECT_DIR/backups"

mkdir -p "$LOG_DIR"

log_info()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
log_warn()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*"; }
log_error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*"; }
log_step()  { echo ""; echo "━━━ $* ━━━"; }

# ─── Parse Arguments ──────────────────────────────────
DRY_RUN=false
LIST_MODE=false
LATEST_MODE=false
BACKUP_FILE=""
TARGET_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --list)
      LIST_MODE=true
      shift
      ;;
    --latest)
      LATEST_MODE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--dry-run|--list|--latest] <backup_file> [target_url]"
      echo ""
      echo "  --dry-run     Validate backup without restoring"
      echo "  --list        List contents of a backup file"
      echo "  --latest      Restore the most recent backup in $MAIN_BACKUP_DIR"
      echo ""
      echo "  backup_file   Path to .dump file (not needed with --latest)"
      echo "  target_url    PostgreSQL URL for restore target"
      echo "                (defaults to DATABASE_URL from .env/.env.production)"
      exit 0
      ;;
    *)
      if [ -z "$BACKUP_FILE" ]; then
        BACKUP_FILE="$1"
      elif [ -z "$TARGET_URL" ]; then
        TARGET_URL="$1"
      fi
      shift
      ;;
  esac
done

# ─── Latest Mode ───────────────────────────────────────
if [ "$LATEST_MODE" = true ]; then
  BACKUP_FILE=$(find "$MAIN_BACKUP_DIR" -maxdepth 1 -name "restaurant-pos-*.dump" -type f -not -name "pre-restore-*" | sort -r | head -1)
  if [ -z "$BACKUP_FILE" ]; then
    log_error "No backup files found in $MAIN_BACKUP_DIR"
    exit 1
  fi
  log_info "Latest backup selected: $(basename "$BACKUP_FILE")"
fi

# ─── List Mode ─────────────────────────────────────────
if [ "$LIST_MODE" = true ]; then
  if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
  fi
  log_step "Listing backup contents: $(basename "$BACKUP_FILE")"
  pg_restore --list "$BACKUP_FILE" | head -100
  echo ""
  log_info "Showing first 100 entries. Total tables: $(pg_restore --list "$BACKUP_FILE" | grep -c 'TABLE DATA\|TABLE ''$' || echo "unknown")"
  exit 0
fi

# ─── Validate Backup File ──────────────────────────────
if [ -z "$BACKUP_FILE" ]; then
  if ! command -v pg_restore &>/dev/null; then
  log_error "pg_restore is not installed. Install PostgreSQL client tools."
  exit 1
fi

log_error "No backup file specified. Use --latest or provide a path."
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  log_error "Backup file not found: $BACKUP_FILE"
  exit 1
fi

log_step "Validating backup file: $(basename "$BACKUP_FILE")"

# Check file size
FILE_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null || echo "0")
if [ "$FILE_SIZE" -eq 0 ]; then
  log_error "Backup file is empty."
  exit 1
fi
HUMAN_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_info "File size: $HUMAN_SIZE"

# Verify checksum if available
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
  log_info "Verifying checksum..."
  if sha256sum --check "$CHECKSUM_FILE" 2>/dev/null; then
    log_info "✅ Checksum verified."
  else
    log_error "❌ Checksum verification FAILED. The backup may be corrupted."
    exit 1
  fi
else
  log_warn "No checksum file found. Skipping integrity check."
fi

# Verify backup format
if ! pg_restore --list "$BACKUP_FILE" &>/dev/null; then
  log_error "Invalid backup format. Ensure this is a pg_dump custom-format file."
  exit 1
fi
log_info "✅ Backup format is valid (custom-format)."

# ─── Dry Run ───────────────────────────────────────────
if [ "$DRY_RUN" = true ]; then
  log_step "Dry Run Mode"
  log_info "Backup file: $BACKUP_FILE"
  log_info "The backup is valid and ready to restore."
  log_info "No changes were made."
  exit 0
fi

# ─── Load Environment ─────────────────────────────────
if [ -z "$TARGET_URL" ] && [ -f "$PROD_ENV_FILE" ]; then
  set -a
  source "$PROD_ENV_FILE"
  set +a
elif [ -z "$TARGET_URL" ] && [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

DATABASE_URL="${TARGET_URL:-${DATABASE_URL:-}}"

if [ -z "$DATABASE_URL" ]; then
  log_error "No target database URL provided and DATABASE_URL is not set."
  log_error "Either pass a URL as the second argument or set DATABASE_URL in your .env file."
  exit 1
fi

# Extract database name for display/confirmation
DB_NAME=$(echo "$DATABASE_URL" | awk -F'/' '{print $NF}' | awk -F'?' '{print $1}')
HOST_NAME=$(echo "$DATABASE_URL" | awk -F'@' '{print $2}' | awk -F'/' '{print $1}')

log_step "Restore Target"
log_info "Host:     $HOST_NAME"
log_info "Database: $DB_NAME"
log_info "Backup:   $(basename "$BACKUP_FILE") ($HUMAN_SIZE)"

# ─── Confirmation ─────────────────────────────────────
echo ""
echo "⚠️  ⚠️  ⚠️  DESTRUCTIVE ACTION  ⚠️  ⚠️  ⚠️"
echo ""
echo "You are about to RESTORE a database backup. This will"
echo "OVERWRITE the target database."
echo ""

read -p "Type the database name to confirm (${DB_NAME}): " CONFIRM_DB
if [ "$CONFIRM_DB" != "$DB_NAME" ]; then
  log_error "Database name confirmation failed. Restore cancelled."
  exit 1
fi

read -p "Type 'RESTORE' to confirm this destructive action: " CONFIRM_ACTION
if [ "$CONFIRM_ACTION" != "RESTORE" ]; then
  log_error "Action confirmation failed. Restore cancelled."
  exit 1
fi

# ─── Pre-Restore Backup ───────────────────────────────
log_step "Creating pre-restore snapshot"

PRE_RESTORE_DIR="$MAIN_BACKUP_DIR/pre-restore"
mkdir -p "$PRE_RESTORE_DIR"
PRE_BACKUP_FILE="$PRE_RESTORE_DIR/pre-restore-$(date +"%Y-%m-%d-%H%M%S")-${DB_NAME}.dump"

if pg_dump "$DATABASE_URL" --format=custom --compress=9 --file="$PRE_BACKUP_FILE" 2>/dev/null; then
  log_info "✅ Pre-restore backup saved: $(basename "$PRE_BACKUP_FILE")"
  log_info "   Size: $(du -h "$PRE_BACKUP_FILE" | cut -f1)"
else
  log_warn "Pre-restore backup failed. Proceeding without snapshot."
  PRE_BACKUP_FILE=""
fi

RESTORE_LOG="$LOG_DIR/restore-$(date +"%Y-%m-%d-%H%M%S")-${DB_NAME}.log"

# ─── Execute Restore ──────────────────────────────────
log_step "Executing restore on ${DB_NAME}"

echo "Restore started at $(date)" > "$RESTORE_LOG"
echo "Backup: $BACKUP_FILE" >> "$RESTORE_LOG"
echo "Target: $HOST_NAME / $DB_NAME" >> "$RESTORE_LOG"
echo "" >> "$RESTORE_LOG"

if pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="$DATABASE_URL" \
  --verbose \
  "$BACKUP_FILE" 2>>"$RESTORE_LOG"; then
  log_info "✅ Restore completed successfully for: $DB_NAME"
  echo "SUCCESS" >> "$RESTORE_LOG"
  echo "Restore completed at $(date)" >> "$RESTORE_LOG"
else
  RESTORE_EXIT=$?
  log_error "❌ Restore FAILED with exit code $RESTORE_EXIT"
  echo "FAILED (exit $RESTORE_EXIT)" >> "$RESTORE_LOG"

  if [ -n "$PRE_BACKUP_FILE" ] && [ -f "$PRE_BACKUP_FILE" ]; then
    log_warn "A pre-restore backup exists at: $PRE_BACKUP_FILE"
    log_warn "Use the following command to rollback:"
    echo ""
    echo "  pg_restore --clean --if-exists --no-owner --no-acl \\"
    echo "    --dbname=\"$DATABASE_URL\" \\"
    echo "    \"$PRE_BACKUP_FILE\""
    echo ""
  fi
  exit 1
fi

# ─── Summary ──────────────────────────────────────────
cat <<EOF

==================================================
✅  Restore Complete
──────────────────────────────────────────────────
  Database:  ${DB_NAME}
  Backup:    $(basename "$BACKUP_FILE")
  Size:      ${HUMAN_SIZE}
  Pre-restore snapshot: $(basename "$PRE_BACKUP_FILE" || echo "none")
  Log:       ${RESTORE_LOG}
  Status:    ✅ SUCCESS
==================================================

Next steps:
  1. Verify data: docker compose exec postgres psql -U postgres -d ${DB_NAME} -c 'SELECT count(*) FROM users;'
  2. Run Prisma migration status: npm run prod:migrate
  3. Log in to the application and verify core workflows.
  4. If something is wrong, restore the pre-restore snapshot (see log above).
EOF
