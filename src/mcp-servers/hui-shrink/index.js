#!/usr/bin/env node
// hui-shrink — MCP middleware that proxies an upstream MCP server and
// compresses prose fields so the model sees fewer tokens.
//
// Usage:
//   hui-shrink <upstream-command> [...args]
//
// Example wrapping the filesystem MCP server:
//   "mcpServers": {
//     "fs-shrunk": {
//       "command": "npx",
//       "args": ["hui-shrink", "npx", "@modelcontextprotocol/server-filesystem", "/some/path"]
//     }
//   }
//
// Compression is applied to:
//   - "description" fields in tools/list, prompts/list, resources/list responses
//   - same boundaries as hui-compress: code, URLs, paths, identifiers preserved
//
// What we deliberately DON'T touch in v1:
//   - tools/call response content (high risk of breaking downstream parsing)
//   - request payloads going TO the upstream server
//
// Configuration (env vars):
//   HUI_SHRINK_FIELDS   comma-separated extra field names to compress
//                           (default: description)
//   HUI_SHRINK_DEBUG=1  log compression deltas to stderr

const { spawn } = require('child_process');
const { compressDescriptionsInPlace, compress } = require('./compress');

const args = process.argv.slice(2);
if (args.length === 0) {
  process.stderr.write('hui-shrink: missing upstream command.\n');
  process.stderr.write('Usage: hui-shrink <upstream-command> [...args]\n');
  process.exit(2);
}

const debug = process.env.HUI_SHRINK_DEBUG === '1';
const fields = (process.env.HUI_SHRINK_FIELDS || 'description')
  .split(',').map(s => s.trim()).filter(Boolean);

const { getSpawnOptions } = require('./spawn-options');

const LIST_METHODS = new Set([
  'tools/list',
  'prompts/list',
  'resources/list',
  'resources/templates/list',
]);
const methodsByRequestId = new Map();

function requestKey(id) {
  return `${typeof id}:${String(id)}`;
}

function rememberRequestMethod(msg) {
  if (msg && Object.prototype.hasOwnProperty.call(msg, 'id') &&
      typeof msg.method === 'string') {
    methodsByRequestId.set(requestKey(msg.id), msg.method);
  }
}

function takeRequestMethod(msg) {
  if (!msg || !Object.prototype.hasOwnProperty.call(msg, 'id')) return undefined;
  const key = requestKey(msg.id);
  const method = methodsByRequestId.get(key);
  methodsByRequestId.delete(key);
  return method;
}

const upstream = spawn(args[0], args.slice(1), getSpawnOptions());

upstream.on('error', err => {
  process.stderr.write(`hui-shrink: failed to spawn upstream: ${err.message}\n`);
  process.exit(1);
});

upstream.on('exit', (code, signal) => {
  if (signal) process.exit(128 + (signal === 'SIGTERM' ? 15 : 9));
  process.exit(code || 0);
});

// JSON-RPC framing over stdio: messages are separated by newlines (the
// MCP stdio transport uses LSP-like content but most servers emit one JSON
// object per line). We line-buffer in both directions and parse opportunistically.
function makeLineBuffer(onLine) {
  let buf = '';
  return chunk => {
    buf += chunk.toString('utf8');
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.trim()) onLine(line);
    }
  };
}

function transformResponse(msg, method) {
  // Only transform responses for known MCP list methods. A tools/call result can
  // legitimately contain a `tools` array, so response shape alone is unsafe.
  if (!LIST_METHODS.has(method) || !msg || !msg.result || typeof msg.result !== 'object') return msg;
  const r = msg.result;
  let compressedSomething = false;

  for (const arrayName of ['tools', 'prompts', 'resources', 'resourceTemplates']) {
    if (Array.isArray(r[arrayName])) {
      for (const item of r[arrayName]) {
        for (const field of fields) {
          if (typeof item[field] === 'string') {
            const before = item[field];
            const out = compress(before).compressed;
            if (out !== before) {
              item[field] = out;
              compressedSomething = true;
              if (debug) {
                process.stderr.write(
                  `[hui-shrink] ${arrayName}.${item.name || '?'}.${field}: ` +
                  `${before.length}→${out.length} bytes\n`
                );
              }
            }
          }
        }
      }
    }
  }

  // Some servers stuff descriptions in nested schemas. Only walk if nothing
  // matched at the top level; avoids double-processing a tool's nested params.
  if (!compressedSomething) compressDescriptionsInPlace(r, fields);

  return msg;
}

// Upstream → us → client (model). Transform here.
upstream.stdout.on('data', makeLineBuffer(line => {
  let msg;
  try { msg = JSON.parse(line); } catch {
    // Pass through unparseable lines unchanged.
    process.stdout.write(line + '\n');
    return;
  }
  const out = transformResponse(msg, takeRequestMethod(msg));
  process.stdout.write(JSON.stringify(out) + '\n');
}));

// Client → us → upstream. Remember request methods by JSON-RPC id so the
// matching response can be transformed safely; notifications have no response.
process.stdin.on('data', makeLineBuffer(line => {
  try { rememberRequestMethod(JSON.parse(line)); } catch {
    // Keep malformed/non-JSON traffic transparent to the upstream server.
  }
  upstream.stdin.write(line + '\n');
}));
process.stdin.on('end',  () => upstream.stdin.end());
