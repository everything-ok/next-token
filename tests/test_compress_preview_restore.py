import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "hui-compress"))

from scripts import compress
from scripts.validate import validate_text


class PreviewRestoreAndValidationTests(unittest.TestCase):
    def test_preview_validates_without_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "notes.md"
            original = "# Notes\n\nThis is a verbose sentence that needs compression.\n"
            path.write_text(original)
            with mock.patch.object(compress, "call_claude", return_value="# Notes\n\nShort sentence.\n"):
                self.assertEqual(compress.preview_file(path), "# Notes\n\nShort sentence.\n")
            self.assertEqual(path.read_text(), original)

    def test_restore_replaces_target_from_backup_atomically(self):
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as data_home, mock.patch.dict(
            os.environ, {"LOCALAPPDATA": data_home}, clear=False
        ):
            path = Path(tmp) / "notes.md"
            original = "# Notes\n\nOriginal prose.\n"
            path.write_text("# Notes\n\nCompressed prose.\n")
            backup = compress.backup_path_for(path.resolve())
            compress.write_backup(backup, original)
            self.assertEqual(compress.restore_file(path), backup)
            self.assertEqual(path.read_text(), original)

    def test_validation_rejects_list_link_path_and_environment_changes(self):
        original = """# Notes

- Keep [docs](https://example.test/docs) at ./docs/readme.md using $HOME.
  - Keep nested item.

| Name | Value |
| --- | --- |
| A | B |
"""
        compressed = """# Notes

- Keep docs at docs/readme.md.

| Name | Value |
| --- | --- |
"""
        result = validate_text(original, compressed)
        self.assertFalse(result.is_valid)
        errors = "\n".join(result.errors)
        self.assertIn("URLs", errors)
        self.assertIn("Markdown links", errors)
        self.assertIn("File paths", errors)
        self.assertIn("Environment variables", errors)
        self.assertIn("Bullet hierarchy", errors)
        self.assertIn("Table column structure", errors)


if __name__ == "__main__":
    unittest.main()
