import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "hui-compress"))

from scripts import compress


class IncrementalCompressionTests(unittest.TestCase):
    def test_only_changed_prose_is_sent_to_model(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            base = root / "base.md"
            current = root / "current.md"
            base.write_text("# Notes\n\nUnchanged secret context.\n\nOld verbose sentence.\n")
            current.write_text("# Notes\n\nUnchanged secret context.\n\nNew verbose sentence that needs compression.\n")
            seen = []

            def fake_call(prompt):
                seen.append(prompt)
                return "New short sentence.\n"

            with mock.patch.object(compress, "call_claude", side_effect=fake_call):
                self.assertTrue(compress.compress_incremental(current, base))
            self.assertEqual(current.read_text(), "# Notes\n\nUnchanged secret context.\n\nNew short sentence.\n")
            self.assertEqual(len(seen), 1)
            self.assertIn("New verbose sentence", seen[0])
            self.assertNotIn("Unchanged secret context", seen[0])

    def test_dry_run_never_calls_model_or_writes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            base = root / "base.md"
            current = root / "current.md"
            base.write_text("Old prose.\n")
            original = "New prose.\n"
            current.write_text(original)
            with mock.patch.object(compress, "call_claude") as call:
                self.assertTrue(compress.compress_incremental(current, base, dry_run=True))
            call.assert_not_called()
            self.assertEqual(current.read_text(), original)

    def test_invalid_incremental_output_preserves_source_and_creates_no_backup(self):
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as data_home, mock.patch.dict(
            os.environ, {"LOCALAPPDATA": data_home}, clear=False
        ):
            root = Path(tmp)
            base, current = root / "base.md", root / "current.md"
            base.write_text("# Notes\n\nOld prose.\n")
            original = "# Notes\n\nNew prose.\n"
            current.write_text(original)
            with mock.patch.object(compress, "call_claude", return_value="# Changed\n\nShort.\n"):
                with self.assertRaisesRegex(RuntimeError, "Headings"):
                    compress.compress_incremental(current, base)
            self.assertEqual(current.read_text(), original)
            self.assertFalse(compress.backup_path_for(current.resolve(), incremental=True).exists())


if __name__ == "__main__":
    unittest.main()
