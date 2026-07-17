# Installer lifecycle notes

The installer records SHA-256 digests for standalone Claude hook files in
`$CLAUDE_CONFIG_DIR/hui-install-manifest.json`. During uninstall it removes only
files whose content still matches the recorded digest. Modified files, and files
without a manifest entry, are preserved rather than guessed to be installer-owned.

Use `hui --migrate-from-hui` to inspect a legacy standalone configuration. The
planner is read-only, including with `--json`; use `--force` to apply the reported
orphan-hook, duplicate-registration, and missing-statusline repairs. `--force`
executes every writeable action shown by the planner.

Use `hui --list --json` for provider metadata. Each provider entry includes its
installation mechanism, detection rule, whether detection is soft, and supported
installer capabilities.
