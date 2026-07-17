'use strict';

// Single command contract for registrations, installers, and tests.
// Hook-backed commands require host-provided Hook APIs and must never be
// represented as portable prompt-only commands.
const HOSTS = Object.freeze({
  claude: Object.freeze({ commands: 'native', hooks: true, statusline: true, localTranscript: true, localStats: true }),
  gemini: Object.freeze({ commands: 'prompt', hooks: false, statusline: false, localTranscript: false, localStats: false }),
  opencode: Object.freeze({ commands: 'native', hooks: false, statusline: false, localTranscript: false, localStats: false }),
});

const COMMANDS = Object.freeze([
  { name: 'hui', kind: 'persistent-mode', mode: 'full', hosts: ['claude', 'gemini', 'opencode'] },
  { name: 'hui-global', kind: 'persistent-mode', mode: 'full', hosts: ['claude', 'gemini', 'opencode'] },
  { name: 'hui-lite', kind: 'persistent-mode', mode: 'lite', hosts: ['claude', 'gemini', 'opencode'] },
  { name: 'hui-ultra', kind: 'persistent-mode', mode: 'ultra', hosts: ['claude', 'gemini', 'opencode'] },
  { name: 'hui-wenyan', kind: 'persistent-mode', mode: 'wenyan', hosts: ['claude', 'gemini', 'opencode'] },
  { name: 'hui-wenyan-lite', kind: 'persistent-mode', mode: 'wenyan-lite', hosts: ['claude', 'gemini', 'opencode'] },
  { name: 'hui-wenyan-full', kind: 'persistent-mode', mode: 'wenyan', hosts: ['claude', 'gemini', 'opencode'] },
  { name: 'hui-wenyan-ultra', kind: 'persistent-mode', mode: 'wenyan-ultra', hosts: ['claude', 'gemini', 'opencode'] },
  { name: 'hui-commit', kind: 'independent-mode', mode: 'commit', hosts: ['claude', 'gemini', 'opencode'] },
  { name: 'hui-review', kind: 'independent-mode', mode: 'review', hosts: ['claude', 'gemini', 'opencode'] },
  { name: 'hui-compress', kind: 'independent-mode', mode: 'compress', hosts: ['claude', 'gemini', 'opencode'] },
  { name: 'hui-stats', kind: 'host-utility', requires: 'localStats', hosts: ['claude'] },
  { name: 'hui-session', kind: 'host-utility', requires: 'localTranscript', hosts: ['claude'] },
  { name: 'hui-init', kind: 'utility', hosts: ['claude', 'gemini', 'opencode'] },
  { name: 'hui-help', kind: 'utility', hosts: ['claude', 'gemini', 'opencode'] },
]);

function commandsFor(platform) {
  if (!HOSTS[platform]) return [];
  return COMMANDS.filter(command => command.hosts.includes(platform));
}

module.exports = { HOSTS, COMMANDS, commandsFor };
