"""Tests for hui-mode-tracker.js prompt parsing (issues #598, #599).

Drives the UserPromptSubmit hook with real prompts over stdin against an
isolated CLAUDE_CONFIG_DIR and asserts the flag-file state afterwards.

#598: natural-language triggers misfired — "turn hui mode off"
ACTIVATED hui (and clobbered the level to default), "turn hui off"
was a no-op, questions about hui armed it, and vim's "normal mode"
deactivated it.

#599: one-shot independent modes (/hui-commit etc.) permanently
overwrote the active prose level, and the plugin-namespaced
/hui:hui-commit|-review variants were not recognized at all.
"""

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TRACKER = REPO_ROOT / "src" / "hooks" / "hui-mode-tracker.js"


class ModeTrackerTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory(prefix="hui-tracker-")
        self.claude_dir = Path(self._tmp.name) / ".claude"
        self.claude_dir.mkdir(parents=True)
        self.flag = self.claude_dir / ".hui-active"
        self.prev = self.claude_dir / ".hui-active.prev"

    def tearDown(self):
        self._tmp.cleanup()

    def send(self, prompt, transcript_path=None):
        env = os.environ.copy()
        env.pop("HUI_DEFAULT_MODE", None)
        env["HOME"] = self._tmp.name
        env["USERPROFILE"] = self._tmp.name
        env["CLAUDE_CONFIG_DIR"] = str(self.claude_dir)
        payload = {"prompt": prompt}
        if transcript_path:
            payload["transcript_path"] = str(transcript_path)
        return subprocess.run(
            ["node", str(TRACKER)],
            cwd=REPO_ROOT,
            env=env,
            input=json.dumps(payload),
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            check=True,
        )

    def flag_value(self):
        return self.flag.read_text() if self.flag.exists() else None

    # ── #598: deactivation word orders ──────────────────────────────────

    def test_stop_hui_alias_deactivates(self):
        self.flag.write_text("full")
        self.send("stop-hui")
        self.assertIsNone(self.flag_value())

    def test_turn_hui_mode_off_deactivates(self):
        # Pre-fix: this ACTIVATED hui and downgraded ultra -> full.
        self.flag.write_text("ultra")
        self.send("turn hui mode off")
        self.assertIsNone(self.flag_value())

    def test_turn_hui_off_deactivates(self):
        self.flag.write_text("full")
        self.send("turn hui off")
        self.assertIsNone(self.flag_value())

    def test_turn_off_hui_deactivates(self):
        self.flag.write_text("full")
        self.send("turn off hui")
        self.assertIsNone(self.flag_value())

    def test_stop_hui_multiline_deactivates(self):
        # Pre-fix: `.*` without the s flag never matched across lines.
        self.flag.write_text("ultra")
        self.send("stop\nhui")
        self.assertIsNone(self.flag_value())

    def test_normal_mode_command_deactivates(self):
        self.flag.write_text("full")
        self.send("normal mode")
        self.assertIsNone(self.flag_value())

    def test_back_to_normal_mode_deactivates(self):
        self.flag.write_text("full")
        self.send("back to normal mode please")
        self.assertIsNone(self.flag_value())

    def test_vim_normal_mode_does_not_deactivate(self):
        self.flag.write_text("full")
        self.send("how do I exit vim normal mode")
        self.assertEqual(self.flag_value(), "full")

    # ── #598: activation guards ─────────────────────────────────────────

    def test_enable_hui_with_stop_elsewhere_activates(self):
        # Pre-fix: "stop" anywhere suppressed activation, then the
        # deactivation regex matched "hui and stop" and deleted the flag.
        self.flag.write_text("full")
        self.send("enable hui and stop apologizing")
        self.assertEqual(self.flag_value(), "full")

    def test_question_does_not_activate(self):
        self.send("what is hui mode?")
        self.assertIsNone(self.flag_value())
        self.send("does hui lite mode drop articles?")
        self.assertIsNone(self.flag_value())

    def test_scoped_brevity_does_not_activate(self):
        self.send("be brief in the summary section")
        self.assertIsNone(self.flag_value())

    def test_unscoped_brevity_activates(self):
        self.send("be brief")
        self.assertEqual(self.flag_value(), "full")

    def test_activate_hui_still_works(self):
        self.send("activate hui")
        self.assertEqual(self.flag_value(), "full")

    def test_turn_on_hui_mode_still_works(self):
        self.send("turn on hui mode")
        self.assertEqual(self.flag_value(), "full")

    def test_talk_like_hui_still_works(self):
        self.send("talk like a hui")
        self.assertEqual(self.flag_value(), "full")

    def test_bare_hui_mode_still_works(self):
        self.send("hui mode")
        self.assertEqual(self.flag_value(), "full")

    # ── slash commands ──────────────────────────────────────────────────

    def test_slash_hui_level_switch(self):
        self.send("/hui ultra")
        self.assertEqual(self.flag_value(), "ultra")

    def test_slash_hui_off(self):
        self.flag.write_text("full")
        self.send("/hui off")
        self.assertIsNone(self.flag_value())

    def test_hyphenated_mode_commands(self):
        for command, mode in [
            ("/hui-global", "full"),
            ("/hui-lite", "lite"),
            ("/hui-ultra", "ultra"),
            ("/hui-wenyan", "wenyan"),
            ("/hui-wenyan-lite", "wenyan-lite"),
            ("/hui-wenyan-full", "wenyan"),
            ("/hui-wenyan-ultra", "wenyan-ultra"),
            ("/hui:hui-global", "full"),
            ("/hui:hui-lite", "lite"),
            ("/hui:hui-ultra", "ultra"),
            ("/hui:hui-wenyan", "wenyan"),
            ("/hui:hui-wenyan-lite", "wenyan-lite"),
            ("/hui:hui-wenyan-full", "wenyan"),
            ("/hui:hui-wenyan-ultra", "wenyan-ultra"),
        ]:
            self.send(command)
            self.assertEqual(self.flag_value(), mode, command)

    def test_session_compact_does_not_change_global_mode(self):
        transcript = Path(self._tmp.name) / "session.jsonl"
        transcript.write_text(json.dumps({"message": {"role": "user", "content": "hello"}}) + "   \n", encoding="utf-8")
        self.send("/hui-global")
        result = self.send("/hui-session --compact", transcript)
        self.assertEqual(self.flag_value(), "full")
        self.assertIn("历史会话压缩副本", result.stdout)
        self.assertTrue((Path(self._tmp.name) / "session.hui-compact.jsonl").exists())

    # ── #599: one-shot independent modes ────────────────────────────────

    def test_commit_restores_prior_level_on_next_prompt(self):
        self.flag.write_text("ultra")
        self.send("/hui-commit")
        self.assertEqual(self.flag_value(), "commit")
        r = self.send("ordinary follow-up question")
        self.assertEqual(self.flag_value(), "ultra")
        self.assertIn("HUI MODE ACTIVE (ultra)", r.stdout)

    def test_commit_with_no_prior_mode_deactivates_after(self):
        self.send("/hui-commit")
        self.assertEqual(self.flag_value(), "commit")
        r = self.send("ordinary follow-up question")
        self.assertIsNone(self.flag_value())
        self.assertNotIn("HUI MODE ACTIVE", r.stdout)

    def test_chained_independent_modes_keep_original_prev(self):
        self.flag.write_text("wenyan-ultra")
        self.send("/hui-commit")
        self.send("/hui-review")
        self.assertEqual(self.flag_value(), "review")
        self.send("ordinary follow-up question")
        self.assertEqual(self.flag_value(), "wenyan-ultra")

    def test_namespaced_commit_and_review_recognized(self):
        # Pre-fix: only compress and stats had the /hui:hui- variant.
        self.flag.write_text("full")
        self.send("/hui:hui-commit")
        self.assertEqual(self.flag_value(), "commit")
        self.send("next prompt")  # restore
        self.send("/hui:hui-review")
        self.assertEqual(self.flag_value(), "review")

    def test_no_reinforcement_during_independent_turn(self):
        self.flag.write_text("full")
        r = self.send("/hui-commit")
        self.assertNotIn("HUI MODE ACTIVE", r.stdout)

    def test_deactivation_clears_saved_prev(self):
        self.flag.write_text("ultra")
        self.send("/hui-commit")
        self.send("stop hui")
        self.assertIsNone(self.flag_value())
        self.assertFalse(self.prev.exists(), "prev file must not survive deactivation")
        self.send("ordinary prompt")
        self.assertIsNone(self.flag_value(), "nothing should resurrect the mode")


if __name__ == "__main__":
    unittest.main()
