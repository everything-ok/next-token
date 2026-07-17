#!/usr/bin/env node
// Tests for src/tools/hui-init.js — fixture-based.
// Run: node tests/test_hui_init.js

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INIT = path.join(ROOT, 'src', 'tools', 'hui-init.js');

let passed = 0;
let failed = 0;

// Point OPENCLAW_WORKSPACE at a nonexistent dir inside the fixture so the
// openclaw target reports skipped-workspace-missing instead of writing to
// the developer's real ~/.openclaw/workspace.
function runInit(tmp, ...args) {
  return execFileSync(process.execPath, [INIT, tmp, ...args], {
    encoding: 'utf8',
    env: { ...process.env, OPENCLAW_WORKSPACE: path.join(tmp, 'no-openclaw') },
  });
}

function runInitResult(tmp, ...args) {
  return spawnSync(process.execPath, [INIT, tmp, ...args], {
    encoding: 'utf8',
    env: { ...process.env, OPENCLAW_WORKSPACE: path.join(tmp, 'no-openclaw') },
  });
}

function test(name, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hui-init-test-'));
  try {
    fn(tmp);
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('hui-init tests\n');

test('greenfield: creates all rule files with proper frontmatter', (tmp) => {
  runInit(tmp);
  const cursor = fs.readFileSync(path.join(tmp, '.cursor/rules/hui.mdc'), 'utf8');
  assert.match(cursor, /alwaysApply: true/);
  assert.match(cursor, /Respond terse like smart hui/);
  const windsurf = fs.readFileSync(path.join(tmp, '.windsurf/rules/hui.md'), 'utf8');
  assert.match(windsurf, /trigger: always_on/);
  const cline = fs.readFileSync(path.join(tmp, '.clinerules/hui.md'), 'utf8');
  assert.match(cline, /^Respond terse/);
  const copilot = fs.readFileSync(path.join(tmp, '.github/copilot-instructions.md'), 'utf8');
  assert.match(copilot, /Respond terse/);
  const agents = fs.readFileSync(path.join(tmp, 'AGENTS.md'), 'utf8');
  assert.match(agents, /Respond terse/);
  const opencode = fs.readFileSync(path.join(tmp, '.opencode/AGENTS.md'), 'utf8');
  assert.match(opencode, /Respond terse/);
});

test('idempotent: re-running on a clean install skips all', (tmp) => {
  runInit(tmp);
  const out = runInit(tmp);
  // 6 repo rule files skipped-already-installed + openclaw skipped (no workspace)
  assert.match(out, /7 skipped/);
  assert.doesNotMatch(out, /[1-9]\d* added/);
});

test('append mode: existing AGENTS.md gets hui appended (not replaced)', (tmp) => {
  fs.writeFileSync(path.join(tmp, 'AGENTS.md'), '# My project\n\nDo not delete me.\n');
  runInit(tmp);
  const agents = fs.readFileSync(path.join(tmp, 'AGENTS.md'), 'utf8');
  assert.match(agents, /Do not delete me/);
  assert.match(agents, /Respond terse like smart hui/);
});

test('skip mode: existing .cursor rule is not overwritten without --force', (tmp) => {
  const dir = path.join(tmp, '.cursor/rules');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'hui.mdc'), '# original\nDo not delete me.\n');
  const out = runInit(tmp);
  assert.match(out, /\? .*\.cursor\/rules\/hui\.mdc/);
  const after = fs.readFileSync(path.join(dir, 'hui.mdc'), 'utf8');
  assert.strictEqual(after, '# original\nDo not delete me.\n');
});

test('--force overwrites existing rule files', (tmp) => {
  const dir = path.join(tmp, '.cursor/rules');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'hui.mdc'), '# original\n');
  runInit(tmp, '--force');
  const after = fs.readFileSync(path.join(dir, 'hui.mdc'), 'utf8');
  assert.match(after, /alwaysApply: true/);
  assert.match(after, /Respond terse/);
});

test('--dry-run: announces but writes nothing', (tmp) => {
  const out = runInit(tmp, '--dry-run');
  assert.match(out, /\(dry run\)/);
  assert.match(out, /6 added/);
  assert.ok(!fs.existsSync(path.join(tmp, '.cursor')));
  assert.ok(!fs.existsSync(path.join(tmp, '.windsurf')));
  assert.ok(!fs.existsSync(path.join(tmp, '.clinerules')));
  assert.ok(!fs.existsSync(path.join(tmp, '.github/copilot-instructions.md')));
  assert.ok(!fs.existsSync(path.join(tmp, '.opencode')));
  assert.ok(!fs.existsSync(path.join(tmp, 'AGENTS.md')));
});

test('--only filters to one target', (tmp) => {
  const out = runInit(tmp, '--only', 'cline');
  assert.match(out, /1 added/);
  assert.ok(fs.existsSync(path.join(tmp, '.clinerules/hui.md')));
  assert.ok(!fs.existsSync(path.join(tmp, '.cursor')));
});

test('detects sentinel and skips files that already have hui content', (tmp) => {
  // Hand-write a file that already contains the rule (simulating prior install).
  const dir = path.join(tmp, '.clinerules');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'hui.md'),
    '# Existing\n\nRespond terse like smart hui. Hello.\n');
  const out = runInit(tmp, '--only', 'cline');
  assert.match(out, /skipped-already-installed/);
});

test('--check-conflicts is non-mutating and exits zero without conflicts', (tmp) => {
  const result = runInitResult(tmp, '--check-conflicts');
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /No managed rule conflicts found/);
  assert.deepStrictEqual(fs.readdirSync(tmp), []);
});

test('--check-conflicts reports unmanaged managed-target files deterministically', (tmp) => {
  fs.mkdirSync(path.join(tmp, '.cursor/rules'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '.clinerules'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.cursor/rules/hui.mdc'), '# project cursor rule\n');
  fs.writeFileSync(path.join(tmp, '.clinerules/hui.md'), '# project cline rule\n');

  const result = runInitResult(tmp, '--check-conflicts');
  assert.strictEqual(result.status, 1);
  assert.match(result.stdout, /Found 2 managed rule conflict\(s\)/);
  assert.ok(result.stdout.indexOf('.clinerules/hui.md') < result.stdout.indexOf('.cursor/rules/hui.mdc'));
  assert.strictEqual(fs.readFileSync(path.join(tmp, '.cursor/rules/hui.mdc'), 'utf8'), '# project cursor rule\n');
  assert.strictEqual(fs.readFileSync(path.join(tmp, '.clinerules/hui.md'), 'utf8'), '# project cline rule\n');
});

test('--check-conflicts --json emits a stable machine-readable report', (tmp) => {
  fs.mkdirSync(path.join(tmp, '.github'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.github/copilot-instructions.md'), '# project instructions\n');

  const result = runInitResult(tmp, '--check-conflicts', '--json');
  assert.strictEqual(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.deepStrictEqual(report, {
    status: 'conflicts-found',
    target: path.resolve(tmp),
    checked: [
      '.clinerules/hui.md',
      '.cursor/rules/hui.mdc',
      '.github/copilot-instructions.md',
      '.opencode/AGENTS.md',
      '.windsurf/rules/hui.md',
      'AGENTS.md',
    ],
    conflicts: [{
      agent: 'copilot',
      path: '.github/copilot-instructions.md',
      reason: 'existing-rule-without-hui-sentinel',
    }],
  });
});

test('--check-conflicts ignores HUI-owned targets and respects --only', (tmp) => {
  fs.mkdirSync(path.join(tmp, '.cursor/rules'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '.clinerules'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.cursor/rules/hui.mdc'), 'Respond terse like smart hui\n');
  fs.writeFileSync(path.join(tmp, '.clinerules/hui.md'), '# project cline rule\n');

  const result = runInitResult(tmp, '--check-conflicts', '--only', 'cursor', '--json');
  assert.strictEqual(result.status, 0);
  assert.deepStrictEqual(JSON.parse(result.stdout).conflicts, []);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
