import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const manifest = require('../../bin/lib/install-manifest.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hui-manifest-'));
}

test('manifest atomically records managed file lifecycle', () => {
  const dir = tempDir();
  const file = path.join(dir, 'hui-activate.js');
  fs.writeFileSync(file, 'original');
  try {
    manifest.recordTarget(dir, 'claude', [file]);
    const recorded = manifest.readManifest(dir);
    assert.equal(recorded.version, manifest.MANIFEST_VERSION);
    assert.equal(recorded.targets.claude.files[0].path, path.resolve(file));

    const result = manifest.removeTargetFiles(dir, 'claude');
    assert.deepEqual(result.preserved, []);
    assert.deepEqual(result.removed, [path.resolve(file)]);
    assert.equal(fs.existsSync(file), false);
    assert.equal(fs.existsSync(manifest.manifestPath(dir)), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('manifest uninstall preserves user-modified managed files', () => {
  const dir = tempDir();
  const file = path.join(dir, 'hui-statusline.sh');
  fs.writeFileSync(file, 'installer version');
  try {
    manifest.recordTarget(dir, 'claude', [file]);
    fs.writeFileSync(file, 'user modification');
    const result = manifest.removeTargetFiles(dir, 'claude');
    assert.deepEqual(result.removed, []);
    assert.deepEqual(result.preserved, [path.resolve(file)]);
    assert.equal(fs.readFileSync(file, 'utf8'), 'user modification');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
