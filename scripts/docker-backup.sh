#!/bin/sh
# ==========================================
# Restaurant POS — Docker Backup Script
# ==========================================
# Designed to run inside a Docker container
# with DATABASE_URL environment variable.
# Used by the backup service in docker-compose.prod.yml.
# ==========================================

set -e

TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_FILE="${BACKUP_DIR}/restaurant-pos-daily-${TIMESTAMP}.dump"

echo "[$$] Starting daily backup at $(date)"
echo "[$$] Target: ${BACKUP_FILE}"

# Ensure pg_dump is available
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[$$] ERROR: pg_dump not found. Install postgresql-client."
  exit 1
fi

# Create backup
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --compress=9 \
  --file="${BACKUP_FILE}" 2>/tmp/backup.err

if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
  BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "[$$] Backup created: $(basename ${BACKUP_FILE}) (${BACKUP_SIZE})"

  # Generate checksum
  sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"

  # Retention: keep only the latest N backups
  echo "[$$] Retention cleanup (keep ${RETENTION_DAYS} days)..."
  find "${BACKUP_DIR}" -maxdepth 1 -name "restaurant-pos-*.dump" -type f \
    | sort -r \
    | tail -n +$((RETENTION_DAYS + 1)) \
    | while read -r OLD; do
        rm -f "${OLD}" "${OLD}.sha256"
        echo "[$$] Removed: $(basename ${OLD})"
      done

  echo "[$$] Backup completed successfully."
else
  echo "[$$] Backup FAILED!"
  if [ -f /tmp/backup.err ]; then
    cat /tmp/backup.err
  fi
  exit 1
fi
