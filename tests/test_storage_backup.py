import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "db" / "sync-supabase-storage.py"
SPEC = importlib.util.spec_from_file_location("storage_backup", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class StorageBackupTests(unittest.TestCase):
    def test_safe_object_path_preserves_nested_key(self):
        path = MODULE.safe_object_path("research", "daily/2026/11/data.json")
        self.assertEqual(path, Path("research/daily/2026/11/data.json"))

    def test_rejects_parent_traversal_and_absolute_paths(self):
        for name in ("../secret", "nested/../../secret", "/absolute", "folder/./file"):
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    MODULE.safe_object_path("bucket", name)

    def test_remote_signature_is_stable_and_tracks_metadata_changes(self):
        item = {"id": "object-id", "updated_at": "2026-11-20T00:00:00Z",
                "metadata": {"size": 42, "eTag": "abc"}}
        same = {"metadata": {"eTag": "abc", "size": 42},
                "updated_at": "2026-11-20T00:00:00Z", "id": "object-id"}
        changed = {**item, "metadata": {"size": 43, "eTag": "def"}}
        self.assertEqual(MODULE.remote_signature(item), MODULE.remote_signature(same))
        self.assertNotEqual(MODULE.remote_signature(item), MODULE.remote_signature(changed))

    def test_sha256_file(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "sample.txt"
            file.write_bytes(b"silverscope")
            self.assertEqual(MODULE.sha256_file(file),
                "e697c61f453b3434fe7b4e39ba93720f1ed024bd5dab2d25d35c4762bb7aca54")


if __name__ == "__main__":
    unittest.main()
