import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const WORKSPACE = path.resolve(ROOT, '..');
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const REPOSITORY = 'HUI/next-token';
const SKILLS = ['hui', 'hui-commit', 'hui-compress', 'hui-constraints', 'hui-help', 'hui-review', 'hui-stats', 'huicrew'];

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function run(args) {
  return childProcess.spawnSync(process.execPath, ['bin/install.js', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('HUI product and next-token distribution contract', () => {
  assert.equal(PACKAGE.name, 'next-token');
  assert.equal(PACKAGE.bin['next-token'], 'bin/install.js');
  assert.equal(PACKAGE.bin.hui, 'bin/install.js');
  assert.match(PACKAGE.description, /HUI/i);
  assert.match(PACKAGE.description, /next-token/i);
  assert.equal(PACKAGE.homepage, `https://github.com/${REPOSITORY}`);
  assert.match(PACKAGE.repository.url, new RegExp(`${REPOSITORY.replace('/', '\\/')}`));
  assert.equal(PACKAGE.bugs.url, `https://github.com/${REPOSITORY}/issues`);
  assert.equal(PACKAGE.publishConfig.access, 'public');
  assert.equal(read('bin/lib/brand.js').match(/const REPOSITORY = '([^']+)'/)[1], REPOSITORY);
  const installer = read('bin/install.js');
  assert.match(installer, /const PACKAGE_VERSION = require\('\.\.\/package\.json'\)\.version;/);
  assert.match(installer, /const PINNED_REF = process\.env\.HUI_REF \|\| `v\$\{PACKAGE_VERSION\}`;/);
});

test('installer help identifies HUI and next-token without npm hui claim', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /HUI installer/);
  assert.match(result.stdout, /npm distribution: next-token/);
  assert.match(result.stdout, /npx -y next-token/);
  assert.doesNotMatch(result.stdout, /npx -y hui(?:\s|$)/);
});

test('installer list remains functional under HUI identity', () => {
  const result = run(['--list']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Claude Code/);
  assert.match(result.stdout, /opencode/);
});

test('bootstrap shims use next-token and local unified installer', () => {
  const shell = read('install.sh');
  const powershell = read('install.ps1');
  for (const text of [shell, powershell]) {
    assert.match(text, /next-token/);
    assert.match(text, /bin[\\/]install\.js/);
    assert.doesNotMatch(text, /npx\s+-y\s+hui(?:\s|$)/);
  }
});

test('documentation states product and distribution distinction', () => {
  const readme = read('README.md');
  const install = read('INSTALL.md');
  const help = read('skills/hui-help/SKILL.md');
  for (const text of [readme, install, help]) {
    assert.match(text, /HUI/);
    assert.match(text, /next-token/);
  }
  assert.match(readme, /npx -y next-token/);
  assert.doesNotMatch(readme, /npx -y hui(?:\s|$)/);
});

test('plugin manifests expose HUI and existing assets', () => {
  const claude = JSON.parse(read('.claude-plugin/plugin.json'));
  const marketplace = JSON.parse(read('.claude-plugin/marketplace.json'));
  const codex = JSON.parse(read('plugins/hui/.codex-plugin/plugin.json'));
  const gemini = JSON.parse(read('gemini-extension.json'));
  assert.equal(claude.name, 'hui');
  assert.equal(marketplace.name, 'hui');
  assert.equal(marketplace.plugins[0].name, 'hui');
  assert.equal(codex.name, 'hui');
  assert.equal(gemini.name, 'hui');
  assert.match(codex.homepage, new RegExp(REPOSITORY.replace('/', '\\/')));
  for (const hook of ['src/hooks/hui-activate.js', 'src/hooks/hui-mode-tracker.js']) {
    assert.ok(fs.existsSync(path.join(ROOT, hook)), `missing ${hook}`);
  }
  for (const asset of ['assets/hui.svg', 'assets/hui-small.svg']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'plugins/hui', asset)), `missing ${asset}`);
  }
});

test('all HUI skill mirrors and locks match canonical content', () => {
  const locks = [
    JSON.parse(read('skills-lock.json')),
    JSON.parse(fs.readFileSync(path.join(WORKSPACE, 'skills-lock.json'), 'utf8')),
  ];
  for (const lock of locks) {
    assert.deepEqual(Object.keys(lock.skills).sort(), SKILLS);
    for (const skill of SKILLS) {
      const entry = lock.skills[skill];
      const canonical = fs.readFileSync(path.join(ROOT, 'skills', skill, 'SKILL.md'));
      assert.equal(entry.source, REPOSITORY);
      assert.equal(entry.skillPath, `skills/${skill}/SKILL.md`);
      assert.equal(entry.computedHash, crypto.createHash('sha256').update(canonical).digest('hex'));
    }
  }
  for (const skill of SKILLS) {
    const canonical = fs.readFileSync(path.join(ROOT, 'skills', skill, 'SKILL.md'));
    for (const mirror of [
      path.join(ROOT, '.agents', 'skills', skill, 'SKILL.md'),
      path.join(WORKSPACE, '.agents', 'skills', skill, 'SKILL.md'),
    ]) {
      assert.deepEqual(fs.readFileSync(mirror), canonical, `${mirror} differs`);
    }
  }
});

test('retired standalone installers are absent', () => {
  for (const name of ['hui-install.js', 'hui-install.sh', 'hui-install.ps1']) {
    assert.ok(!fs.existsSync(path.join(ROOT, name)), `${name} must stay retired`);
  }
});
