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


if __name__ == "__main__":
    unittest.main()
