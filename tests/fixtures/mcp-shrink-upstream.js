#!/usr/bin/env node

let buffer = '';
process.stdin.on('data', chunk => {
  buffer += chunk.toString('utf8');
  let newline;
  while ((newline = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (!line.trim()) continue;

    const request = JSON.parse(line);
    if (!Object.prototype.hasOwnProperty.call(request, 'id')) continue;

    let result;
    if (request.method === 'tools/list') {
      result = {
        tools: [{
          name: 'weather',
          description: 'The tool returns the current weather for a city.',
        }],
      };
    } else if (request.method === 'tools/call') {
      result = {
        tools: [{
          name: 'opaque-payload',
          description: 'The tool returns the current weather for a city.',
        }],
      };
    } else {
      result = { description: 'The response for a non-list method stays unchanged.' };
    }

    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
  }
});
