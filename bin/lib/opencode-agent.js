'use strict';

// Strip the `tools:` field from a Claude-Code-style subagent frontmatter so
// the file is valid for opencode, whose schema rejects the YAML array form
// (`tools: [Read, Grep, Bash]`) with:
//
//   Configuration is invalid at .../agents/huicrew-reviewer.md
//   ↳ Expected object | undefined, got ["Read","Grep","Bash"] tools
//
// opencode allows `tools` to be a map (`{read: true, grep: true}`) or
// omitted entirely. Omitting falls back to opencode's default tool set,
// which is what the huicrew subagent prompts already self-restrict against
// in their body ("Read-only locator", "No `Bash` available", etc.), so
// dropping the array form is safe.

const TOOLS_FIELD_RE = /^tools[ \t]*:/;
const CONTINUATION_RE = /^[ \t]/;
const FRONTMATTER_RE = /^---(\r?\n)([\s\S]*?)(\r?\n)---/;

function stripOpencodeAgentTools(content) {
  if (typeof content !== 'string') return content;

  const match = content.match(FRONTMATTER_RE);
  if (!match) return content;

  const [, newline, frontmatter] = match;
  const out = [];
  let dropping = false;
  for (const line of frontmatter.split(newline)) {
    if (dropping) {
      if (CONTINUATION_RE.test(line)) continue;
      dropping = false;
    }
    if (TOOLS_FIELD_RE.test(line)) { dropping = true; continue; }
    out.push(line);
  }

  if (out.length === frontmatter.split(newline).length) return content;
  return `---${newline}${out.join(newline)}${match[3]}---` + content.slice(match[0].length);
}

module.exports = { stripOpencodeAgentTools };
