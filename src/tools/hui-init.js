#!/usr/bin/env node
// hui init — drop the always-on hui activation rule into a target
// repo for every IDE agent we support. Idempotent. Safe to re-run.
//
// Usage:
//   node src/tools/hui-init.js [target-dir] [--dry-run] [--force] [--only <agent>]
//   node src/tools/hui-init.js [target-dir] --check-conflicts [--json] [--only <agent>]
//   curl -fsSL https://raw.githubusercontent.com/HUI/next-token/main/src/tools/hui-init.js | node - [args]
//
// Without args, runs in cwd. Generates the rule files for Cursor, Windsurf,
// Cline, Copilot, and AGENTS.md. Does NOT modify CLAUDE.md or compress
// existing memory files — that's the job of `/hui:compress`.

const fs = require('fs');
const path = require('path');

// Embedded so the tool works standalone (npx-style) without the src/rules/ dir.
// Mirrors src/rules/hui-activate.md verbatim — keep these in sync.
const RULE_BODY = `Respond terse like smart hui. All technical substance stay. Only fluff die.

Rules:
- Drop: articles (a/an/the), filler (just/really/basically), pleasantries, hedging
- Fragments OK. Short synonyms. Technical terms exact. Code unchanged.
- Pattern: [thing] [action] [reason]. [next step].
- Not: "Sure! I'd be happy to help you with that."
- Yes: "Bug in auth middleware. Fix:"

Switch level: /hui lite|full|ultra|wenyan
Stop: "stop hui" or "normal mode"

Auto-Clarity: drop hui for security warnings, irreversible actions, user confused. Resume after.

Boundaries: code/commits/PRs written normal.
`;

const SENTINEL = 'Respond terse like smart hui';

// OpenClaw is a global workspace tool (not per-repo) and needs two write
// targets — a skill folder + a SOUL.md bootstrap block. The shared helper
// lives at bin/lib/openclaw.js; we require it lazily so hui-init.js
// keeps working when run standalone (curl|node) without the helper on disk.
function loadOpenclawHelper() {
  try {
    return require(path.join(__dirname, '..', '..', 'bin', 'lib', 'openclaw.js'));
  } catch (_) { return null; }
}

const AGENTS = [
  { id: 'cursor',   file: '.cursor/rules/hui.mdc',
    frontmatter: '---\ndescription: "Hui mode — concise technical communication with clarity and safety fallbacks"\nalwaysApply: true\n---\n\n',
    mode: 'replace' },
  { id: 'windsurf', file: '.windsurf/rules/hui.md',
    frontmatter: '---\ntrigger: always_on\n---\n\n',
    mode: 'replace' },
  { id: 'cline',    file: '.clinerules/hui.md',
    frontmatter: '',
    mode: 'replace' },
  { id: 'copilot',  file: '.github/copilot-instructions.md',
    frontmatter: '',
    mode: 'append' },
  { id: 'opencode', file: '.opencode/AGENTS.md',
    frontmatter: '',
    mode: 'append' },
  { id: 'agents',   file: 'AGENTS.md',
    frontmatter: '',
    mode: 'append' },
  // OpenClaw — global workspace install, not per-repo. The `installer`
  // callback escape hatch bypasses the file/frontmatter/mode triple and
  // hands off to the shared helper. `description` is what `--help` prints.
  { id: 'openclaw', description: '~/.openclaw/workspace/{skills/hui/, SOUL.md}',
    installer: 'openclaw' },
];

function loadRuleBody() {
  // Prefer the in-repo source-of-truth when available.
  try {
    const local = path.join(__dirname, '..', 'rules', 'hui-activate.md');
    if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8').trimEnd() + '\n';
  } catch (e) {}
  return RULE_BODY;
}

function processAgent(agent, targetDir, ruleBody, opts) {
  if (agent.installer === 'openclaw') {
    return processOpenclaw(opts);
  }
  const fullPath = path.join(targetDir, agent.file);
  const exists = fs.existsSync(fullPath);

  if (!exists) {
    if (!opts.dryRun) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, agent.frontmatter + ruleBody, { mode: 0o644 });
    }
    return { status: 'added', label: '+' };
  }

  const existing = fs.readFileSync(fullPath, 'utf8');
  if (existing.includes(SENTINEL)) {
    return { status: 'skipped-already-installed', label: '=' };
  }

  if (agent.mode === 'append') {
    if (!opts.dryRun) {
      const sep = existing.endsWith('\n\n') ? '' : (existing.endsWith('\n') ? '\n' : '\n\n');
      fs.writeFileSync(fullPath, existing + sep + ruleBody, { mode: 0o644 });
    }
    return { status: 'appended', label: '~' };
  }

  if (opts.force) {
    if (!opts.dryRun) {
      fs.writeFileSync(fullPath, agent.frontmatter + ruleBody, { mode: 0o644 });
    }
    return { status: 'overwritten', label: '!' };
  }

  return { status: 'skipped-exists', label: '?' };
}

function processOpenclaw(opts) {
  const helper = loadOpenclawHelper();
  if (!helper) {
    return {
      status: 'unsupported-standalone',
      label: 'x',
      detail: '~/.openclaw/workspace (helper unavailable in standalone curl|node mode — use `npx -y next-token -- --only openclaw`)',
    };
  }
  const repoRoot = path.resolve(__dirname, '..', '..');
  const log = {
    write: (_) => {},
    note: (_) => {},
    warn: (_) => {},
  };
  const r = helper.installOpenclaw({
    workspace: process.env.OPENCLAW_WORKSPACE || undefined,
    repoRoot,
    dryRun: opts.dryRun,
    force: opts.force,
    log,
  });
  if (!r.ok) {
    return { status: 'skipped-' + (r.reason || 'failed'), label: '?', detail: helper.resolveWorkspace ? helper.resolveWorkspace() : '~/.openclaw/workspace' };
  }
  if (r.dryRun) return { status: 'would-add', label: '+', detail: helper.resolveWorkspace() };
  return { status: 'installed', label: '+', detail: helper.resolveWorkspace() };
}

function parseArgs(argv) {
  const opts = {
    checkConflicts: false,
    dryRun: false,
    force: false,
    json: false,
    only: null,
    target: process.cwd(),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check-conflicts') opts.checkConflicts = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--force' || a === '-f') opts.force = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--only') { opts.only = argv[++i]; }
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (!a.startsWith('-')) opts.target = path.resolve(a);
  }
  return opts;
}

function selectedRepoAgents(only) {
  return AGENTS.filter((agent) => !agent.installer && (!only || only === agent.id));
}

// A managed target conflicts when it is occupied by a rule that this tool did
// not install. These are exactly the files normal `hui init` would skip unless
// invoked with --force. Keep this function read-only so it is safe for CI.
function scanConflicts(targetDir, only) {
  const conflicts = [];
  for (const agent of selectedRepoAgents(only)) {
    const fullPath = path.join(targetDir, agent.file);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(SENTINEL)) {
      conflicts.push({
        agent: agent.id,
        path: agent.file,
        reason: 'existing-rule-without-hui-sentinel',
      });
    }
  }
  return conflicts.sort((left, right) => left.path.localeCompare(right.path));
}

function conflictReport(targetDir, only) {
  return {
    target: path.resolve(targetDir),
    checked: selectedRepoAgents(only).map((agent) => agent.file).sort(),
    conflicts: scanConflicts(targetDir, only),
  };
}

function printConflictReport(report, json) {
  if (json) {
    console.log(JSON.stringify({
      status: report.conflicts.length ? 'conflicts-found' : 'ok',
      target: report.target,
      checked: report.checked,
      conflicts: report.conflicts,
    }, null, 2));
    return;
  }

  console.log(`hui init conflict check — ${report.target}`);
  if (report.conflicts.length === 0) {
    console.log('No managed rule conflicts found.');
    return;
  }
  console.log(`Found ${report.conflicts.length} managed rule conflict(s):`);
  for (const conflict of report.conflicts) {
    console.log(`  ! ${conflict.path} [${conflict.agent}] — ${conflict.reason}`);
  }
  console.log('Resolve the existing rule, or rerun hui init with --force to replace it.');
}

function help() {
  console.log(`hui init — drop always-on hui rule into a target repo

Usage:
  hui-init.js [target-dir] [--dry-run] [--force] [--only <agent>]
  hui-init.js [target-dir] --check-conflicts [--json] [--only <agent>]

Defaults to current working directory. Idempotent — safe to re-run.

Targets installed:
${AGENTS.map(a => `  ${a.id.padEnd(10)} ${a.file || a.description || ''}`).join('\n')}

Flags:
  --check-conflicts  scan managed rule targets without writing; exits 1 on conflicts
  --json             emit deterministic JSON (only with --check-conflicts)
  --dry-run          show what would change, do not write
  --force            overwrite existing rule files (default: skip)
  --only <id>        only install or scan for one agent (id from list above)
`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { help(); return; }

  if (opts.checkConflicts) {
    const report = conflictReport(opts.target, opts.only);
    printConflictReport(report, opts.json);
    if (report.conflicts.length) process.exitCode = 1;
    return;
  }

  console.log(`🪨 hui init — ${opts.target}${opts.dryRun ? ' (dry run)' : ''}\n`);

  const ruleBody = loadRuleBody();
  const counts = { added: 0, appended: 0, overwritten: 0, skipped: 0 };

  for (const agent of AGENTS) {
    if (opts.only && opts.only !== agent.id) continue;
    const result = processAgent(agent, opts.target, ruleBody, opts);
    const target = agent.file || result.detail || agent.description || agent.id;
    console.log(`  ${result.label} ${target} (${result.status})`);
    if (result.status === 'added' || result.status === 'installed' || result.status === 'would-add') counts.added++;
    else if (result.status === 'appended') counts.appended++;
    else if (result.status === 'overwritten') counts.overwritten++;
    else counts.skipped++;
  }

  console.log(`\n${counts.added} added, ${counts.appended} appended, ` +
              `${counts.overwritten} overwritten, ${counts.skipped} skipped`);
  if (opts.dryRun) console.log('(dry run — no files were written)');
}

// Run when executed directly AND when piped via `curl … | node -` (the
// documented standalone path, #603): under stdin execution require.main is
// undefined and module.id is '[stdin]', so the classic guard alone silently
// no-ops with exit code 0 — the worst kind of failure.
if (require.main === module || (!require.main && module.id === '[stdin]')) main();

module.exports = {
  processAgent,
  loadRuleBody,
  AGENTS,
  SENTINEL,
  RULE_BODY,
  scanConflicts,
  conflictReport,
  parseArgs,
};
