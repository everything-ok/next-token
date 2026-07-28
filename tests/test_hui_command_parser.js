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
assert.equal(modeForParsedCommand(parseHuiCommand('/hui on'), 'ultra'), 'full');
assert.equal(modeForParsedCommand(parseHuiCommand('/hui on invalid'), 'full'), null);
assert.equal(modeForParsedCommand(parseHuiCommand('/hui review'), 'full'), 'review');
assert.equal(modeForParsedCommand(parseHuiCommand('stop-hui'), 'full'), 'off');
assert.equal(parseHuiCommand('/hui unknown'), null);
assert.equal(parseHuiCommand('/hui-demo'), null);

// Parity guard: hui-mode-tracker.js carries an inlined copy of parseHuiCommand
// + modeForParsedCommand (so the standalone hook doesn't require a sibling
// file the installer doesn't ship). This asserts the copy stays byte-for-byte
// in sync with the canonical src/hui-command-parser.js module by loading both
// and running every case above through each. If someone edits one without the
// other, this fails.
const fs = require('fs');
const path = require('path');
const trackerSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'hooks', 'hui-mode-tracker.js'), 'utf8');
// The hook is a script, not a module — it doesn't export the inlined fns. So
// extract their bodies by evaluating the file in a sandbox that exposes them.
const sandbox = { require: (m) => m === './hui-config' ? require('../src/hooks/hui-config')
                          : m === './hui-command-contract' ? require('../src/hooks/hui-command-contract')
                          : require(m) };
const vm = require('vm');
const ctx = vm.createContext(Object.assign({}, sandbox, { module: { exports: {} }, process: { env: {}, on() {}, stdin: { on() {} } } }));
// Wrap so the inlined fn declarations land on the context's global scope.
vm.runInContext(trackerSrc.replace("'use strict';", '') + '\nthis.__p = { parseHuiCommand, modeForParsedCommand };', ctx);
const inlined = ctx.__p;
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
  ['/hui unknown'],
  ['/hui-demo'],
]) {
  assert.deepEqual(inlined.parseHuiCommand(input), parseHuiCommand(input), `inlined parseHuiCommand diverged for: ${input}`);
}
assert.equal(inlined.modeForParsedCommand(inlined.parseHuiCommand('/hui mode ultra'), 'full'), 'ultra');
assert.equal(inlined.modeForParsedCommand(inlined.parseHuiCommand('/hui on invalid'), 'full'), null);
assert.equal(inlined.modeForParsedCommand(inlined.parseHuiCommand('stop-hui'), 'full'), 'off');

console.log('hui command parser tests passed');
