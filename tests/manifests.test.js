import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const json = (p) => JSON.parse(read(p));
const manifests = [
  'package.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.codex-plugin/plugin.json',
  '.agents/plugins/marketplace.json',
  '.omp-plugin/marketplace.json',
];

test('versions agree across package.json, plugin manifests, and omp catalog', () => {
  const omp = json('.omp-plugin/marketplace.json').plugins.find((p) => p.name === 'overdrive');
  const versions = [
    json('package.json').version,
    json('.claude-plugin/plugin.json').version,
    json('.codex-plugin/plugin.json').version,
    omp.version,
  ];
  assert.ok(versions[0]);
  assert.deepEqual(new Set(versions).size, 1, `versions differ: ${versions}`);
});

test('no manifest carries $schema', () => {
  for (const m of manifests) assert.ok(!('$schema' in json(m)), m);
});

const frontmatter = (text) => Object.fromEntries(
  text.split('---')[1].trim().split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]),
);

test('skill frontmatter name matches directory and description is set', () => {
  const fm = frontmatter(read('skills/ui-visual-validator/SKILL.md'));
  assert.equal(fm.name, 'ui-visual-validator');
  assert.ok(fm.description);
});

test('agent wrapper defers to the skill without copying its method', () => {
  const body = read('agents/ui-visual-validator.md').split('---').slice(2).join('---');
  assert.match(body, /ui-visual-validator/);
  const headings = read('skills/ui-visual-validator/SKILL.md').match(/^#+ .+$/gm) ?? [];
  assert.ok(headings.length);
  for (const h of headings) assert.ok(!body.includes(h), h);
});

test('.claude/agents/ is gone', () => {
  assert.ok(!existsSync(new URL('.claude/agents', root)));
});
