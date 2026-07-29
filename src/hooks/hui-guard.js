#!/usr/bin/env node
// hui-guard — Stop hook. Deterministic guard against false test claims.
//
// If the last assistant message claims to have run/passed tests but no test
// command (npm test / jest / pytest / etc.) was executed this session, block
// the stop and force Claude to correct itself. Deterministic, not a
// suggestion: this is the layer prompt-level constraints cannot reach.
//
// Self-contained (no ../requires) — copies the safe transcript-read pattern
// from hui-session.js. Must ship standalone under ~/.claude/hooks/.
//
// Kill switch: HUI_GUARD=0. Loop guard: stop_hook_active===true → no-op.

'use strict';

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_LINES = 10000;

// Strong, explicit test-result claims only. Deliberately narrow to keep
// false positives near zero — vague verbs ("verified", "checked", "works")
// are NOT matched because they're ambiguous and would over-block normal work.
const CLAIM_PATTERNS = [
  /\b(?:i|we)\s+(?:ran|have\s+run|did\s+run|executed|run)\s+(?:the\s+)?tests?\b/i,
  /\btests?\s+(?:passed|passing|pass|succeeded|succeed)\b/i,
  /\ball\s+tests?\s+(?:are\s+)?passing\b/i,
  /\btest\s+suite\s+passed\b/i,
  /\b(?:tests?|test\s+suite)\s+(?:all\s+)?(?:pass|passed)\b/i,
];

// Real test-tool invocations. A Bash command matching one of these counts as
// "actually ran tests" — clears the claim.
const TEST_TOOL_PATTERNS = [
  /\bnpm\s+(?:test|run\s+test|run\s+--\s+test)\b/,
  /\bnpx\s+(?:jest|vitest|pytest|tsx)\b/,
  /\bjest\b/, /\bpytest\b/, /\bvitest\b/, /\bdeno\s+test\b/,
  /\bcargo\s+test\b/, /\bgo\s+test\b/, /\bmvn\s+test\b/,
  /\bgradle\s+test\b/, /\bgradlew\s+test\b/, /\bdotnet\s+test\b/,
  /\bruby\s+-Itest\b/, /\brspec\b/, /\bminitest\b/,
  /\bmake\s+test\b/, /\bmake\s+check\b/,
];

function messageText(message) {
  const content = message && message.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(part => part && part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join(' ');
}

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.on('data', chunk => { data += chunk; });
    // Abnormal stdin close emits 'error'; without a listener Node throws it as
    // uncaught and the hook exits non-zero — a spurious hook failure (#538).
    process.stdin.on('error', () => process.exit(0));
    process.stdin.on('end', () => resolve(data));
    // Hard cap so a stuck pipe can never wedge the hook.
    const timer = setTimeout(() => resolve(data), 5000);
    timer.unref();
  });
}

// Walk the transcript once, collecting (a) the last assistant message text and
// (b) whether any test-tool Bash invocation occurred anywhere. Single pass.
function scanTranscript(lines) {
  let lastAssistantText = '';
  let hasTestTool = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event;
    try { event = JSON.parse(trimmed); } catch (_silent) { continue; }
    if (!event || event.type !== 'assistant' || !event.message) continue;
    const content = event.message.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!part) continue;
        if (part.type === 'text' && typeof part.text === 'string') {
          lastAssistantText = part.text; // last assistant text block wins
        } else if (part.type === 'tool_use' && part.name === 'Bash') {
          const cmd = part.input && typeof part.input.command === 'string' ? part.input.command : '';
          if (TEST_TOOL_PATTERNS.some(re => re.test(cmd))) hasTestTool = true;
        }
      }
    } else if (typeof content === 'string') {
      lastAssistantText = content;
    }
  }
  return { lastAssistantText, hasTestTool };
}

async function main() {
  if (process.env.HUI_GUARD === '0') return;

  const raw = await readStdin();
  let data;
  try { data = JSON.parse(raw); } catch (_silent) { return; }
  if (!data || data.hook_event_name !== 'Stop') return;
  // Loop guard: a Stop hook that blocks forces Claude to continue, which
  // fires Stop again. The second time stop_hook_active is true — bail.
  if (data.stop_hook_active) return;

  const tp = data.transcript_path;
  if (!tp) return;
  let stat;
  try {
    stat = fs.lstatSync(tp);
  } catch (_silent) { return; }
  if (stat.isSymbolicLink() || !stat.isFile()) return;
  if (stat.size > MAX_BYTES) return;

  let raw2;
  try { raw2 = fs.readFileSync(tp, 'utf8'); } catch (_silent) { return; }
  const lines = raw2.split(/\r?\n/);
  if (lines.length > MAX_LINES) return;

  const { lastAssistantText, hasTestTool } = scanTranscript(lines);
  if (!lastAssistantText) return;

  const lower = lastAssistantText.toLowerCase();
  const hasClaim = CLAIM_PATTERNS.some(re => re.test(lower));
  if (!hasClaim) return;          // no test claim → nothing to guard
  if (hasTestTool) return;         // claim + actually ran tests → legit

  // Claim present, no test command found → block. Deterministic guard.
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: '⚠️ HUI Guard: claimed to run/pass tests, but no test command (npm test / jest / pytest / cargo test / etc.) was executed this session. Either run the tests first, or state explicitly that tests were not run. Do not claim results you did not produce.',
  }));
}

main().catch(() => { /* silent fail — guard is best-effort */ });
