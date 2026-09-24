import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HEADER = ['dep', 'marketplace', 'source', 'ref', 'skills', 'claude-code', 'codex', 'opencode', 'pi', 'omp', 'note'];
const HOSTS = HEADER.slice(5, 10);

const lines = readFileSync(new URL('../harness/deps.tsv', import.meta.url), 'utf8')
  .split('\n')
  .filter((l) => l && !l.startsWith('#'));
const [header, ...data] = lines.map((l) => l.split('\t'));
const rows = data.map((cells) => Object.fromEntries(HEADER.map((h, i) => [h, cells[i]])));

test('header matches catalog columns', () => assert.deepEqual(header, HEADER));

// The catalog installs only what the harness's SDLC loop uses; adding a pack is a deliberate edit here.
const HARNESS_DEPS = ['compound-engineering', 'agent-browser', 'caveman', 'ponytail'];
const HARNESS_SKILLS = ['agent-browser', 'caveman', 'caveman-commit', 'caveman-review'];

test('catalog is exactly the harness dependency set', () => {
  assert.deepEqual(rows.map((r) => r.dep), HARNESS_DEPS);
});

test('compound-engineering, the harness core, is first and installs natively on every host', () => {
  assert.equal(rows[0].dep, 'compound-engineering');
  for (const h of HOSTS) assert.equal(rows[0][h], 'native', h);
});

test('skills-method installs pin exactly the harness skill set', () => {
  const skills = rows.filter((r) => r.skills !== '-').flatMap((r) => r.skills.split(' '));
  assert.deepEqual(skills.sort(), [...HARNESS_SKILLS].sort());
  assert.ok(!skills.includes('*'), 'no wildcard installs: name every skill');
});

test('11 non-empty cells each, unique deps', () => {
  for (const cells of data) {
    assert.equal(cells.length, HEADER.length, cells[0]);
    assert.ok(cells.every((c) => c.trim() !== ''), `${cells[0]} has an empty cell (use -)`);
  }
  assert.equal(new Set(rows.map((r) => r.dep)).size, rows.length);
});

test('host cells are native|skills|none; omp never skills', () => {
  for (const r of rows) {
    for (const h of HOSTS) assert.match(r[h], /^(native|skills|none)$/, `${r.dep}.${h}`);
    assert.notEqual(r.omp, 'skills', r.dep);
  }
});

test('skills rows carry a 40-hex ref and a skills list', () => {
  for (const r of rows.filter((r) => HOSTS.some((h) => r[h] === 'skills'))) {
    assert.match(r.ref, /^[0-9a-f]{40}$/, r.dep);
    assert.notEqual(r.skills, '-', r.dep);
  }
});

test('claude-code native rows name a marketplace', () => {
  for (const r of rows.filter((r) => r['claude-code'] === 'native')) assert.notEqual(r.marketplace, '-', r.dep);
});
