import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent


class HookScriptTests(unittest.TestCase):
    def run_cmd(self, cmd, home, extra_env=None):
        env = os.environ.copy()
        env.pop("CLAUDE_PLUGIN_ROOT", None)
        env["HOME"] = str(home)
        env["CLAUDE_CONFIG_DIR"] = str(home / ".claude")
        env["PYTHONIOENCODING"] = "utf-8"
        if extra_env:
            env.update(extra_env)
        return subprocess.run(
            cmd,
            cwd=REPO_ROOT,
            env=env,
            text=True,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            check=True,
        )

    def test_install_upgrades_old_two_file_install(self):
        with tempfile.TemporaryDirectory(prefix="hui-hooks-upgrade-") as tmp:
            home = Path(tmp)
            hooks_dir = home / ".claude" / "hooks"
            hooks_dir.mkdir(parents=True)
            (home / ".claude" / "settings.json").write_text("{}\n")
            (hooks_dir / "hui-activate.js").write_text("")
            (hooks_dir / "hui-mode-tracker.js").write_text("")

            self.run_cmd(["bash", "src/hooks/install.sh"], home)

            statusline = hooks_dir / "hui-statusline.sh"
            self.assertTrue(statusline.exists(), "upgrade should install statusline script")

            settings = json.loads((home / ".claude" / "settings.json").read_text())
            self.assertIn("statusLine", settings)
            self.assertIn(statusline.as_posix(), settings["statusLine"]["command"].replace("\\", "/"))

    def test_install_reconfigures_missing_statusline(self):
        with tempfile.TemporaryDirectory(prefix="hui-hooks-statusline-") as tmp:
            home = Path(tmp)
            claude_dir = home / ".claude"
            hooks_dir = claude_dir / "hooks"
            hooks_dir.mkdir(parents=True)

            for name in ("hui-activate.js", "hui-mode-tracker.js", "hui-statusline.sh"):
                (hooks_dir / name).write_text("")

            settings = {
                "hooks": {
                    "SessionStart": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": f'node "{hooks_dir / "hui-activate.js"}"',
                                }
                            ]
                        }
                    ],
                    "UserPromptSubmit": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": f'node "{hooks_dir / "hui-mode-tracker.js"}"',
                                }
                            ]
                        }
                    ],
                }
            }
            (claude_dir / "settings.json").write_text(json.dumps(settings, indent=2) + "\n")

            result = self.run_cmd(["bash", "src/hooks/install.sh"], home)

            self.assertNotIn("Nothing to do", result.stdout)

            updated = json.loads((claude_dir / "settings.json").read_text())
            self.assertIn("statusLine", updated)
            self.assertIn(
                (hooks_dir / "hui-statusline.sh").as_posix(),
                updated["statusLine"]["command"].replace("\\", "/"),
            )

    def test_uninstall_preserves_custom_statusline(self):
        with tempfile.TemporaryDirectory(prefix="hui-hooks-uninstall-") as tmp:
            home = Path(tmp)
            claude_dir = home / ".claude"
            hooks_dir = claude_dir / "hooks"
            hooks_dir.mkdir(parents=True)

            for name in ("hui-activate.js", "hui-mode-tracker.js", "hui-statusline.sh"):
                (hooks_dir / name).write_text("")

            settings = {
                "statusLine": {
                    "type": "command",
                    "command": "bash /tmp/custom-status-with-hui.sh",
                },
                "hooks": {
                    "SessionStart": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": f'node "{hooks_dir / "hui-activate.js"}"',
                                }
                            ]
                        }
                    ],
                    "UserPromptSubmit": [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": f'node "{hooks_dir / "hui-mode-tracker.js"}"',
                                }
                            ]
                        }
                    ],
                },
            }
            (claude_dir / "settings.json").write_text(json.dumps(settings, indent=2) + "\n")

            self.run_cmd(["bash", "src/hooks/uninstall.sh"], home)

            updated = json.loads((claude_dir / "settings.json").read_text())
            self.assertEqual(
                updated["statusLine"]["command"],
                "bash /tmp/custom-status-with-hui.sh",
            )
            self.assertNotIn("hooks", updated)

    def test_activate_does_not_nudge_when_custom_statusline_exists(self):
        with tempfile.TemporaryDirectory(prefix="hui-hooks-activate-") as tmp:
            home = Path(tmp)
            claude_dir = home / ".claude"
            claude_dir.mkdir(parents=True)
            (claude_dir / "settings.json").write_text(
                json.dumps(
                    {
                        "statusLine": {
                            "type": "command",
                            "command": "bash /tmp/my-statusline.sh",
                        }
                    }
                )
                + "\n"
            )

            result = self.run_cmd(["node", "src/hooks/hui-activate.js"], home)

            self.assertNotIn("STATUSLINE SETUP NEEDED", result.stdout)
            self.assertEqual((claude_dir / ".hui-active").read_text(), "full")

    # Regression for #587/#589 — hook at <root>/src/hooks/ must resolve SKILL.md
    # at <root>/skills/hui/, not the nonexistent <root>/src/skills/.
    def test_activate_emits_skill_md_not_fallback_from_repo_layout(self):
        with tempfile.TemporaryDirectory(prefix="hui-hooks-skillpath-") as tmp:
            home = Path(tmp)
            (home / ".claude").mkdir(parents=True)

            result = self.run_cmd(["node", "src/hooks/hui-activate.js"], home)

            # Intensity table exists only in SKILL.md, never in the fallback
            self.assertIn("## Intensity", result.stdout)
            # Default mode is full — table filtered to the active level's row
            self.assertIn("| **full** |", result.stdout)
            self.assertNotIn("| **lite** |", result.stdout)

    def test_activate_finds_skill_beside_config_dir_hooks(self):
        # Standalone layout: hooks at $CLAUDE_CONFIG_DIR/hooks/, skill installed
        # at $CLAUDE_CONFIG_DIR/skills/hui/SKILL.md
        with tempfile.TemporaryDirectory(prefix="hui-hooks-standalone-") as tmp:
            home = Path(tmp)
            claude_dir = home / ".claude"
            hooks_dir = claude_dir / "hooks"
            hooks_dir.mkdir(parents=True)
            for name in ("hui-activate.js", "hui-config.js", "package.json"):
                shutil.copy(REPO_ROOT / "src" / "hooks" / name, hooks_dir / name)
            skill_dir = claude_dir / "skills" / "hui"
            skill_dir.mkdir(parents=True)
            (skill_dir / "SKILL.md").write_text(
                "---\nname: hui\n---\nSTANDALONE MARKER RULESET\n"
            )

            result = self.run_cmd(["node", str(hooks_dir / "hui-activate.js")], home)

            self.assertIn("STANDALONE MARKER RULESET", result.stdout)

    def test_activate_prefers_claude_plugin_root(self):
        with tempfile.TemporaryDirectory(prefix="hui-hooks-pluginroot-") as tmp:
            home = Path(tmp)
            (home / ".claude").mkdir(parents=True)
            plugin_root = home / "plugin-cache"
            skill_dir = plugin_root / "skills" / "hui"
            skill_dir.mkdir(parents=True)
            (skill_dir / "SKILL.md").write_text(
                "---\nname: hui\n---\nPLUGIN ROOT MARKER RULESET\n"
            )

            result = self.run_cmd(
                ["node", "src/hooks/hui-activate.js"],
                home,
                extra_env={"CLAUDE_PLUGIN_ROOT": str(plugin_root)},
            )

            self.assertIn("PLUGIN ROOT MARKER RULESET", result.stdout)

    def test_activate_emits_canonical_constraints(self):
        with tempfile.TemporaryDirectory(prefix="hui-hooks-constraints-") as tmp:
            home = Path(tmp)
            (home / ".claude").mkdir(parents=True)

            result = self.run_cmd(["node", "src/hooks/hui-activate.js"], home)

            self.assertIn("## Constraints Active", result.stdout)
            self.assertIn("## Evidence and Uncertainty", result.stdout)
            self.assertNotIn("Proactively offer", result.stdout)

    def test_activate_prefers_plugin_root_constraints(self):
        with tempfile.TemporaryDirectory(prefix="hui-hooks-constraint-root-") as tmp:
            home = Path(tmp)
            (home / ".claude").mkdir(parents=True)
            plugin_root = home / "plugin-cache"
            hui_dir = plugin_root / "skills" / "hui"
            constraints_dir = plugin_root / "skills" / "hui-constraints"
            hui_dir.mkdir(parents=True)
            constraints_dir.mkdir(parents=True)
            (hui_dir / "SKILL.md").write_text("---\nname: hui\n---\nPLUGIN HUI\n")
            (constraints_dir / "SKILL.md").write_text("---\nname: hui-constraints\n---\nPLUGIN CONSTRAINTS\n")

            result = self.run_cmd(
                ["node", "src/hooks/hui-activate.js"],
                home,
                extra_env={"CLAUDE_PLUGIN_ROOT": str(plugin_root)},
            )

            self.assertIn("PLUGIN HUI", result.stdout)
            self.assertIn("PLUGIN CONSTRAINTS", result.stdout)


if __name__ == "__main__":
    unittest.main()
