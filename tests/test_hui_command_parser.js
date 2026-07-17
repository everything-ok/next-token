'use strict';
const assert = require('assert');
const { parseHuiCommand, modeForParsedCommand } = require('../src/hui-command-parser');

for (const [input, action, args] of [
  ['/hui', 'on', ['full']],
  ['/hui on ultra', 'on', ['ultra']],
  ['/hui mode wenyan-lite', 'mode', ['wenyan-lite']],
  ['/hui off', 'off', []],
  ['/hui stop-hui', 'off', []],
  ['stop-hui', 'off', []],
  ['/hui session --compact', 'session', ['--compact']],
  ['/hui demo', 'demo', []],
  ['/hui review', 'review', []],
  ['/hui:hui-review', 'review', []],
  ['/hui-review', 'review', []],
]) {
  const parsed = parseHuiCommand(input);
  assert.ok(parsed, input);
  assert.equal(parsed.action, action, input);
  assert.deepEqual(parsed.args, args, input);
}

assert.equal(modeForParsedCommand(parseHuiCommand('/hui mode ultra'), 'full'), 'ultra');
assert.equal(modeForParsedCommand(parseHuiCommand('/hui review'), 'full'), 'review');
assert.equal(modeForParsedCommand(parseHuiCommand('stop-hui'), 'full'), 'off');
assert.equal(parseHuiCommand('/hui unknown'), null);
assert.equal(parseHuiCommand('/hui-demo'), null);
console.log('hui command parser tests passed');
