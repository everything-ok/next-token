'use strict';

const LEVELS = new Set(['lite', 'full', 'ultra', 'wenyan', 'wenyan-lite', 'wenyan-ultra']);
const LEGACY_COMMANDS = Object.freeze({
  '/hui-global': ['on', 'full'],
  '/hui-lite': ['mode', 'lite'],
  '/hui-ultra': ['mode', 'ultra'],
  '/hui-wenyan': ['mode', 'wenyan'],
  '/hui-wenyan-full': ['mode', 'wenyan'],
  '/hui-wenyan-lite': ['mode', 'wenyan-lite'],
  '/hui-wenyan-ultra': ['mode', 'wenyan-ultra'],
  '/hui-commit': ['commit'],
  '/hui-review': ['review'],
  '/hui-compress': ['compress'],
  '/hui-stats': ['stats'],
  '/hui-session': ['session'],
  '/hui-init': ['init'],
  '/hui-help': ['help'],
});

function stripMarketplaceNamespace(command) {
  if (command === '/hui:hui') return '/hui';
  return command.replace(/^\/hui:hui-/, '/hui-');
}

function parseHuiCommand(raw) {
  const source = String(raw || '').trim().toLowerCase();
  if (!source) return null;
  if (source === 'stop-hui') return { action: 'off', args: [], legacy: false };

  const parts = source.split(/\s+/);
  let command = stripMarketplaceNamespace(parts[0]);
  let args = parts.slice(1);
  if (LEGACY_COMMANDS[command]) {
    return { action: LEGACY_COMMANDS[command][0], args: [...LEGACY_COMMANDS[command].slice(1), ...args], legacy: true };
  }
  if (command !== '/hui') return null;
  if (!args.length) return { action: 'on', args: ['full'], legacy: false };

  if (LEVELS.has(args[0]) || args[0] === 'wenyan-full') {
    return { action: 'mode', args: [args[0] === 'wenyan-full' ? 'wenyan' : args[0]], legacy: true };
  }
  const action = args[0];
  if (action === 'on') {
    if (args.length < 2) return { action, args: ['full'], legacy: false };
    return { action, args: [args[1]], legacy: false };
  }
  if (action === 'off' || action === 'stop' || action === 'disable' || action === 'stop-hui') return { action: 'off', args: [], legacy: action !== 'off' };
  if (['mode', 'status', 'demo', 'benchmark', 'session', 'stats', 'commit', 'review', 'compress', 'init', 'help'].includes(action)) {
    return { action, args: args.slice(1), legacy: false };
  }
  return null;
}

function modeForParsedCommand(command, defaultMode) {
  if (!command) return null;
  if (command.action === 'off') return 'off';
  if (command.action === 'on') return LEVELS.has(command.args[0]) ? command.args[0] : null;
  if (command.action === 'mode') return LEVELS.has(command.args[0]) ? command.args[0] : null;
  if (['commit', 'review', 'compress'].includes(command.action)) return command.action;
  return null;
}

module.exports = { LEVELS, parseHuiCommand, modeForParsedCommand };
