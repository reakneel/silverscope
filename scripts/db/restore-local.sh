#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BACKUP_FILE="${1:-}"
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to a LOCAL Supabase/PostgreSQL database URI}"
[[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]] || { echo "Usage: RESTORE_DATABASE_URL=postgresql://... $0 <backup.dump>" >&2; exit 1; }
[[ "${ALLOW_DESTRUCTIVE_RESTORE:-}" == "YES" ]] || { echo "Restore replaces objects in the target database. Set ALLOW_DESTRUCTIVE_RESTORE=YES after confirming the target." >&2; exit 1; }
command -v pg_restore >/dev/null || { echo "pg_restore is required." >&2; exit 1; }
host="$(python3 -c 'import sys,urllib.parse; print(urllib.parse.urlparse(sys.argv[1]).hostname or "")' "$RESTORE_DATABASE_URL")"
case "$host" in localhost|127.0.0.1|::1) ;; *) echo "Refusing restore: target host '$host' is not local." >&2; exit 1 ;; esac
checksum="${BACKUP_FILE%.dump}.sha256"
if [[ -f "$checksum" ]]; then
  (cd "$(dirname "$BACKUP_FILE")" && sha256sum -c "$(basename "$checksum")")
fi
pg_restore --list "$BACKUP_FILE" >/dev/null
export PGSSLMODE="${PGSSLMODE:-disable}"
pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-acl --exit-on-error "$BACKUP_FILE"
echo "Restore completed into local database host: $host"
