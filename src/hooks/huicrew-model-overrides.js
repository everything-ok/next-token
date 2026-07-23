#!/usr/bin/env node
// huicrew model overrides — resolve optional session preferences without
// mutating installed agent definitions. Hosts that cannot apply a session-local
// model preference must treat the result as unsupported.

'use strict';

const path = require('path');

const ALLOWED_MODELS = new Set(['haiku', 'sonnet', 'opus']);
const AGENT_ENV_MAP = Object.freeze([
  { agent: 'reviewer', envVar: 'HUICREW_REVIEWER_MODEL', file: path.join('agents', 'huicrew-reviewer.md') },
  { agent: 'builder', envVar: 'HUICREW_BUILDER_MODEL', file: path.join('agents', 'huicrew-builder.md') },
  { agent: 'investigator', envVar: 'HUICREW_INVESTIGATOR_MODEL', file: path.join('agents', 'huicrew-investigator.md') },
]);

function resolvePluginRoot(hookDir) {
  return path.resolve(hookDir, '..', '..');
}

function resolveOverrides(env = process.env) {
  const overrides = {};
  const invalid = [];
  for (const { agent, envVar } of AGENT_ENV_MAP) {
    const raw = env[envVar];
    if (!raw || !raw.trim()) continue;
    const model = raw.trim().toLowerCase();
    if (!ALLOWED_MODELS.has(model)) {
      invalid.push(envVar);
      continue;
    }
    overrides[agent] = model;
  }
  return { overrides, invalid };
}

// Compatibility export. It intentionally performs no filesystem action.
function applyOverrides(_pluginRoot, env = process.env) {
  return resolveOverrides(env);
}

module.exports = { ALLOWED_MODELS, AGENT_ENV_MAP, resolvePluginRoot, resolveOverrides, applyOverrides };
