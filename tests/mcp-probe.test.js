import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serversFrom } from '../scripts/mcp-probe.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PROBE = join(ROOT, 'scripts/mcp-probe.mjs');
const TMP = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'od-mcp-'));
  TMP.push(d);
  return d;
};
after(() => TMP.forEach((d) => rmSync(d, { recursive: true, force: true })));

// A fake stdio MCP server: answers initialize, or errors like a server whose daemon won't start.
function fakeServer(dir, { fail = false } = {}) {
  const f = join(dir, fail ? 'bad.mjs' : 'good.mjs');
  writeFileSync(f, `process.stdin.on('data', () => { process.stdout.write(JSON.stringify(${fail
    ? `{ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'daemon could not start' } }`
    : `{ jsonrpc: '2.0', id: 1, result: { serverInfo: { name: 'fake', version: '1' } } }`}) + '\\n'); });`);
  return f;
}
const probe = (args) => spawnSync(process.execPath, [PROBE, ...args], { encoding: 'utf8', env: { ...process.env, OVERDRIVE_MCP_TIMEOUT_MS: '5000' } });

test('every shipped agent config launches codebase-memory-mcp with the pinned mise tool, not bare `mise exec`', () => {
  const pin = readFileSync(join(ROOT, 'mise.toml'), 'utf8').match(/"github:DeusData\/codebase-memory-mcp" = "([^"]+)"/)[1];
  const want = { command: 'mise', args: ['exec', `github:DeusData/codebase-memory-mcp@${pin}`, '--', 'codebase-memory-mcp'] };
  const shipped = [
    ['mcpServers', '.mcp.json'],
    ['mcpServers', '.gemini/settings.json'],
    ['opencode', '.opencode/opencode.json'],
  ];
  for (const [format, file] of shipped) {
    const s = serversFrom(format, readFileSync(join(ROOT, file), 'utf8')).find((x) => x.name === 'codebase-memory-mcp');
    assert.deepEqual({ command: s.command, args: s.args }, want, file);
  }
  const boot = readFileSync(join(ROOT, 'scripts/bootstrap.sh'), 'utf8');
  assert.match(boot, new RegExp(`CBM_TOOL="github:DeusData/codebase-memory-mcp@${pin.replace(/\./g, '\\.')}"`));
  const codexRef = readFileSync(join(ROOT, '.codex/config.toml'), 'utf8');
  assert.match(codexRef, new RegExp(`"github:DeusData/codebase-memory-mcp@${pin.replace(/\./g, '\\.')}"`));
});

test('serversFrom normalizes every agent format', () => {
  assert.deepEqual(serversFrom('opencode', JSON.stringify({ mcp: { a: { type: 'local', command: ['x', 'y'] }, b: { type: 'remote', url: 'https://u' } } })),
    [{ name: 'a', command: 'x', args: ['y'] }, { name: 'b', url: 'https://u' }]);
  assert.deepEqual(serversFrom('mcpServers', JSON.stringify({ mcpServers: { g: { httpUrl: 'https://g' } } })), [{ name: 'g', url: 'https://g' }]);
  assert.deepEqual(serversFrom('codex-get', JSON.stringify({ name: 'c', transport: { type: 'stdio', command: 'm', args: ['e'] } })),
    [{ name: 'c', command: 'm', args: ['e'] }]);
});

test('probe passes a server that answers initialize, from the given cwd', () => {
  const d = tmp();
  const cfg = join(d, 'mcp.json');
  writeFileSync(cfg, JSON.stringify({ mcpServers: { fake: { command: process.execPath, args: [fakeServer(d)] } } }));
  const r = probe(['--cwd', d, `omp=mcpServers:${cfg}`]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^ok\s+omp fake: fake 1/m);
});

test('probe fails on an initialize error, a missing command, a missing config, and an empty config', () => {
  const d = tmp();
  const bad = join(d, 'bad.json');
  writeFileSync(bad, JSON.stringify({ mcpServers: { cbm: { command: process.execPath, args: [fakeServer(d, { fail: true })] }, nope: { command: 'no-such-binary-od' } } }));
  const empty = join(d, 'empty.json');
  writeFileSync(empty, '{}');
  const r = probe(['--cwd', d, `pi=mcpServers:${bad}`, `omp=mcpServers:${join(d, 'missing.json')}`, `gemini=mcpServers:${empty}`]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL pi cbm: daemon could not start/);
  assert.match(r.stdout, /FAIL pi nope: cannot launch no-such-binary-od/);
  assert.match(r.stdout, /FAIL omp: cannot read/);
  assert.match(r.stdout, /FAIL gemini: no MCP servers/);
});
