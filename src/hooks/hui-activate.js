#!/usr/bin/env node
// hui — Claude Code SessionStart activation hook
//
// Runs on every session start:
//   1. Writes flag file at $CLAUDE_CONFIG_DIR/.hui-active (statusline reads this)
//   2. Emits hui ruleset as hidden SessionStart context
//   3. Detects missing statusline config and emits setup nudge

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDefaultMode, safeWriteFlag, recordModeChange } = require('./hui-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.hui-active');
const settingsPath = path.join(claudeDir, 'settings.json');

// Apply per-agent model overrides from env vars before emitting rules.
// Best-effort: any error is swallowed so SessionStart is never blocked.
try {
  const { applyOverrides, resolvePluginRoot } = require('./huicrew-model-overrides');
  applyOverrides(resolvePluginRoot(__dirname));
} catch (e) {}

const mode = getDefaultMode();

// "off" mode — skip activation entirely, don't write flag or emit rules
if (mode === 'off') {
  recordModeChange(claudeDir, null); // #601: timestamped transition log
  try { fs.unlinkSync(flagPath); } catch (e) {}
  process.stdout.write('OK');
  process.exit(0);
}

// 1. Write flag file (symlink-safe)
recordModeChange(claudeDir, mode); // #601
safeWriteFlag(flagPath, mode);

// 2. Emit full hui ruleset, filtered to the active intensity level.
//    The old 2-sentence summary was too weak — models drifted back to verbose
//    mid-conversation, especially after context compression pruned it away.
//    Full rules with examples anchor behavior much more reliably.
//
//    Reads SKILL.md at runtime so edits to the source of truth propagate
//    automatically — no hardcoded duplication to go stale.

// Modes that have their own independent skill files — not hui intensity levels.
// For these, emit a short activation line; the skill itself handles behavior.
const INDEPENDENT_MODES = new Set(['commit', 'review', 'compress']);

if (INDEPENDENT_MODES.has(mode)) {
  process.stdout.write('HUI MODE ACTIVE — level: ' + mode + '. Behavior defined by /hui-' + mode + ' skill.');
  process.exit(0);
}

// Resolve the canonical label for wenyan alias
const modeLabel = mode === 'wenyan' ? 'wenyan-full' : mode;

// Read SKILL.md — the single source of truth for hui behavior.
// Candidate locations, tried in order (#587/#589 — the old single '..' path
// resolved to <plugin_root>/src/skills/, which doesn't exist, so plugin
// installs silently used the stale fallback ruleset):
//   1. $CLAUDE_PLUGIN_ROOT/skills/hui/SKILL.md — Claude Code sets
//      CLAUDE_PLUGIN_ROOT when invoking plugin hooks; authoritative when present.
//   2. ../../skills/hui/SKILL.md — hook at <plugin_root>/src/hooks/
//      (plugin.json layout) or a repo checkout.
//   3. ../skills/hui/SKILL.md — standalone install with hooks at
//      $CLAUDE_CONFIG_DIR/hooks/ and the skill at $CLAUDE_CONFIG_DIR/skills/hui/.
// All misses fall through to the hardcoded fallback ruleset below.
const skillCandidates = [];
if (process.env.CLAUDE_PLUGIN_ROOT) {
  skillCandidates.push(path.join(process.env.CLAUDE_PLUGIN_ROOT, 'skills', 'hui', 'SKILL.md'));
}
skillCandidates.push(
  path.join(__dirname, '..', '..', 'skills', 'hui', 'SKILL.md'),
  path.join(__dirname, '..', 'skills', 'hui', 'SKILL.md')
);

let skillContent = '';
for (const candidate of skillCandidates) {
  try {
    skillContent = fs.readFileSync(candidate, 'utf8');
    break;
  } catch (e) { /* try next candidate */ }
}

let output;

if (skillContent) {
  // Strip YAML frontmatter
  const body = skillContent.replace(/^---[\s\S]*?---\s*/, '');

  // Filter intensity table: keep header rows + only the active level's row
  const filtered = body.split('\n').reduce((acc, line) => {
    // Intensity table rows start with | **level** |
    const tableRowMatch = line.match(/^\|\s*\*\*(\S+?)\*\*\s*\|/);
    if (tableRowMatch) {
      // Keep only the active level's row (and always keep header/separator)
      if (tableRowMatch[1] === modeLabel) {
        acc.push(line);
      }
      return acc;
    }

    // Example lines start with "- level:" — keep only lines matching active level
    const exampleMatch = line.match(/^- (\S+?):\s/);
    if (exampleMatch) {
      if (exampleMatch[1] === modeLabel) {
        acc.push(line);
      }
      return acc;
    }

    acc.push(line);
    return acc;
  }, []);

  output = 'HUI MODE ACTIVE — level: ' + modeLabel + '\n\n' + filtered.join('\n');
} else {
  // Fallback when SKILL.md is not found (standalone hook install without skills dir).
  // This is the minimum viable ruleset — better than nothing.
  output =
    'HUI MODE ACTIVE — level: ' + modeLabel + '\n\n' +
    'Respond terse like smart hui. All technical substance stay. Only fluff die.\n\n' +
    '## Persistence\n\n' +
    'ACTIVE EVERY RESPONSE. No revert after many turns. No filler drift. Still active if unsure. Off only: "stop hui" / "normal mode".\n\n' +
    'Current level: **' + modeLabel + '**. Switch: `/hui lite|full|ultra`.\n\n' +
    '## Rules\n\n' +
    'Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging. ' +
    'Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for"). Technical terms exact. Code blocks unchanged. Errors quoted exact.\n\n' +
    "Preserve user's dominant language. User write Portuguese → reply Portuguese hui. Compress the style, not the language. Technical terms, code, API names, commands, error strings stay verbatim.\n\n" +
    'No self-reference. Never name or announce the style. No "hui mode on" tags. Output hui-only.\n\n' +
    'Pattern: `[thing] [action] [reason]. [next step].`\n\n' +
    'Not: "Sure! I\'d be happy to help you with that. The issue you\'re experiencing is likely caused by..."\n' +
    'Yes: "Bug in auth middleware. Token expiry check use `<` not `<=`. Fix:"\n\n' +
    '## Auto-Clarity\n\n' +
    'Drop hui for: security warnings, irreversible action confirmations, multi-step sequences where fragment order risks misread, user asks to clarify or repeats question. Resume hui after clear part done.\n\n' +
    '## Boundaries\n\n' +
    'Code/commits/PRs: write normal. "stop hui" or "normal mode": revert. Level persist until changed or session end.';
}

// 3. Detect missing statusline config — nudge Claude to help set it up
try {
  let hasStatusline = false;
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.statusLine) {
      hasStatusline = true;
    }
  }

  if (!hasStatusline) {
    const isWindows = process.platform === 'win32';
    const scriptName = isWindows ? 'hui-statusline.ps1' : 'hui-statusline.sh';
    const scriptPath = path.join(__dirname, scriptName);
    const command = isWindows
      ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
      : `bash "${scriptPath}"`;
    const statusLineSnippet =
      '"statusLine": { "type": "command", "command": ' + JSON.stringify(command) + ' }';
    output += "\n\n" +
      "STATUSLINE SETUP NEEDED: The hui plugin includes a statusline badge showing active mode " +
      "(e.g. [HUI], [HUI:ULTRA]). It is not configured yet. " +
      "To enable, add this to " + path.join(claudeDir, 'settings.json') + ": " +
      statusLineSnippet + " " +
      "Proactively offer to set this up for the user on first interaction.";
  }
} catch (e) {
  // Silent fail — don't block session start over statusline detection
}

process.stdout.write(output);
