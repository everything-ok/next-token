#!/usr/bin/env node
// Tests for /hui-stats — local observed session usage and hook integration.

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STATS = path.join(ROOT, 'src', 'hooks', 'hui-stats.js');
const TRACKER = path.join(ROOT, 'src', 'hooks', 'hui-mode-tracker.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hui-stats-test-'));
  try {
    fn(tmp);
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`  ✗ ${name}\n    ${error.message}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function makeSession(dir, lines) {
  const projectDir = path.join(dir, '.claude', 'projects', 'p');
  fs.mkdirSync(projectDir, { recursive: true });
  const sessionFile = path.join(projectDir, 's.jsonl');
  fs.writeFileSync(sessionFile, lines.map(line => JSON.stringify(line)).join('\n'));
  return sessionFile;
}

function runStats(args, claudeDir) {
  return execFileSync(process.execPath, [STATS, ...args], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir },
  });
}

console.log('hui-stats tests\n');

test('reads observed session token counts', (tmp) => {
  const session = makeSession(tmp, [
    { type: 'assistant', message: { usage: { output_tokens: 100, cache_read_input_tokens: 200 } } },
    { type: 'user', message: { content: 'hi' } },
    { type: 'assistant', message: { usage: { output_tokens: 50, cache_read_input_tokens: 50 } } },
  ]);
  const output = runStats(['--session-file', session], path.join(tmp, '.claude'));
  assert.match(output, /本地会话用量/);
  assert.match(output, /回复轮次：\s+2/);
  assert.match(output, /输出 token：\s+150/);
  assert.match(output, /缓存读取 token：\s+250/);
  assert.match(output, /不推算节省、成本或基线/);
  assert.doesNotMatch(output, /saved|saving|USD|65%/i);
});

test('records only observed counts in history', (tmp) => {
  const session = makeSession(tmp, [
    { type: 'assistant', message: { usage: { output_tokens: 350, cache_read_input_tokens: 25 } } },
  ]);
  const claudeDir = path.join(tmp, '.claude');
  runStats(['--session-file', session], claudeDir);
  const historyPath = path.join(claudeDir, '.hui-history.jsonl');
  const entry = JSON.parse(fs.readFileSync(historyPath, 'utf8').trim());
  assert.deepStrictEqual(Object.keys(entry).sort(), ['cache_read_tokens', 'output_tokens', 'session_id', 'ts', 'turns']);
  assert.strictEqual(entry.output_tokens, 350);
  assert.strictEqual(entry.cache_read_tokens, 25);
  assert.strictEqual(entry.turns, 1);
  assert.ok(!fs.existsSync(path.join(claudeDir, '.hui-statusline-suffix')));
});

test('--all aggregates latest observed snapshot per session', (tmp) => {
  const claudeDir = path.join(tmp, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  const history = [
    { ts: 1000, session_id: 'a', output_tokens: 100, cache_read_tokens: 10, turns: 1, est_saved_tokens: 999 },
    { ts: 2000, session_id: 'b', output_tokens: 50, cache_read_tokens: 20, turns: 1 },
    { ts: 3000, session_id: 'b', output_tokens: 200, cache_read_tokens: 30, turns: 3 },
  ];
  fs.writeFileSync(path.join(claudeDir, '.hui-history.jsonl'), history.map(item => JSON.stringify(item)).join('\n') + '\n');
  const output = runStats(['--all'], claudeDir);
  assert.match(output, /会话：\s+2/);
  assert.match(output, /回复轮次：\s+4/);
  assert.match(output, /输出 token：\s+300/);
  assert.match(output, /缓存读取 token：\s+40/);
  assert.doesNotMatch(output, /999|saved|USD/i);
});

test('--since filters history window', (tmp) => {
  const claudeDir = path.join(tmp, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  const now = Date.now();
  const history = [
    { ts: now - 2 * 86_400_000, session_id: 'old', output_tokens: 100, cache_read_tokens: 10, turns: 1 },
    { ts: now - 10 * 60_000, session_id: 'new', output_tokens: 50, cache_read_tokens: 5, turns: 2 },
  ];
  fs.writeFileSync(path.join(claudeDir, '.hui-history.jsonl'), history.map(item => JSON.stringify(item)).join('\n') + '\n');
  const output = runStats(['--since', '1d'], claudeDir);
  assert.match(output, /最近 1d/);
  assert.match(output, /会话：\s+1/);
  assert.match(output, /输出 token：\s+50/);
});

test('--since rejects malformed duration', (tmp) => {
  const claudeDir = path.join(tmp, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  assert.throws(() => runStats(['--since', 'sometime'], claudeDir), /Command failed/);
});

test('mode tracker returns local usage without changing active mode', (tmp) => {
  const session = makeSession(tmp, [
    { type: 'assistant', message: { usage: { output_tokens: 100 } } },
  ]);
  const claudeDir = path.join(tmp, '.claude');
  fs.writeFileSync(path.join(claudeDir, '.hui-active'), 'full');
  const output = execFileSync(process.execPath, [TRACKER], {
    input: JSON.stringify({ prompt: '/hui-stats', transcript_path: session }),
    encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir, HOME: tmp },
  });
  const result = JSON.parse(output);
  assert.strictEqual(result.decision, 'block');
  assert.match(result.reason, /本地会话用量/);
  assert.strictEqual(fs.readFileSync(path.join(claudeDir, '.hui-active'), 'utf8'), 'full');
});

test('mode tracker renders demo without state writes', (tmp) => {
  const claudeDir = path.join(tmp, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  const output = execFileSync(process.execPath, [TRACKER], {
    input: JSON.stringify({ prompt: '/hui demo' }),
    encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir, HOME: tmp },
  });
  const result = JSON.parse(output);
  assert.strictEqual(result.decision, 'block');
  assert.match(result.reason, /本地文本示例/);
  assert.match(result.reason, /不调用模型/);
  for (const file of ['.hui-active', '.hui-active.prev', '.hui-mode-log.jsonl', '.hui-history.jsonl', '.hui-statusline-suffix']) {
    assert.ok(!fs.existsSync(path.join(claudeDir, file)), `${file} should not exist`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
