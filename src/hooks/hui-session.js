#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_LINES = 10000;
const PREVIEW = 240;

function safePreview(value) {
  const text = String(value || '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const chars = Array.from(text);
  return chars.length > PREVIEW ? chars.slice(0, PREVIEW).join('') + '…' : text;
}

function messageText(message) {
  const content = message && message.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(part => part && part.type === 'text' && typeof part.text === 'string').map(part => part.text).join(' ');
}

function readTranscript(file) {
  const resolved = path.resolve(file);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('session file must be a regular file');
  if (stat.size > MAX_BYTES) throw new Error(`session file exceeds ${MAX_BYTES} byte local safety limit`);
  const raw = fs.readFileSync(resolved, 'utf8');
  const lines = raw.split(/\r?\n/);
  if (lines.length > MAX_LINES) throw new Error(`session file exceeds ${MAX_LINES} line local safety limit`);
  return { resolved, raw, lines };
}

function summarizeTranscript(file) {
  const { lines } = readTranscript(file);
  const summary = { user: 0, assistant: 0, toolCalls: {}, outputTokens: 0, cacheReadTokens: 0, malformed: 0, first: null, last: null, lastUser: null, lastAssistant: null };
  for (const line of lines) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch (_) { summary.malformed++; continue; }
    const timestamp = event.timestamp || event.time;
    if (timestamp) { summary.first ||= timestamp; summary.last = timestamp; }
    const message = event.message || (event.type === 'message' ? event : null);
    if (!message || typeof message !== 'object') continue;
    const role = message.role;
    if (role === 'user') { summary.user++; summary.lastUser = safePreview(messageText(message)); }
    if (role === 'assistant') {
      summary.assistant++;
      summary.lastAssistant = safePreview(messageText(message));
      const usage = message.usage || {};
      summary.outputTokens += Number(usage.output_tokens) || 0;
      summary.cacheReadTokens += Number(usage.cache_read_input_tokens) || 0;
    }
    for (const part of Array.isArray(message.content) ? message.content : []) {
      if (part && (part.type === 'tool_use' || part.type === 'tool_call')) {
        const name = safePreview(part.name) || 'unknown';
        summary.toolCalls[name] = (summary.toolCalls[name] || 0) + 1;
      }
    }
  }
  return summary;
}

// Preserve every JSON value and event ordering. Only removes insignificant JSON
// whitespace, so host semantics remain unchanged without pretending an unknown
// Claude Code transcript schema can be safely rewritten.
function compactTranscriptText(raw) {
  const output = [];
  let malformed = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { output.push(JSON.stringify(JSON.parse(line))); } catch (_) { malformed++; output.push(line); }
  }
  return { text: output.join('\n') + (output.length ? '\n' : ''), malformed };
}

function validateTranscriptText(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length > MAX_LINES) throw new Error(`compact transcript exceeds ${MAX_LINES} line local safety limit`);
  for (const line of lines) JSON.parse(line);
  return lines.length;
}

function outputPathFor(file) {
  const parsed = path.parse(path.resolve(file));
  return path.join(parsed.dir, `${parsed.name}.hui-compact${parsed.ext || '.jsonl'}`);
}

function writeCompactCopy(file, destination = outputPathFor(file)) {
  const { raw } = readTranscript(file);
  const compact = compactTranscriptText(raw);
  if (compact.malformed) throw new Error('session transcript contains malformed JSONL; source was not changed');
  const lineCount = validateTranscriptText(compact.text);
  const beforeBytes = Buffer.byteLength(raw, 'utf8');
  const afterBytes = Buffer.byteLength(compact.text, 'utf8');
  if (afterBytes >= beforeBytes) throw new Error('compact transcript is not smaller; source was not changed');

  const target = path.resolve(destination);
  if (target === path.resolve(file)) throw new Error('refusing to overwrite source transcript');
  try {
    const targetStat = fs.lstatSync(target);
    if (targetStat.isSymbolicLink()) throw new Error('compact output path must not be a symbolic link');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const temp = `${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temp, compact.text, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    validateTranscriptText(fs.readFileSync(temp, 'utf8'));
    fs.renameSync(temp, target);
  } finally {
    try { fs.unlinkSync(temp); } catch (_) {}
  }
  return { source: path.resolve(file), destination: target, beforeBytes, afterBytes, lineCount, reduction: ((1 - afterBytes / beforeBytes) * 100).toFixed(1) };
}

function renderSession(file) {
  const s = summarizeTranscript(file);
  const tools = Object.entries(s.toolCalls).map(([name, count]) => `${name}×${count}`).join(', ') || '无';
  return [
    'HUI 会话摘要（本地只读）',
    '模型/API：未调用｜缓存：未使用｜状态/统计：未写入｜原始 JSONL：未修改',
    `会话文件：${path.basename(file)}`,
    `消息：用户 ${s.user}｜助手 ${s.assistant}｜总计 ${s.user + s.assistant}`,
    `输出 tokens：${s.outputTokens}｜cache read：${s.cacheReadTokens}`,
    `工具调用：${tools}`,
    `时间范围：${s.first || '未知'} ～ ${s.last || '未知'}`,
    `损坏/跳过行：${s.malformed}`,
    `最近用户：${s.lastUser || '无可安全显示文本'}`,
    `最近助手：${s.lastAssistant || '无可安全显示文本'}`,
  ].join('\n');
}

function renderCompaction(result) {
  return [
    'HUI 历史会话压缩副本（本地）',
    '模型/API：未调用｜缓存：未使用｜原始 JSONL：未修改｜HUI 状态/统计：未写入',
    `原文件：${result.source}`,
    `压缩副本：${result.destination}`,
    `大小：${result.beforeBytes} → ${result.afterBytes} UTF-8 字节（减少 ${result.reduction}%）`,
    `JSONL 验证：通过｜行数：${result.lineCount}`,
  ].join('\n');
}

if (require.main === module) {
  const index = process.argv.indexOf('--session-file');
  if (index === -1 || !process.argv[index + 1]) throw new Error('usage: hui-session.js --session-file <path> [--compact]');
  const file = process.argv[index + 1];
  if (process.argv.includes('--compact')) process.stdout.write(renderCompaction(writeCompactCopy(file)) + '\n');
  else process.stdout.write(renderSession(file) + '\n');
}
module.exports = { safePreview, messageText, readTranscript, summarizeTranscript, compactTranscriptText, validateTranscriptText, outputPathFor, writeCompactCopy, renderSession, renderCompaction, MAX_BYTES, MAX_LINES };
