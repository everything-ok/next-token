#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BANNED = /2454760302hui|safe\.diving@example\.com|safe diving|co-authored-by:\s*claude\s*<noreply@anthropic\.com>|github-actions\[bot\]/i;
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'buffer' })
  .toString('utf8').split('\0').filter(Boolean);

const allowedBinary = new Set(['dist/hui.skill', 'tests/test_ownership_identity.js']);
const violations = [];
for (const relative of tracked) {
  if (allowedBinary.has(relative)) continue;
  const fullPath = path.join(ROOT, relative);
  const content = fs.readFileSync(fullPath);
  if (content.includes(0)) continue;
  if (BANNED.test(content.toString('utf8'))) violations.push(relative);
}

assert.deepStrictEqual(violations, [], `ownership policy violations: ${violations.join(', ')}`);
console.log('ownership identity policy tests passed');
