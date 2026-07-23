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

// 2. Emit the HUI style skill and the canonical constraints skill. Both use the
// same layout precedence so plugin, repository, and standalone installations
// consume one source of truth instead of maintaining duplicated prompts.
const SKILL_ROOTS = [];
if (process.env.CLAUDE_PLUGIN_ROOT) {
  SKILL_ROOTS.push(process.env.CLAUDE_PLUGIN_ROOT);
}
SKILL_ROOTS.push(path.join(__dirname, '..', '..'), path.join(__dirname, '..'));

function loadSkillBody(name) {
  for (const root of SKILL_ROOTS) {
    try {
      return fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8')
        .replace(/^---[\s\S]*?---\s*/, '');
    } catch (e) { /* try next layout */ }
  }
  return '';
}

const skillContent = loadSkillBody('hui');
const constraintsContent = loadSkillBody('hui-constraints');

// Modes that have their own independent skill files — not hui intensity levels.
// For these, emit a short activation line; the skill itself handles behavior.
const INDEPENDENT_MODES = new Set(['commit', 'review', 'compress']);

if (INDEPENDENT_MODES.has(mode)) {
  const coreConstraints = constraintsContent ||
    '## Core Constraints\n\nDo not invent facts, tool results, tests, deployments, or releases. State unknown or blocked information. Preserve security requirements.';
  process.stdout.write('HUI MODE ACTIVE — level: ' + mode +
    '. Behavior defined by /hui-' + mode + ' skill.\n\n## Constraints Active\n\n' + coreConstraints);
  process.exit(0);
}

// Resolve the canonical label for wenyan alias
const modeLabel = mode === 'wenyan' ? 'wenyan-full' : mode;

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

const coreConstraints = constraintsContent ||
  '## Core Constraints\n\nDo not invent facts, tool results, tests, deployments, or releases. State unknown or blocked information. Report verification performed and checks not run.';
output += '\n\n## Constraints Active\n\n' + coreConstraints;

process.stdout.write(output);
