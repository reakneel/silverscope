#!/usr/bin/env python3
"""Incremental, read-only Supabase Storage backup to a local directory."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

API_TIMEOUT = 60
PAGE_SIZE = 100


def safe_object_path(bucket: str, object_name: str) -> Path:
    parts = [bucket, *object_name.replace("\\", "/").split("/")]
    if not bucket or any(part in ("", ".", "..") for part in parts):
        raise ValueError("Unsafe bucket or object path returned by Storage API.")
    if object_name.startswith("/") or "\x00" in object_name:
        raise ValueError("Unsafe absolute or NUL object path.")
    return Path(*parts)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def remote_signature(item: dict[str, Any]) -> str:
    metadata = item.get("metadata") or {}
    stable = {
        "id": item.get("id"),
        "updated_at": item.get("updated_at"),
        "created_at": item.get("created_at"),
        "size": metadata.get("size"),
        "eTag": metadata.get("eTag") or metadata.get("etag"),
    }
    return hashlib.sha256(json.dumps(stable, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


class StorageClient:
    def __init__(self, base_url: str, service_key: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}

    def request(self, path: str, method: str = "GET", body: Any = None) -> bytes:
        data = None if body is None else json.dumps(body).encode()
        headers = dict(self.headers)
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(self.base_url + path, data=data, headers=headers, method=method)
        last_error: Exception | None = None
        for attempt in range(4):
            try:
                with urllib.request.urlopen(request, timeout=API_TIMEOUT) as response:
                    return response.read()
            except urllib.error.HTTPError as exc:
                last_error = exc
                if exc.code not in (429, 500, 502, 503, 504) or attempt == 3:
                    detail = exc.read(300).decode("utf-8", "replace")
                    raise RuntimeError(f"Supabase Storage HTTP {exc.code}: {detail}") from exc
            except (urllib.error.URLError, TimeoutError) as exc:
                last_error = exc
                if attempt == 3:
                    raise RuntimeError(f"Supabase Storage request failed: {exc}") from exc
            time.sleep(2 ** attempt)
        raise RuntimeError(f"Supabase Storage request failed: {last_error}")

    def json(self, path: str, method: str = "GET", body: Any = None) -> Any:
        return json.loads(self.request(path, method, body))

    def buckets(self) -> list[dict[str, Any]]:
        result = self.json("/storage/v1/bucket")
        if not isinstance(result, list):
            raise RuntimeError("Unexpected Storage bucket-list response.")
        return result

    def list_objects(self, bucket: str, prefix: str, offset: int) -> list[dict[str, Any]]:
        bucket_path = urllib.parse.quote(bucket, safe="")
        result = self.json(
            f"/storage/v1/object/list/{bucket_path}",
            "POST",
            {"prefix": prefix, "limit": PAGE_SIZE, "offset": offset,
             "sortBy": {"column": "name", "order": "asc"}},
        )
        if not isinstance(result, list):
            raise RuntimeError(f"Unexpected object-list response for bucket {bucket}.")
        return result

    def download(self, bucket: str, object_name: str) -> bytes:
        bucket_path = urllib.parse.quote(bucket, safe="")
        object_path = urllib.parse.quote(object_name, safe="/")
        return self.request(f"/storage/v1/object/{bucket_path}/{object_path}")


def atomic_json(path: Path, value: Any) -> None:
    temp = path.with_suffix(path.suffix + ".partial")
    temp.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(temp, path)


def sync(args: argparse.Namespace) -> int:
    base_url = os.environ.get("SUPABASE_URL", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base_url or not service_key:
        raise RuntimeError("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the local environment.")
    if not base_url.startswith("https://"):
        raise RuntimeError("SUPABASE_URL must use HTTPS.")
    root = Path(args.output).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    try:
        root.chmod(0o700)
    except OSError:
        pass
    manifest_path = root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {
        "format": "silverscope-supabase-storage-backup-v1", "createdAt": None,
        "updatedAt": None, "buckets": {}, "objects": {},
    }
    client = StorageClient(base_url, service_key)
    buckets = client.buckets()
    if args.bucket:
        buckets = [bucket for bucket in buckets if bucket.get("name") == args.bucket]
        if not buckets:
            raise RuntimeError(f"Bucket not found: {args.bucket}")
    manifest["buckets"] = {bucket["name"]: {
        "id": bucket.get("id"), "name": bucket.get("name"), "public": bucket.get("public"),
        "file_size_limit": bucket.get("file_size_limit"),
        "allowed_mime_types": bucket.get("allowed_mime_types"),
    } for bucket in buckets}
    downloaded = skipped = 0
    for bucket in buckets:
        bucket_name = str(bucket["name"])
        prefixes = [""]
        visited: set[str] = set()
        while prefixes:
            prefix = prefixes.pop()
            if prefix in visited:
                continue
            visited.add(prefix)
            offset = 0
            while True:
                entries = client.list_objects(bucket_name, prefix, offset)
                for item in entries:
                    name = str(item.get("name", ""))
                    if not name:
                        continue
                    object_name = prefix + name
                    if item.get("id") is None and not item.get("metadata"):
                        prefixes.append(object_name.rstrip("/") + "/")
                        continue
                    relative = safe_object_path(bucket_name, object_name)
                    destination = root / relative
                    if not destination.resolve().is_relative_to(root):
                        raise ValueError(f"Local backup path escapes its root: {bucket_name}/{object_name}")
                    signature = remote_signature(item)
                    key = f"{bucket_name}/{object_name}"
                    old = manifest["objects"].get(key, {})
                    if destination.is_file() and old.get("remoteSignature") == signature:
                        local_hash = sha256_file(destination)
                        if local_hash == old.get("sha256"):
                            skipped += 1
                            continue
                    if args.dry_run:
                        print(f"WOULD DOWNLOAD {key}")
                        continue
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    temporary = destination.with_name(destination.name + ".partial")
                    payload = client.download(bucket_name, object_name)
                    with temporary.open("wb") as stream:
                        stream.write(payload)
                        stream.flush()
                        os.fsync(stream.fileno())
                    os.replace(temporary, destination)
                    digest = sha256_file(destination)
                    manifest["objects"][key] = {
                        "remoteSignature": signature, "sha256": digest,
                        "size": len(payload), "updatedAt": item.get("updated_at"),
                        "createdAt": item.get("created_at"),
                        "contentType": (item.get("metadata") or {}).get("mimetype"),
                    }
                    downloaded += 1
                if len(entries) < PAGE_SIZE:
                    break
                offset += len(entries)
        print(f"BUCKET {bucket_name}: scanned prefixes={len(visited)}")
    if not args.dry_run:
        manifest["updatedAt"] = datetime.now(timezone.utc).isoformat()
        if manifest["createdAt"] is None:
            manifest["createdAt"] = manifest["updatedAt"]
        atomic_json(manifest_path, manifest)
    print(f"Storage backup {'preview' if args.dry_run else 'complete'}: downloaded={downloaded}, verified_skipped={skipped}, buckets={len(buckets)}")
    print(f"Local backup root: {root}")
    print("Remote deletions are not mirrored; local backup objects are retained until manually reviewed.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="./backups/supabase-storage", help="Local backup directory")
    parser.add_argument("--bucket", help="Only back up this bucket; default is all buckets")
    parser.add_argument("--dry-run", action="store_true", help="List downloads without writing files")
    args = parser.parse_args()
    try:
        return sync(args)
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
