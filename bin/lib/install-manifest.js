'use strict';

// Versioned install manifest for files owned by the HUI installer. The manifest
// is deliberately local to the Claude config directory so it never travels with
// a project. Entries are content-addressed: uninstall removes a managed file
// only while its current content still matches the installed digest.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const IS_WIN = process.platform === 'win32';
const MANIFEST_VERSION = 1;
const MANIFEST_FILENAME = 'hui-install-manifest.json';

// Error suppression helper for optional/best-effort operations.
const _silent = (_err) => {};

function manifestPath(configDir) {
  return path.join(configDir, MANIFEST_FILENAME);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function emptyManifest() {
  return { version: MANIFEST_VERSION, targets: {} };
}

function readManifest(configDir) {
  const file = manifestPath(configDir);
  if (!fs.existsSync(file)) return emptyManifest();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || parsed.version !== MANIFEST_VERSION || typeof parsed.targets !== 'object') return emptyManifest();
    return parsed;
  } catch (_silent) {
    return emptyManifest();
  }
}

function writeManifest(configDir, manifest) {
  fs.mkdirSync(configDir, { recursive: true });
  const file = manifestPath(configDir);
  const tmp = path.join(configDir, `.${MANIFEST_FILENAME}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  const content = JSON.stringify(manifest, null, 2) + '\n';
  if (IS_WIN) {
    fs.writeFileSync(tmp, content);
  } else {
    fs.writeFileSync(tmp, content, { mode: 0o600 });
  }
  fs.renameSync(tmp, file);
}

function recordTarget(configDir, target, files) {
  const manifest = readManifest(configDir);
  const entries = [];
  for (const filePath of files || []) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    try { entries.push({ path: path.resolve(filePath), sha256: sha256File(filePath) }); } catch (_silent) {}
  }
  manifest.targets[target] = { updatedAt: new Date().toISOString(), files: entries };
  writeManifest(configDir, manifest);
  return entries;
}

// Returns removed/preserved paths. Missing files are ignored. A file absent from
// the manifest is intentionally preserved: ownership cannot be established.
function removeTargetFiles(configDir, target, removeFile = fs.unlinkSync) {
  const manifest = readManifest(configDir);
  const targetState = manifest.targets[target];
  const result = { removed: [], preserved: [] };
  if (!targetState || !Array.isArray(targetState.files)) return result;
  for (const entry of targetState.files) {
    if (!entry || typeof entry.path !== 'string' || !fs.existsSync(entry.path)) continue;
    try {
      if (sha256File(entry.path) !== entry.sha256) {
        result.preserved.push(entry.path);
        continue;
      }
      removeFile(entry.path);
      result.removed.push(entry.path);
    } catch (_silent) {
      result.preserved.push(entry.path);
    }
  }
  delete manifest.targets[target];
  if (Object.keys(manifest.targets).length === 0) {
    try { fs.unlinkSync(manifestPath(configDir)); } catch (_silent) {}
  } else {
    writeManifest(configDir, manifest);
  }
  return result;
}

module.exports = {
  MANIFEST_FILENAME,
  MANIFEST_VERSION,
  manifestPath,
  readManifest,
  writeManifest,
  recordTarget,
  removeTargetFiles,
};
