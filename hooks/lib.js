import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HEADER = 'OVERDRIVE HARNESS ACTIVE';
const HEADINGS = ['## Model gears', '## House style', '## The compounding loop'];
const FALLBACK = `${HEADER} — see AGENTS.md for model gears, house style, and the compounding loop.`;

// Pulls H2 sections out of AGENTS.md by exact heading text; null when the file or any heading is missing.
export function sections(rootDir, headings) {
  let md;
  try { md = readFileSync(join(rootDir, 'AGENTS.md'), 'utf8'); } catch { return null; }
  const lines = md.split(/\r?\n/);
  const out = [];
  for (const h of headings) {
    const start = lines.indexOf(h);
    if (start === -1) return null;
    const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
    out.push(lines.slice(start, end === -1 ? undefined : end).join('\n').trim());
  }
  return out;
}

// The session-context sections. ponytail: any missing heading (or file) degrades to one line, never a throw.
export function buildContext(rootDir) {
  const found = sections(rootDir, HEADINGS);
  return found ? [HEADER, ...found].join('\n\n') : FALLBACK;
}

// Codex (PLUGIN_DATA set) needs hookSpecificOutput JSON; Claude SessionStart takes raw text.
export function writeHookOutput(event, text) {
  process.stdout.write(process.env.PLUGIN_DATA
    ? JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } })
    : text);
}
