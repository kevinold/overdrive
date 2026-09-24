import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContext } from '../hooks/lib.js';

const TMP = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'od-'));
  TMP.push(d);
  return d;
};
after(() => TMP.forEach((d) => rmSync(d, { recursive: true, force: true })));

const root = fileURLToPath(new URL('../', import.meta.url));
const script = join(root, 'hooks/overdrive-context.js');
const run = (env) => {
  const e = { ...process.env, ...env };
  delete e.PLUGIN_DATA;
  if (env.PLUGIN_DATA) e.PLUGIN_DATA = env.PLUGIN_DATA;
  return spawnSync(process.execPath, [script], { env: e, encoding: 'utf8' });
};
const snippets = ['Three gears, never one model', 'Two behavior plugins run by default', 'Knowledge compounds instead of being rediscovered'];

test('PLUGIN_DATA unset writes raw context with all three sections', () => {
  const r = run({});
  assert.equal(r.status, 0);
  assert.ok(r.stdout.startsWith('OVERDRIVE HARNESS ACTIVE'));
  for (const s of snippets) assert.ok(r.stdout.includes(s), s);
});

test('PLUGIN_DATA set writes Codex hookSpecificOutput JSON', () => {
  const r = run({ PLUGIN_DATA: tmp() });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(out.hookSpecificOutput.additionalContext, buildContext(root));
});

test('missing heading yields fallback line, no throw', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'AGENTS.md'), '# x\n\n## Model gears\n\ngears\n');
  const ctx = buildContext(dir);
  assert.ok(ctx.startsWith('OVERDRIVE HARNESS ACTIVE'));
  assert.equal(ctx.split('\n').length, 1);
  assert.equal(buildContext(join(dir, 'nope')).split('\n').length, 1);
});

test('built context stays under the Codex budget (6000 bytes)', () => {
  assert.ok(Buffer.byteLength(buildContext(root)) < 6000);
});

test('hooks.json parses and its only event is SessionStart', () => {
  const { hooks } = JSON.parse(readFileSync(join(root, 'hooks/hooks.json'), 'utf8'));
  assert.deepEqual(Object.keys(hooks), ['SessionStart']);
  assert.equal(hooks.SessionStart[0].matcher, 'startup|resume|clear|compact');
});
