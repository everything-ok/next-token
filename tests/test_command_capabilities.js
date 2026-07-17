#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { HOSTS, COMMANDS, commandsFor } = require('../src/command-capabilities');

assert.deepStrictEqual(Object.keys(HOSTS).sort(), ['claude', 'gemini', 'opencode']);
assert.equal(new Set(COMMANDS.map(command => command.name)).size, COMMANDS.length, 'command names must be unique');

const namesFor = host => commandsFor(host).map(command => command.name);
assert.ok(namesFor('claude').includes('hui-stats'));
assert.ok(namesFor('claude').includes('hui-session'));
assert.ok(!namesFor('gemini').includes('hui-stats'));
assert.ok(!namesFor('gemini').includes('hui-session'));
assert.ok(!namesFor('opencode').includes('hui-stats'));
assert.ok(!namesFor('opencode').includes('hui-session'));
assert.deepStrictEqual(commandsFor('unknown'), []);

for (const command of COMMANDS) {
  assert.ok(Array.isArray(command.hosts) && command.hosts.length > 0, `${command.name} must declare hosts`);
  for (const host of command.hosts) assert.ok(HOSTS[host], `${command.name} references unknown host ${host}`);
  if (command.requires) {
    for (const host of command.hosts) assert.equal(HOSTS[host][command.requires], true, `${command.name} requires ${command.requires} on ${host}`);
  }
}

console.log('command capability tests passed');
