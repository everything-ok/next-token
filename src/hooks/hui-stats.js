#!/usr/bin/env node
// hui-stats — read observed token usage from local Claude Code session logs.
//
// Run directly:    node hooks/hui-stats.js
// Inside Claude:   /hui-stats triggers this via the UserPromptSubmit hook.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { appendFlag, readHistory } = require('./hui-config');

function findRecentSession(claudeDir) {
  const projectsDir = path.join(claudeDir, 'projects');
  let entries;
  try { entries = fs.readdirSync(projectsDir, { withFileTypes: true }); }
  catch { return null; }

  let best = null;
  const stack = entries.map(entry => path.join(projectsDir, entry.name));
  while (stack.length) {
    const current = stack.pop();
    let stat;
    try { stat = fs.statSync(current); } catch { continue; }
    if (stat.isDirectory()) {
      try {
        for (const child of fs.readdirSync(current)) stack.push(path.join(current, child));
      } catch {}
    } else if (current.endsWith('.jsonl') && (!best || stat.mtimeMs > best.mtime)) {
      best = { file: current, mtime: stat.mtimeMs };
    }
  }
  return best ? best.file : null;
}

function parseSession(filePath) {
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); }
  catch { return { outputTokens: 0, cacheReadTokens: 0, turns: 0 }; }

  let outputTokens = 0;
  let cacheReadTokens = 0;
  let turns = 0;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type !== 'assistant' || !entry.message || !entry.message.usage) continue;
    const usage = entry.message.usage;
    outputTokens += usage.output_tokens || 0;
    cacheReadTokens += usage.cache_read_input_tokens || 0;
    turns++;
  }
  return { outputTokens, cacheReadTokens, turns };
}

function parseDuration(spec) {
  if (!spec) return null;
  const match = /^(\d+)([dh])$/.exec(spec.trim());
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  return match[2] === 'd' ? amount * 86_400_000 : amount * 3_600_000;
}

function aggregateHistory(historyPath, sinceMs) {
  const cutoff = sinceMs ? Date.now() - sinceMs : null;
  const latestPerSession = new Map();
  for (const line of readHistory(historyPath)) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry || typeof entry !== 'object') continue;
    if (cutoff !== null && (entry.ts || 0) < cutoff) continue;
    const sessionId = entry.session_id || '_';
    const previous = latestPerSession.get(sessionId);
    if (!previous || (entry.ts || 0) >= (previous.ts || 0)) latestPerSession.set(sessionId, entry);
  }

  let outputTokens = 0;
  let cacheReadTokens = 0;
  let turns = 0;
  for (const entry of latestPerSession.values()) {
    outputTokens += entry.output_tokens || 0;
    cacheReadTokens += entry.cache_read_tokens || 0;
    turns += entry.turns || 0;
  }
  return { sessions: latestPerSession.size, outputTokens, cacheReadTokens, turns };
}

function formatHistory({ sessions, outputTokens, cacheReadTokens, turns, since }) {
  const separator = '──────────────────────────────────';
  const window = since ? `（最近 ${since}）` : '';
  if (sessions === 0) {
    return `\n本地会话用量 — 汇总${window}\n${separator}\n尚无记录。请在任意会话中运行 /hui-stats。\n${separator}\n`;
  }
  return `\n本地会话用量 — 汇总${window}\n${separator}\n` +
    `会话：              ${sessions.toLocaleString()}\n` +
    `回复轮次：          ${turns.toLocaleString()}\n${separator}\n` +
    `输出 token：        ${outputTokens.toLocaleString()}\n` +
    `缓存读取 token：    ${cacheReadTokens.toLocaleString()}\n${separator}\n`;
}

function formatStats({ outputTokens, cacheReadTokens, turns, sessionPath }) {
  const separator = '──────────────────────────────────';
  const shortPath = sessionPath && sessionPath.length > 45
    ? '...' + sessionPath.slice(-45)
    : (sessionPath || '');
  if (turns === 0) {
    return `\n本地会话用量\n${separator}\n尚无回复；首个回复后可查看用量。\n${separator}\n`;
  }
  return `\n本地会话用量\n${separator}\n` +
    (shortPath ? `会话：  ${shortPath}\n` : '') +
    `回复轮次：  ${turns}\n${separator}\n` +
    `输出 token：        ${outputTokens.toLocaleString()}\n` +
    `缓存读取 token：    ${cacheReadTokens.toLocaleString()}\n` +
    `${separator}\n仅显示 Claude Code 本地会话日志中的观察值；不推算节省、成本或基线。\n`;
}

function main() {
  const args = process.argv.slice(2);
  const sessionFileIndex = args.indexOf('--session-file');
  const sessionFileArg = sessionFileIndex !== -1 ? args[sessionFileIndex + 1] : null;
  const all = args.includes('--all');
  const sinceIndex = args.indexOf('--since');
  const sinceArg = sinceIndex !== -1 ? args[sinceIndex + 1] : null;
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const historyPath = path.join(claudeDir, '.hui-history.jsonl');

  if (all || sinceArg) {
    const sinceMs = parseDuration(sinceArg);
    if (sinceArg && sinceMs === null) {
      process.stderr.write(`hui-stats: --since takes Nh or Nd (e.g. 7d, 24h), got: ${sinceArg}\n`);
      process.exit(2);
    }
    process.stdout.write(formatHistory({ ...aggregateHistory(historyPath, sinceMs), since: sinceArg || null }));
    return;
  }

  const sessionFile = sessionFileArg || findRecentSession(claudeDir);
  if (!sessionFile) {
    process.stderr.write('hui-stats: no Claude Code session found.\n');
    process.exit(1);
  }

  const parsed = parseSession(sessionFile);
  if (parsed.turns > 0) {
    appendFlag(historyPath, JSON.stringify({
      ts: Date.now(),
      session_id: path.basename(sessionFile, '.jsonl'),
      output_tokens: parsed.outputTokens,
      cache_read_tokens: parsed.cacheReadTokens,
      turns: parsed.turns,
    }));
  }
  process.stdout.write(formatStats({ ...parsed, sessionPath: sessionFile }));
}

if (require.main === module) main();

module.exports = { findRecentSession, parseSession, parseDuration, aggregateHistory, formatHistory, formatStats };
