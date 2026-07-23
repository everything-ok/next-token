#!/usr/bin/env node
// hui — UserPromptSubmit hook to track which hui mode is active
// Inspects user input for /hui commands and writes mode to flag file

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { getDefaultMode, safeWriteFlag, readFlag, recordModeChange, VALID_MODES } = require('./hui-config');
const { modeForCommand, normalizeMode } = require('./hui-command-contract');
const { parseHuiCommand, modeForParsedCommand } = require('../hui-command-parser');

// Modes handled by their own slash commands (/hui-commit, etc.) — not
// selectable via /hui <arg>.
const INDEPENDENT_MODES = new Set(['commit', 'review', 'compress']);

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.hui-active');
// Remembers the prose mode active before a one-shot independent mode
// (/hui-commit etc.) so the next ordinary prompt can restore it (#599).
const prevPath = path.join(claudeDir, '.hui-active.prev');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
// Abnormal stdin close (broken pipe, parent crash) emits 'error'; without a
// listener Node throws it as an uncaught exception and the hook exits
// non-zero — a spurious hook failure (#538). Hooks must always exit 0.
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    // Collapse whitespace so phrase triggers still match multiline prompts —
    // every regex below sees a single-line prompt (#598).
    const prompt = (data.prompt || '').trim().toLowerCase().replace(/\s+/g, ' ');
    // Command engines expand `/hui <action>` into this fixed template before
    // hooks run. Restore canonical syntax so all dispatch paths see one form.
    const templateMatch = /^activate hui mode:\s*(.*)$/i.exec(prompt);
    const commandPrompt = templateMatch ? `/hui ${templateMatch[1].trim()}`.trim() : prompt;

    // Deactivation intent — computed FIRST so "turn hui mode off" never
    // falls through to the activation patterns (#598: the old contiguous
    // "turn off" phrasing missed the "turn X off" word order entirely, and
    // the activation regex then re-armed hui at the default level).
    const wantsOff =
      prompt === 'stop-hui' ||
      /\b(stop|disable|deactivate|quit|exit|kill)\s+(the\s+)?hui\b/.test(prompt) ||
      /\bhui(\s+mode)?\s+(off|stop|disabled?)\b/.test(prompt) ||
      /\bturn\s+off\s+(the\s+)?hui\b/.test(prompt) ||
      // "normal mode" only as a command (prompt-initial, optionally led by a
      // switch-back verb) or with hui context — never mid-sentence for
      // e.g. vim's normal mode ("how do I exit vim normal mode").
      /^(please\s+)?(go\s+|back\s+to\s+|switch\s+(back\s+)?to\s+|return\s+to\s+)?normal\s+mode\b/.test(prompt) ||
      (/\bnormal\s+mode\b/.test(prompt) && /\bhui\b/.test(prompt));

    // Questions about hui are not activation commands
    // ("what is hui mode?", "does hui lite drop articles?").
    const isQuestion =
      /^(what|whats|what's|how|why|when|where|who|does|do|did|is|are|can|could|would|should|tell me|explain)\b/.test(prompt);

    // Natural-language activation is deliberately limited to explicit HUI intent.
    // Requests such as "be brief" affect the current answer only; they must not
    // silently change the mode for later prompts.
    if (!wantsOff && !isQuestion) {
      if (/\b(activate|enable|start|turn on|use|switch to|want|give me)\b[^.]{0,40}\bhui\b/.test(prompt) ||
          /\btalk like\b[^.]{0,40}\bhui\b/.test(prompt) ||
          /\bhui\s+mode\s+(on|please|now)\b/.test(prompt) ||
          /^hui(\s+mode)?\s*[.!]*$/.test(prompt)) {
        const mode = getDefaultMode();
        if (mode !== 'off') {
          recordModeChange(claudeDir, mode); // #601: timestamped transition log
          safeWriteFlag(flagPath, mode);
        }
      }
    }

    // /hui demo renders a fixed local example. It must not activate a mode or
    // read/write session state, so handle it before all normal mode processing.
    if (/^\/hui(?::hui)?\s+demo$/.test(commandPrompt)) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: '本地文本示例\n\n普通写法：React 组件重复渲染，通常因为每次 render 都创建新的对象引用。内联对象作为 prop 会改变引用，触发重新渲染。可用 useMemo 稳定引用。\n\n简洁写法：每次 render 新对象引用。内联对象 prop = 新引用 = 重渲染。用 useMemo。\n\n这是固定本地文本示例：不调用模型，不读取或写入会话、模式或统计状态。'
      }));
      return;
    }

    // /hui-session summarizes or compacts only the transcript path supplied by
    // Claude Code. `--compact` writes a validated sibling copy; source stays intact.
    if (/^\/hui(?::hui)?(?:-session(?:\s+--compact)?|\s+session(?:\s+--compact)?)$/.test(commandPrompt)) {
      if (!data.transcript_path) {
        process.stdout.write(JSON.stringify({ decision: 'block', reason: 'hui-session: current Claude Code transcript path is unavailable. No file was read.' }));
        return;
      }
      try {
        const compact = /(?:\s+session\s+--compact|-session\s+--compact)$/.test(prompt);
        const argv = [path.join(__dirname, 'hui-session.js'), '--session-file', data.transcript_path];
        if (compact) argv.push('--compact');
        const out = execFileSync(process.execPath, argv, { encoding: 'utf8', timeout: 5000 });
        process.stdout.write(JSON.stringify({ decision: 'block', reason: out.trim() }));
      } catch (e) {
        process.stdout.write(JSON.stringify({ decision: 'block', reason: 'hui-session: local operation unavailable. Original transcript and HUI state were not modified.' }));
      }
      return;
    }

    // /hui-stats — block the prompt and inject locally observed session usage.
    // The script reads the active session log when Claude Code supplies it.
    const statsMatch = /^\/hui(?::hui)?(?:-stats|\s+stats)(?:\s+(.*))?$/.exec(commandPrompt);
    if (statsMatch) {
      const tailArgs = (statsMatch[1] || '').trim().split(/\s+/).filter(Boolean);
      try {
        const statsPath = path.join(__dirname, 'hui-stats.js');
        const argv = [statsPath];
        if (data.transcript_path) argv.push('--session-file', data.transcript_path);
        if (tailArgs.includes('--all')) argv.push('--all');
        const sinceIdx = tailArgs.indexOf('--since');
        if (sinceIdx !== -1 && tailArgs[sinceIdx + 1]) {
          argv.push('--since', tailArgs[sinceIdx + 1]);
        }
        const out = execFileSync(process.execPath, argv, { encoding: 'utf8', timeout: 5000 });
        process.stdout.write(JSON.stringify({ decision: 'block', reason: out.trim() }));
      } catch (e) {
        process.stdout.write(JSON.stringify({
          decision: 'block',
          reason: 'hui-stats: could not run stats script.\nTry manually: node hooks/hui-stats.js'
        }));
      }
      return;
    }

    // Canonical `/hui <action>` grammar plus retained legacy aliases. Independent
    // one-shot modes remember the prose mode active before them and restore it on
    // the next ordinary prompt.
    let setIndependentThisTurn = false;
    const parsed = parseHuiCommand(commandPrompt);
    const mode = modeForParsedCommand(parsed, getDefaultMode());

    if (mode && mode !== 'off') {
      if (INDEPENDENT_MODES.has(mode)) {
        const current = readFlag(flagPath);
        if (current && !INDEPENDENT_MODES.has(current)) {
          safeWriteFlag(prevPath, current);
        }
        setIndependentThisTurn = true;
      }
      recordModeChange(claudeDir, mode);
      safeWriteFlag(flagPath, mode);
    } else if (mode === 'off') {
      recordModeChange(claudeDir, null);
      try { fs.unlinkSync(flagPath); } catch (e) {}
      try { fs.unlinkSync(prevPath); } catch (e) {}
    }

    // Apply deactivation detected above
    if (wantsOff) {
      recordModeChange(claudeDir, null); // #601
      try { fs.unlinkSync(flagPath); } catch (e) {}
      try { fs.unlinkSync(prevPath); } catch (e) {}
    }

    // Per-turn reinforcement: emit a structured reminder when hui is active.
    // The SessionStart hook injects the full ruleset once, but models lose it
    // when other plugins inject competing style instructions every turn.
    // This keeps hui visible in the model's attention on every user message.
    //
    // Skip independent modes (commit, review, compress) — they have their own
    // skill behavior and the base hui rules would conflict.
    // readFlag enforces symlink-safe read + size cap + VALID_MODES whitelist.
    // If the flag is missing, corrupted, oversized, or a symlink pointing at
    // something like ~/.ssh/id_rsa, readFlag returns null and we emit nothing
    // — never inject untrusted bytes into model context.
    let activeMode = readFlag(flagPath);

    // One-shot restore (#599): an independent mode set on a PREVIOUS prompt
    // has served its turn — bring back the prose mode that was active before
    // it, or deactivate if hui wasn't active then.
    if (activeMode && INDEPENDENT_MODES.has(activeMode) && !setIndependentThisTurn) {
      const prev = readFlag(prevPath);
      try { fs.unlinkSync(prevPath); } catch (e) {}
      if (prev && !INDEPENDENT_MODES.has(prev)) {
        recordModeChange(claudeDir, prev); // #601
        safeWriteFlag(flagPath, prev);
        activeMode = prev;
      } else {
        recordModeChange(claudeDir, null); // #601
        try { fs.unlinkSync(flagPath); } catch (e) {}
        activeMode = null;
      }
    }

    if (activeMode && !INDEPENDENT_MODES.has(activeMode)) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: "HUI MODE ACTIVE (" + activeMode + "). " +
            "Drop articles/filler/pleasantries/hedging. Fragments OK. " +
            "Code/commits/security: write normal."
        }
      }));
    }
  } catch (e) {
    // Silent fail
  }
});
