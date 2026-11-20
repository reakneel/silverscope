import csv
import gzip
import hashlib
import importlib.util
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "db" / "cold-archive-observations.py"
SPEC = importlib.util.spec_from_file_location("cold_archive", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class ColdArchiveTests(unittest.TestCase):
    def make_archive(self, directory: str, rows: list[dict]) -> Path:
        path = Path(directory) / "observations.csv.gz"
        with gzip.open(path, "wt", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=["archive_record"])
            writer.writeheader()
            for row in rows:
                writer.writerow({"archive_record": json.dumps(row, separators=(",", ":"))})
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        manifest = {
            "format": MODULE.FORMAT, "file": path.name,
            "sha256": digest, "rowCount": len(rows),
        }
        Path(str(path) + ".json").write_text(json.dumps(manifest), encoding="utf-8")
        return path

    @staticmethod
    def record(identifier: str) -> dict:
        return {"row_hash": "a" * 32, "row": {"id": identifier, "observed_at": "2020-01-01T00:00:00+00:00"}}

    def test_valid_archive_manifest_checksum_and_row_count(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.make_archive(directory, [self.record("id-1"), self.record("id-2")])
            manifest = MODULE.validate_archive(path)
            self.assertEqual(manifest["rowCount"], 2)

    def test_checksum_mismatch_aborts(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.make_archive(directory, [self.record("id-1")])
            with path.open("ab") as stream:
                stream.write(b"tampered")
            with self.assertRaisesRegex(RuntimeError, "SHA-256 mismatch"):
                MODULE.validate_archive(path)

    def test_duplicate_observation_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.make_archive(directory, [self.record("same"), self.record("same")])
            with self.assertRaisesRegex(RuntimeError, "Duplicate observation ID"):
                MODULE.validate_archive(path)

    def test_manifest_row_count_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.make_archive(directory, [self.record("id-1")])
            manifest_path = Path(str(path) + ".json")
            manifest = json.loads(manifest_path.read_text())
            manifest["rowCount"] = 2
            manifest_path.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(RuntimeError, "row count mismatch"):
                MODULE.validate_archive(path)

    def test_restore_refuses_remote_database(self):
        with self.assertRaisesRegex(RuntimeError, "must be local"):
            MODULE.restore_archive("postgresql://user:pass@db.example.com:5432/postgres", Path("not-used"))

    def test_psql_copy_path_rejects_quote_in_path(self):
        with self.assertRaisesRegex(RuntimeError, "cannot contain quotes"):
            MODULE.psql_copy_path(Path("/tmp/unsafe'path.csv"))

    def test_delete_transaction_locks_table_and_checks_exact_hash_set(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.make_archive(directory, [self.record("id-1")])
            with patch.object(MODULE, "run_psql") as run:
                MODULE.delete_archived_rows("postgresql://local", path, "2020-01-01T00:00:00+00:00")
                sql = run.call_args.args[1]
                self.assertIn("LOCK TABLE public.observations IN SHARE ROW EXCLUSIVE MODE", sql)
                self.assertIn("md5(to_jsonb(o)::text)", sql)
                self.assertIn("eligible_count", sql)
                self.assertIn("BEGIN", sql)

    def test_restore_is_insert_only_and_hash_verified(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.make_archive(directory, [self.record("id-1")])
            with patch.object(MODULE, "run_psql") as run:
                MODULE.restore_archive("postgresql://postgres:postgres@127.0.0.1:54322/postgres", path)
                sql = run.call_args.args[1]
                self.assertIn("ON CONFLICT (dedupe_key) DO NOTHING", sql)
                self.assertIn("md5(to_jsonb(o)::text)", sql)

    def test_psql_copy_path_normalizes_path(self):
        self.assertIn("/", MODULE.psql_copy_path(Path("relative/archive.csv")))


if __name__ == "__main__":
    unittest.main()
