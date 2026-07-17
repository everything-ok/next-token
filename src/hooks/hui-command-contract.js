'use strict';

const CANONICAL_MODES = Object.freeze({
  '/hui-global': 'full',
  '/hui-lite': 'lite',
  '/hui-ultra': 'ultra',
  '/hui-wenyan': 'wenyan',
  '/hui-wenyan-lite': 'wenyan-lite',
  '/hui-wenyan-full': 'wenyan',
  '/hui-wenyan-ultra': 'wenyan-ultra',
});

function normalizeMode(value) {
  return value === 'wenyan-full' ? 'wenyan' : value;
}

function modeForCommand(command) {
  const plain = command.replace(/^\/hui:hui/, '/hui');
  return CANONICAL_MODES[plain] || null;
}

module.exports = { CANONICAL_MODES, normalizeMode, modeForCommand };
