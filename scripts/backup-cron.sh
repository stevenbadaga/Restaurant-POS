#!/usr/bin/env bash
# ==========================================
# Restaurant POS — Scheduled Backup Script
# ==========================================
# Designed to be run from cron or systemd timer.
# Performs a pg_dump, verifies the archive,
# enforces retention policy, and logs results.
#
# Usage:
#   ./scripts/backup-cron.sh              # single run with defaults
#   ./scripts/backup-cron.sh --daily      # daily mode (keep 7 daily + 4 weekly)
#   ./scripts/backup-cron.sh --weekly     # weekly mode (keep 4 weekly + 12 monthly)
#   ./scripts/backup-cron.sh --validate   # validate latest backup only
#
# Cron example (daily at 2 AM):
#   0 2 * * * /opt/restaurant-pos/scripts/backup-cron.sh --daily >> /var/log/restaurant-pos-backup.log 2>&1
#
# ==========================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/backend/.env}"
PROD_ENV_FILE="$PROJECT_DIR/.env.production"
LOG_DIR="$PROJECT_DIR/backups/logs"
MAIN_BACKUP_DIR="$PROJECT_DIR/backups"

# Retention defaults
DAILY_KEEP=7          # keep 7 daily backups
WEEKLY_KEEP=4         # keep 4 weekly backups
MONTHLY_KEEP=12       # keep 12 monthly backups

TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
WEEK_NUMBER=$(date +"%V")
MONTH_NUMBER=$(date +"%m")

MODE="${1:-single}"

# ─── Logging ───────────────────────────────────────────
mkdir -p "$LOG_DIR" "$MAIN_BACKUP_DIR"

log_info()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
log_warn()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*"; }
log_error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*"; }
log_info_to_file() {
  local msg="$1"
  log_info "$msg"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $msg" >> "$LOG_DIR/backup-cron.log"
}

# ─── Load Environment ─────────────────────────────────
if [ -f "$PROD_ENV_FILE" ]; then
  set -a
  source "$PROD_ENV_FILE"
  set +a
elif [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  log_error "DATABASE_URL is not set. Cannot proceed."
  exit 1
fi

if ! command -v pg_dump &>/dev/null; then
  log_error "pg_dump is not installed. Install PostgreSQL client tools."
  exit 1
fi

# ─── Determine Retention Category ─────────────────────
RETENTION_TAG="daily"
if [ "$MODE" = "--weekly" ]; then
  RETENTION_TAG="weekly"
elif [ "$MODE" = "--monthly" ]; then
  RETENTION_TAG="monthly"
fi

# ─── Create Backup ────────────────────────────────────
BACKUP_FILE="$MAIN_BACKUP_DIR/restaurant-pos-${RETENTION_TAG}-${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
LOG_FILE="$LOG_DIR/backup-${TIMESTAMP}.log"

log_info_to_file "Starting ${RETENTION_TAG} backup → ${BACKUP_FILE}"

# Execute backup
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --compress=9 \
  --file="${BACKUP_FILE}" \
  --verbose 2>>"$LOG_FILE"

# Verify backup exists and is valid
BACKUP_SIZE=0
if [ ! -f "$BACKUP_FILE" ]; then
  log_error "Backup file was not created!"
  echo "FAILED" > "$LOG_DIR/last-backup-status.txt"
  exit 1
fi

BACKUP_SIZE=$(du -b "$BACKUP_FILE" | cut -f1)
if [ "$BACKUP_SIZE" -eq 0 ]; then
  log_error "Backup file is empty!"
  rm -f "$BACKUP_FILE"
  echo "FAILED" > "$LOG_DIR/last-backup-status.txt"
  exit 1
fi

# Validate with pg_restore --list (dry run)
if ! pg_restore --list "${BACKUP_FILE}" &>/dev/null; then
  log_error "Backup validation failed — not a valid custom-format dump."
  rm -f "$BACKUP_FILE"
  echo "FAILED" > "$LOG_DIR/last-backup-status.txt"
  exit 1
fi

# Generate checksum
sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"

HUMAN_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_info_to_file "Backup created successfully (${HUMAN_SIZE})"
log_info_to_file "Checksum: $(sha256sum "$BACKUP_FILE" | cut -d' ' -f1)"

# Write success status
echo "OK" > "$LOG_DIR/last-backup-status.txt"
echo "$BACKUP_FILE" > "$LOG_DIR/last-backup-path.txt"

# ─── Retention Cleanup ─────────────────────────────────
log_info_to_file "Running retention cleanup..."

case "$MODE" in
  --daily)
    # Keep only the latest DAILY_KEEP daily backups
    find "$MAIN_BACKUP_DIR" -maxdepth 1 -name "restaurant-pos-daily-*.dump" -type f \
      | sort -r \
      | tail -n +$((DAILY_KEEP + 1)) \
      | while read -r OLD; do
          log_info "Removing old daily backup: $(basename "$OLD")"
          rm -f "$OLD" "${OLD}.sha256"
        done
    ;;

  --weekly)
    # Keep only the latest WEEKLY_KEEP weekly backups
    find "$MAIN_BACKUP_DIR" -maxdepth 1 -name "restaurant-pos-weekly-*.dump" -type f \
      | sort -r \
      | tail -n +$((WEEKLY_KEEP + 1)) \
      | while read -r OLD; do
          log_info "Removing old weekly backup: $(basename "$OLD")"
          rm -f "$OLD" "${OLD}.sha256"
        done
    ;;

  --monthly)
    # Keep only the latest MONTHLY_KEEP monthly backups
    find "$MAIN_BACKUP_DIR" -maxdepth 1 -name "restaurant-pos-monthly-*.dump" -type f \
      | sort -r \
      | tail -n +$((MONTHLY_KEEP + 1)) \
      | while read -r OLD; do
          log_info "Removing old monthly backup: $(basename "$OLD")"
          rm -f "$OLD" "${OLD}.sha256"
        done
    ;;

  *)
    # Single mode: clean up any failed partial dumps older than 1 day
    find "$MAIN_BACKUP_DIR" -maxdepth 1 -name "*.dump" -type f -mtime +1 -size 0 -delete 2>/dev/null || true
    ;;

esac

# Clean up old log files (keep 90 days)
find "$LOG_DIR" -name "backup-*.log" -type f -mtime +90 -delete 2>/dev/null || true

# Remove failed indicators older than 7 days
find "$LOG_DIR" -name "last-backup-status.txt" -type f -mtime +7 -delete 2>/dev/null || true

log_info_to_file "Retention cleanup complete."
log_info_to_file "Backup completed successfully."

# ─── Output Summary ───────────────────────────────────
cat <<EOF

==================================================
📦  Backup Complete
──────────────────────────────────────────────────
  Mode:      ${RETENTION_TAG}
  File:      ${BACKUP_FILE}
  Size:      ${HUMAN_SIZE}
  Checksum:  ${CHECKSUM_FILE}
  Retention: ${DAILY_KEEP} daily / ${WEEKLY_KEEP} weekly / ${MONTHLY_KEEP} monthly
  Status:    ✅ SUCCESS
==================================================
EOF

exit 0
