import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HEADER = 'OVERDRIVE HARNESS ACTIVE';
const HEADINGS = ['## Model gears', '## House style', '## The compounding loop'];
const FALLBACK = `${HEADER} — see AGENTS.md for model gears, house style, and the compounding loop.`;

// Pulls the three session-context sections out of AGENTS.md by exact H2 heading.
// ponytail: any missing heading (or file) degrades to one line, never a throw.
export function buildContext(rootDir) {
  let md;
  try { md = readFileSync(join(rootDir, 'AGENTS.md'), 'utf8'); } catch { return FALLBACK; }
  const lines = md.split(/\r?\n/);
  const sections = [];
  for (const h of HEADINGS) {
    const start = lines.indexOf(h);
    if (start === -1) return FALLBACK;
    const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
    sections.push(lines.slice(start, end === -1 ? undefined : end).join('\n').trim());
  }
  return [HEADER, ...sections].join('\n\n');
}

// Codex (PLUGIN_DATA set) needs hookSpecificOutput JSON; Claude SessionStart takes raw text.
export function writeHookOutput(event, text) {
  process.stdout.write(process.env.PLUGIN_DATA
    ? JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } })
    : text);
}
