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

test('header matches KTD2 columns', () => assert.deepEqual(header, HEADER));

test('18 rows, 11 non-empty cells each, unique deps', () => {
  assert.equal(rows.length, 18);
  for (const cells of data) {
    assert.equal(cells.length, HEADER.length, cells[0]);
    assert.ok(cells.every((c) => c.trim() !== ''), `${cells[0]} has an empty cell (use -)`);
  }
  assert.equal(new Set(rows.map((r) => r.dep)).size, 18);
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
