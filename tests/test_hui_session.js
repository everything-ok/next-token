'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { summarizeTranscript, renderSession, writeCompactCopy, validateTranscriptText } = require('../src/hooks/hui-session');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hui-session-test-'));
const file = path.join(dir, 'session.jsonl');
const source = [
  '  ' + JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: 'Fix    parser    error' } }) + '   ',
  '  ' + JSON.stringify({ timestamp: '2026-01-01T00:01:00Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Use   strict   parser.' }, { type: 'tool_use', name: 'Read' }], usage: { output_tokens: 42, cache_read_input_tokens: 10 } } }) + '   ',
].join('\n');
try {
  fs.writeFileSync(file, source, 'utf8');
  const before = fs.readFileSync(file, 'utf8');
  const summary = summarizeTranscript(file);
  assert.equal(summary.user, 1);
  assert.equal(summary.assistant, 1);
  assert.equal(summary.outputTokens, 42);
  assert.equal(summary.cacheReadTokens, 10);
  assert.equal(summary.toolCalls.Read, 1);
  assert.equal(summary.malformed, 0);
  const output = renderSession(file);
  assert.match(output, /本地只读/);
  assert.match(output, /Fix parser error/);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'summary must not modify transcript');

  const result = writeCompactCopy(file);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'compaction must not modify source transcript');
  assert.ok(fs.existsSync(result.destination), 'compaction must create sibling copy');
  assert.ok(result.afterBytes < result.beforeBytes, 'copy must be smaller');
  assert.ok(validateTranscriptText(fs.readFileSync(result.destination, 'utf8')) > 0, 'copy must be valid JSONL');
  assert.throws(() => writeCompactCopy(file, file), /refusing to overwrite source/);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('hui-session tests passed');
