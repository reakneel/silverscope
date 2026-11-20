#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the Supabase PostgreSQL connection URI}"
BACKUP_ROOT="${BACKUP_ROOT:-./backups/supabase}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
command -v pg_dump >/dev/null || { echo "pg_dump is required (install PostgreSQL client tools)." >&2; exit 1; }
command -v pg_restore >/dev/null || { echo "pg_restore is required (install PostgreSQL client tools)." >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "sha256sum is required." >&2; exit 1; }
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || { echo "RETENTION_DAYS must be a non-negative integer." >&2; exit 1; }

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="silverscope-supabase-$stamp"
tmp="$BACKUP_ROOT/$name.dump.partial"
dump="$BACKUP_ROOT/$name.dump"
trap 'rm -f "$tmp"' EXIT

export PGSSLMODE="${PGSSLMODE:-require}"
pg_dump --dbname="$SUPABASE_DB_URL" --format=custom --no-owner --no-acl --compress=9 --file="$tmp"
pg_restore --list "$tmp" >/dev/null
mv "$tmp" "$dump"
sha="$(sha256sum "$dump" | awk '{print $1}')"
printf '%s  %s\n' "$sha" "$(basename "$dump")" > "$BACKUP_ROOT/$name.sha256"
cat > "$BACKUP_ROOT/$name.json" <<EOF
{
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "format": "PostgreSQL custom archive",
  "file": "$(basename "$dump")",
  "sha256": "$sha",
  "postgresClient": "$(pg_dump --version | sed 's/"/\\"/g')",
  "includes": "database schemas and table data accessible to the backup role",
  "excludes": ["Supabase Storage object bytes", "Vercel environment variables", "external provider secrets"]
}
EOF

find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'silverscope-supabase-*.dump' -mtime "+$((RETENTION_DAYS - 1))" -print -delete | while IFS= read -r old; do
  base="${old%.dump}"
  rm -f "$base.sha256" "$base.json"
done
echo "Backup created: $dump"
echo "SHA-256: $sha"
echo "Retention: $RETENTION_DAYS days"
