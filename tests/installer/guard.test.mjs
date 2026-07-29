import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const GUARD = path.join(REPO_ROOT, 'src', 'hooks', 'hui-guard.js');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hui-guard-'));
}

// Write a one-line-per-entry transcript. entries: array of {type, content}
function writeTranscript(dir, entries) {
  const file = path.join(dir, 'transcript.jsonl');
  const lines = entries.map(e => JSON.stringify({
    type: e.type,
    message: { role: e.role || e.type, content: e.content },
  }));
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

function runGuard(stdin) {
  return spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify(stdin),
    encoding: 'utf8',
    timeout: 15000,
  });
}

// Stop hook stdin. last_assistant_message is the authoritative claim text;
// transcript_path is scanned for real test-tool invocations.
function stopStdin(transcriptPath, opts = {}) {
  return {
    hook_event_name: 'Stop',
    transcript_path: transcriptPath,
    stop_hook_active: !!opts.stopActive,
    ...opts.extra,
  };
}

test('blocks a false test claim with no test invocation', () => {
  const dir = tmpDir();
  try {
    const tp = writeTranscript(dir, [
      { type: 'user', content: [{ type: 'text', text: 'fix the bug' }] },
      { type: 'assistant', content: [{ type: 'text', text: 'I ran the tests and they all pass. The fix is done.' }] },
    ]);
    const r = runGuard(stopStdin(tp));
    assert.equal(r.status, 0, `exit ${r.status}: ${r.stderr}`);
    const out = JSON.parse(r.stdout);
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /no test command/i);
    assert.match(out.reason, /HUI Guard/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('passes when a real test command was executed this session', () => {
  const dir = tmpDir();
  try {
    const tp = writeTranscript(dir, [
      { type: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }] },
      { type: 'assistant', content: [{ type: 'text', text: 'Tests passed.' }] },
    ]);
    const r = runGuard(stopStdin(tp));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '', 'should not block when a test ran');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('passes when the last message makes no test claim', () => {
  const dir = tmpDir();
  try {
    const tp = writeTranscript(dir, [
      { type: 'assistant', content: [{ type: 'text', text: 'Fixed the typo in auth.js. Done.' }] },
    ]);
    const r = runGuard(stopStdin(tp));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '', 'no claim → no block');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('kill switch HUI_GUARD=0 disables the guard', () => {
  const dir = tmpDir();
  try {
    const tp = writeTranscript(dir, [
      { type: 'assistant', content: [{ type: 'text', text: 'I ran the tests and all tests pass.' }] },
    ]);
    const r = spawnSync(process.execPath, [GUARD], {
      input: JSON.stringify(stopStdin(tp)),
      env: { ...process.env, HUI_GUARD: '0' },
      encoding: 'utf8',
      timeout: 15000,
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '', 'HUI_GUARD=0 must be a no-op');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('stop_hook_active=true is a no-op (loop guard)', () => {
  const dir = tmpDir();
  try {
    const tp = writeTranscript(dir, [
      { type: 'assistant', content: [{ type: 'text', text: 'I ran the tests and they pass.' }] },
    ]);
    const r = runGuard(stopStdin(tp, { stopActive: true }));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '', 'second Stop must not re-block');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('missing transcript_path is a no-op', () => {
  const r = runGuard({ hook_event_name: 'Stop', stop_hook_active: false });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '', 'no transcript → nothing to scan');
});

test('rejects symlinked transcript', () => {
  const dir = tmpDir();
  try {
    const real = writeTranscript(dir, [
      { type: 'assistant', content: [{ type: 'text', text: 'I ran the tests.' }] },
    ]);
    const link = path.join(dir, 'link.jsonl');
    try { fs.symlinkSync(real, link); } catch (_) { return; } // skip on platforms without symlinks
    const r = runGuard(stopStdin(link));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '', 'symlink transcript must not be followed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('non-Stop hook event is a no-op', () => {
  const r = runGuard({ hook_event_name: 'SessionStart', stop_hook_active: false });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '', 'only Stop is guarded');
});
