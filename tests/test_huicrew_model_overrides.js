#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const {
  ALLOWED_MODELS,
  AGENT_ENV_MAP,
  resolvePluginRoot,
  resolveOverrides,
  applyOverrides,
} = require('../src/hooks/huicrew-model-overrides');

assert.deepStrictEqual([...ALLOWED_MODELS].sort(), ['haiku', 'opus', 'sonnet']);
assert.deepStrictEqual(AGENT_ENV_MAP.map(entry => entry.agent), ['reviewer', 'builder', 'investigator']);

const fixtureRoot = path.join(process.cwd(), 'tmp', 'plugin');
assert.strictEqual(
  resolvePluginRoot(path.join(fixtureRoot, 'src', 'hooks')),
  fixtureRoot
);

assert.deepStrictEqual(
  resolveOverrides({
    HUICREW_REVIEWER_MODEL: 'sonnet',
    HUICREW_BUILDER_MODEL: ' OPUS ',
    HUICREW_INVESTIGATOR_MODEL: 'haiku',
  }),
  { overrides: { reviewer: 'sonnet', builder: 'opus', investigator: 'haiku' }, invalid: [] }
);

assert.deepStrictEqual(
  resolveOverrides({ HUICREW_REVIEWER_MODEL: 'unknown-model', HUICREW_BUILDER_MODEL: 'sonnet\nmalicious' }),
  { overrides: {}, invalid: ['HUICREW_REVIEWER_MODEL', 'HUICREW_BUILDER_MODEL'] }
);

assert.deepStrictEqual(resolveOverrides({ HUICREW_REVIEWER_MODEL: '  ' }), { overrides: {}, invalid: [] });
assert.deepStrictEqual(
  applyOverrides('/not-used', { HUICREW_REVIEWER_MODEL: 'sonnet' }),
  { overrides: { reviewer: 'sonnet' }, invalid: [] }
);

console.log('huicrew model override resolver tests passed');
