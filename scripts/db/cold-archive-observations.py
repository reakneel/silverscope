#!/usr/bin/env python3
"""Verified local cold archive for old observations. Deletion is opt-in and parity-checked."""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

FORMAT = "silverscope-observations-cold-archive-v1"


def atomic_json(path: Path, value: Any) -> None:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, prefix=".manifest-", suffix=".partial", delete=False) as stream:
        temp = Path(stream.name)
        json.dump(value, stream, indent=2, sort_keys=True)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_archive(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise RuntimeError(f"Archive file does not exist: {path}")
    manifest_path = Path(str(path) + ".json")
    if not manifest_path.is_file():
        raise RuntimeError(f"Archive manifest is missing: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("format") != FORMAT or manifest.get("file") != path.name:
        raise RuntimeError("Archive manifest does not match the selected archive.")
    actual_hash = sha256_file(path)
    if actual_hash != manifest.get("sha256"):
        raise RuntimeError("Archive SHA-256 mismatch. No database operation was performed.")
    count = 0
    with tempfile.TemporaryDirectory(prefix="silverscope-archive-verify-") as temp_dir:
        connection = sqlite3.connect(Path(temp_dir) / "ids.sqlite")
        try:
            connection.execute("CREATE TABLE ids (id TEXT PRIMARY KEY)")
            with gzip.open(path, "rt", encoding="utf-8", newline="") as stream:
                reader = csv.DictReader(stream)
                if reader.fieldnames != ["archive_record"]:
                    raise RuntimeError("Unexpected archive CSV header.")
                for item in reader:
                    record = json.loads(item["archive_record"])
                    row = record.get("row")
                    row_hash = record.get("row_hash")
                    if not isinstance(row, dict) or not row.get("id") or not isinstance(row_hash, str) or len(row_hash) != 32:
                        raise RuntimeError(f"Invalid archive record at row {count + 1}.")
                    try:
                        connection.execute("INSERT INTO ids(id) VALUES (?)", (row["id"],))
                    except sqlite3.IntegrityError as error:
                        raise RuntimeError(f"Duplicate observation ID in archive: {row['id']}") from error
                    count += 1
        finally:
            connection.close()
    if count != int(manifest.get("rowCount", -1)):
        raise RuntimeError(f"Archive row count mismatch: manifest={manifest.get('rowCount')} actual={count}.")
    return manifest


def run_psql(database_url: str, sql: str) -> None:
    command = ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "--dbname", database_url]
    result = subprocess.run(command, input=sql, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout)[-3000:]
        raise RuntimeError(f"psql operation failed (exit {result.returncode}): {detail}")


def psql_copy_path(path: Path) -> str:
    value = path.resolve().as_posix()
    if "'" in value or "\n" in value or "\r" in value:
        raise RuntimeError("Backup path cannot contain quotes or newlines for safe psql COPY.")
    return value


def load_archive_into_temp(path: Path) -> tuple[Path, tempfile.TemporaryDirectory]:
    directory = tempfile.TemporaryDirectory(prefix="silverscope-cold-archive-")
    plain = Path(directory.name) / "archive.csv"
    with gzip.open(path, "rb") as source, plain.open("wb") as target:
        shutil.copyfileobj(source, target, length=1024 * 1024)
        target.flush()
        os.fsync(target.fileno())
    return plain, directory


def delete_archived_rows(database_url: str, archive_path: Path, cutoff: str) -> None:
    plain, directory = load_archive_into_temp(archive_path)
    try:
        copy_path = psql_copy_path(plain)
        sql = f"""BEGIN;
CREATE TEMP TABLE _silverscope_archive_rows(row_json jsonb NOT NULL) ON COMMIT DROP;
\\copy _silverscope_archive_rows(row_json) FROM '{copy_path}' WITH (FORMAT csv, HEADER true)
SELECT set_config('silverscope.archive_cutoff', '{cutoff}', true);
LOCK TABLE public.observations IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE expected_count bigint; matched_count bigint; eligible_count bigint; deleted_count bigint;
        cutoff_value timestamptz := current_setting('silverscope.archive_cutoff')::timestamptz;
BEGIN
  SELECT count(*) INTO expected_count FROM _silverscope_archive_rows;
  SELECT count(*) INTO matched_count
  FROM _silverscope_archive_rows b
  JOIN public.observations o ON o.id = (b.row_json->'row'->>'id')::uuid
  WHERE o.observed_at < cutoff_value
    AND md5(to_jsonb(o)::text) = b.row_json->>'row_hash';
  SELECT count(*) INTO eligible_count FROM public.observations WHERE observed_at < cutoff_value;
  IF expected_count <> matched_count OR expected_count <> eligible_count THEN
    RAISE EXCEPTION 'Cold archive parity failed (exported %, exact matches %, currently eligible %); no rows were deleted.',
      expected_count, matched_count, eligible_count;
  END IF;
  DELETE FROM public.observations o
  USING _silverscope_archive_rows b
  WHERE o.id = (b.row_json->'row'->>'id')::uuid
    AND o.observed_at < cutoff_value
    AND md5(to_jsonb(o)::text) = b.row_json->>'row_hash';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count <> expected_count THEN
    RAISE EXCEPTION 'Cold archive delete count mismatch (expected %, deleted %). Transaction rolled back.',
      expected_count, deleted_count;
  END IF;
END $$;
COMMIT;
"""
        run_psql(database_url, sql)
    finally:
        directory.cleanup()


def restore_archive(database_url: str, archive_path: Path) -> None:
    parsed = urllib.parse.urlparse(database_url)
    if parsed.hostname not in ("localhost", "127.0.0.1", "::1"):
        raise RuntimeError("Refusing archive restore: target database must be local (localhost/127.0.0.1/::1).")
    manifest = validate_archive(archive_path)
    plain, directory = load_archive_into_temp(archive_path)
    try:
        copy_path = psql_copy_path(plain)
        sql = f"""BEGIN;
CREATE TEMP TABLE _silverscope_archive_rows(row_json jsonb NOT NULL) ON COMMIT DROP;
\\copy _silverscope_archive_rows(row_json) FROM '{copy_path}' WITH (FORMAT csv, HEADER true)
INSERT INTO public.observations
SELECT (jsonb_populate_record(NULL::public.observations, row_json->'row')).*
FROM _silverscope_archive_rows
ON CONFLICT (dedupe_key) DO NOTHING;
DO $$
DECLARE expected_count bigint; verified_count bigint;
BEGIN
  SELECT count(*) INTO expected_count FROM _silverscope_archive_rows;
  SELECT count(*) INTO verified_count
  FROM _silverscope_archive_rows b
  JOIN public.observations o ON o.id = (b.row_json->'row'->>'id')::uuid
  WHERE md5(to_jsonb(o)::text) = b.row_json->>'row_hash';
  IF expected_count <> verified_count THEN
    RAISE EXCEPTION 'Restore parity failed (expected %, verified %). Transaction rolled back.',
      expected_count, verified_count;
  END IF;
END $$;
COMMIT;
"""
        run_psql(database_url, sql)
    finally:
        directory.cleanup()
    print(f"Restored and verified {manifest['rowCount']} observations into local database.")


def create_archive(args: argparse.Namespace) -> Path:
    database_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not database_url:
        raise RuntimeError("Set SUPABASE_DB_URL in your local environment.")
    if args.apply_delete:
        if not args.archive_file:
            raise RuntimeError("--apply-delete requires --archive-file pointing to an existing, reviewed archive.")
        archive_path = args.archive_file.expanduser().resolve()
        manifest = validate_archive(archive_path)
        if manifest.get("deleteApplied"):
            raise RuntimeError("This archive manifest is already marked as applied.")
        cutoff = manifest.get("cutoff")
        if not cutoff:
            raise RuntimeError("Archive manifest has no cutoff; refusing source deletion.")
        manifest["deleteStartedAt"] = datetime.now(timezone.utc).isoformat()
        atomic_json(Path(str(archive_path) + ".json"), manifest)
        delete_archived_rows(database_url, archive_path, str(cutoff))
        manifest["deleteApplied"] = True
        manifest["deletedAt"] = datetime.now(timezone.utc).isoformat()
        atomic_json(Path(str(archive_path) + ".json"), manifest)
        print(f"Deleted {manifest['rowCount']} source rows only after exact ID/hash/count parity passed.")
        return archive_path
    if args.archive_file:
        raise RuntimeError("--archive-file is only used together with --apply-delete.")
    if args.cutoff_days < 1:
        raise RuntimeError("--cutoff-days must be at least 1.")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=args.cutoff_days)).replace(microsecond=0).isoformat()
    root = Path(args.output).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    try:
        root.chmod(0o700)
    except OSError:
        pass
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    archive_path = root / f"silverscope-observations-before-{stamp}.csv.gz"
    partial_path = Path(str(archive_path) + ".partial")
    if archive_path.exists() or Path(str(archive_path) + ".json").exists():
        raise RuntimeError(f"Refusing to overwrite an existing cold archive: {archive_path}")
    query = (
        "COPY (SELECT jsonb_build_object('row_hash', md5(to_jsonb(o)::text), "
        "'row', to_jsonb(o))::text AS archive_record "
        "FROM public.observations o "
        f"WHERE o.observed_at < TIMESTAMPTZ '{cutoff}' "
        "ORDER BY o.observed_at, o.id) TO STDOUT WITH (FORMAT CSV, HEADER TRUE);"
    )
    command = ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "--dbname", database_url, "-c", query]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        assert process.stdout is not None
        with gzip.open(partial_path, "wb", compresslevel=9) as target:
            while True:
                chunk = process.stdout.read(1024 * 1024)
                if not chunk:
                    break
                target.write(chunk)
        _, stderr = process.communicate()
        if process.returncode != 0:
            raise RuntimeError(f"Cold archive export failed: {stderr.decode('utf-8', 'replace')[-3000:]}")
        with partial_path.open("rb") as stream:
            os.fsync(stream.fileno())
        os.replace(partial_path, archive_path)
    except Exception:
        process.kill()
        process.wait()
        partial_path.unlink(missing_ok=True)
        raise

    row_count = 0
    min_observed = None
    max_observed = None
    with tempfile.TemporaryDirectory(prefix="silverscope-archive-export-") as temp_dir:
        connection = sqlite3.connect(Path(temp_dir) / "ids.sqlite")
        try:
            connection.execute("CREATE TABLE ids (id TEXT PRIMARY KEY)")
            with gzip.open(archive_path, "rt", encoding="utf-8", newline="") as stream:
                reader = csv.DictReader(stream)
                if reader.fieldnames != ["archive_record"]:
                    raise RuntimeError("PostgreSQL export did not produce the expected CSV header.")
                for item in reader:
                    record = json.loads(item["archive_record"])
                    row = record.get("row", {})
                    if not row.get("id") or not record.get("row_hash"):
                        raise RuntimeError(f"Invalid exported observation at row {row_count + 1}.")
                    try:
                        connection.execute("INSERT INTO ids(id) VALUES (?)", (row["id"],))
                    except sqlite3.IntegrityError as error:
                        raise RuntimeError(f"Duplicate observation ID in export: {row['id']}") from error
                    observed_at = row["observed_at"]
                    min_observed = min(min_observed, observed_at) if min_observed else observed_at
                    max_observed = max(max_observed, observed_at) if max_observed else observed_at
                    row_count += 1
        finally:
            connection.close()

    digest = sha256_file(archive_path)
    manifest = {
        "format": FORMAT,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "cutoff": cutoff,
        "cutoffDays": args.cutoff_days,
        "rowCount": row_count,
        "minObservedAt": min_observed,
        "maxObservedAt": max_observed,
        "file": archive_path.name,
        "sha256": digest,
        "deleteApplied": False,
        "restoreMode": "insert-only; conflicts are accepted only when exact row hashes match",
    }
    atomic_json(Path(str(archive_path) + ".json"), manifest)
    validate_archive(archive_path)
    print(f"Verified cold archive: {archive_path}")
    print(f"Rows: {row_count}; SHA-256: {digest}")
    print("Read-only export complete: source rows were not modified. Review and independently copy the archive before any deletion.")
    return archive_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="backups/cold-observations")
    parser.add_argument("--cutoff-days", type=int, default=365)
    parser.add_argument("--apply-delete", action="store_true", help="Delete only rows in a previously exported and verified archive.")
    parser.add_argument("--archive-file", type=Path, help="Existing cold archive to verify and optionally apply; required with --apply-delete.")
    parser.add_argument("--verify-archive", type=Path, help="Verify an existing archive and manifest without connecting to the database.")
    parser.add_argument("--restore-local", type=Path, help="Restore an archive into a local PostgreSQL database; set RESTORE_DATABASE_URL.")
    args = parser.parse_args()
    try:
        if args.verify_archive:
            manifest = validate_archive(args.verify_archive.resolve())
            print(f"Archive verified: {args.verify_archive} ({manifest['rowCount']} rows, SHA-256 {manifest['sha256']})")
        elif args.restore_local:
            database_url = os.environ.get("RESTORE_DATABASE_URL", "").strip()
            if not database_url:
                raise RuntimeError("Set RESTORE_DATABASE_URL to a local PostgreSQL database.")
            restore_archive(database_url, args.restore_local.resolve())
        else:
            create_archive(args)
        return 0
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
