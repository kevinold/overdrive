import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const WSHOBSON = 'wshobson/agents#70444e5b1fae2237f3cb087c70db043ab633fe11';
// ponytail: /usr/bin:/bin hold no host binaries, so tests control exactly which hosts exist.
const SYS_PATH = '/usr/bin:/bin';

const TMP = [];
function tmp(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  TMP.push(dir);
  return dir;
}
after(() => TMP.forEach((d) => rmSync(d, { recursive: true, force: true })));

function boot(args, { path, home, root = ROOT } = {}) {
  const env = { ...process.env };
  if (path) env.PATH = path;
  if (home) env.HOME = home;
  return spawnSync('/bin/bash', [join(root, 'scripts/bootstrap.sh'), ...args], { encoding: 'utf8', env });
}

// Temp bin dir: node symlink plus one shell stub per name (body = shell snippet, default exit 0).
function stubDir(stubs = {}) {
  const dir = tmp('od-bin-');
  symlinkSync(process.execPath, join(dir, 'node'));
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(join(dir, name), `#!/bin/sh\necho "${name} $*" >> "$STUB_LOG"\n${body || 'exit 0'}\n`);
    chmodSync(join(dir, name), 0o755);
  }
  return dir;
}

// Temp repo copy so real runs and config tests never touch this checkout.
function repoCopy() {
  const dir = tmp('od-repo-');
  for (const p of ['scripts', 'harness', '.mcp.json']) cpSync(join(ROOT, p), join(dir, p), { recursive: true });
  mkdirSync(join(dir, '.compound-engineering'));
  cpSync(join(ROOT, '.compound-engineering/config.example.yaml'), join(dir, '.compound-engineering/config.example.yaml'));
  return dir;
}

const lines = (out) => out.split('\n');

test('codex dry-run: native, skills, none rows + MCP + trust checklist', () => {
  const r = boot(['--dry-run', '--agent', 'codex']);
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout;
  const add = lines(out).filter((l) => l === 'DRY-RUN: codex plugin marketplace add EveryInc/compound-engineering-plugin');
  assert.equal(add.length, 1);
  assert.match(out, /DRY-RUN: codex plugin add compound-engineering@compound-engineering-plugin/);
  for (const pack of ['javascript-testing-patterns', 'async-python-patterns', 'api-design-principles', 'cost-optimization', 'auth-implementation-patterns']) {
    assert.match(out, new RegExp(`DRY-RUN: npx -y skills@1\\.7\\.0 add ${WSHOBSON} -s ${pack} .* -a codex -g -y`));
  }
  assert.match(out, /DRY-RUN: codex mcp add context7 --url https:\/\/mcp\.context7\.com\/mcp/);
  assert.match(out, /DRY-RUN: codex mcp add codebase-memory-mcp -- mise exec -- codebase-memory-mcp/);
  assert.match(out, /\[features\] hooks = true/);
  assert.match(out, /\/hooks/);
  assert.equal(lines(out).filter((l) => l.startsWith('skip debugging-toolkit on codex:')).length, 1);
  assert.ok(lines(out).includes('skip debugging-toolkit on codex: agents/commands only, no skill form'));
  assert.doesNotMatch(out, /debugging-toolkit@/);
});

test('detection without --agent picks only hosts on PATH', () => {
  const bin = stubDir({ claude: '', pi: '' });
  const r = boot(['--dry-run'], { path: `${bin}:${SYS_PATH}` });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /== claude-code ==/);
  assert.match(r.stdout, /== pi ==/);
  assert.doesNotMatch(r.stdout, /DRY-RUN: (codex|omp) /);
  assert.doesNotMatch(r.stdout, /== (codex|opencode|omp) ==|-a [^\n]*(codex|opencode)/);
});

test('pi dry-run: companions, self-install from the clone, skills', () => {
  const r = boot(['--dry-run', '--agent', 'pi']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /DRY-RUN: pi install npm:pi-subagents/);
  assert.match(r.stdout, /DRY-RUN: pi install npm:pi-mcp-adapter/);
  assert.ok(lines(r.stdout).includes(`DRY-RUN: pi install ${ROOT}`));
  assert.match(r.stdout, /DRY-RUN: pi install git:github\.com\/EveryInc\/compound-engineering-plugin/);
  assert.match(r.stdout, /-a pi -g -y/);
});

test('omp dry-run with omp absent: all actions DRY-RUN, marketplace pairs, link, no npx skills', () => {
  const bin = stubDir();
  const r = boot(['--dry-run', '--agent', 'omp'], { path: `${bin}:${SYS_PATH}` });
  assert.equal(r.status, 0, r.stderr);
  const ompCmds = lines(r.stdout).filter((l) => /(^|: )omp plugin /.test(l));
  assert.ok(ompCmds.length > 0);
  for (const l of ompCmds) assert.ok(l.startsWith('DRY-RUN: '), l);
  assert.match(r.stdout, /DRY-RUN: omp plugin marketplace add wshobson\/agents/);
  assert.match(r.stdout, /DRY-RUN: omp plugin install pm-rituals@pm-claude-skills/);
  assert.ok(lines(r.stdout).includes(`DRY-RUN: omp plugin link ${ROOT}`));
  assert.doesNotMatch(r.stdout, /npx -y skills/);
  assert.equal(lines(r.stdout).filter((l) => l === 'DRY-RUN: omp plugin marketplace add wshobson/agents').length, 1);
});

test('opencode dry-run: plugin snippet + npx skills', () => {
  const r = boot(['--dry-run', '--agent', 'opencode']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes(`${ROOT}/.opencode/plugins/overdrive.mjs`));
  assert.match(r.stdout, /compound-engineering@git\+https:\/\/github\.com\/EveryInc\/compound-engineering-plugin/);
  assert.match(r.stdout, /ponytail/);
  assert.match(r.stdout, /DRY-RUN: npx -y skills@1\.7\.0 add .* -a opencode -g -y/);
});

test('one npx line per row with space-separated -a hosts', () => {
  const r = boot(['--dry-run', '--agent', 'codex,pi']);
  assert.equal(r.status, 0, r.stderr);
  const fd = lines(r.stdout).filter((l) => l.includes('-s frontend-design'));
  assert.equal(fd.length, 1);
  assert.match(fd[0], / -a codex pi -g -y$/);
  // repeatable --agent is equivalent
  const r2 = boot(['--dry-run', '--agent', 'codex', '--agent', 'pi']);
  assert.equal(r2.stdout, r.stdout);
});

test('skills names split into separate args; * passes unexpanded', () => {
  const r = boot(['--dry-run', '--agent', 'pi']);
  assert.match(r.stdout, / -s pm-weekly-review plan-my-day -a pi /);
  assert.match(r.stdout, /add EveryInc\/compound-writing#18702f0ece9f2b852e305807e0271b2d550d9b4b -s \* -a pi -g -y/);
});

test('bogus --agent exits 2 naming valid ids', () => {
  const r = boot(['--dry-run', '--agent', 'bogus']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /claude-code codex opencode pi omp/);
});

test('no agent flag and no host on PATH exits 1', () => {
  const bin = stubDir();
  const r = boot(['--dry-run'], { path: `${bin}:${SYS_PATH}` });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no agent found/);
});

test('config.yaml untouched when present; dry-run seeds nothing when absent', () => {
  const repo = repoCopy();
  const cfg = join(repo, '.compound-engineering/config.yaml');
  writeFileSync(cfg, 'driver: my-edit\n');
  const before = readFileSync(cfg);
  const r = boot(['--dry-run', '--agent', 'codex'], { root: repo });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readFileSync(cfg), before);
  assert.match(r.stdout, /Leaving your gears untouched/);
  rmSync(cfg);
  const r2 = boot(['--dry-run', '--agent', 'codex'], { root: repo });
  assert.match(r2.stdout, /DRY-RUN: cp .*config\.example\.yaml .*config\.yaml/);
  assert.equal(existsSync(cfg), false);
});

function realRun(stubs, agents) {
  const repo = repoCopy();
  const home = tmp('od-home-');
  const log = join(home, 'stub.log');
  writeFileSync(log, '');
  const bin = stubDir({ npx: '', mise: '', ...stubs });
  process.env.STUB_LOG = log;
  const r = boot(['--agent', agents], { path: `${bin}:${SYS_PATH}`, home, root: repo });
  return { r, log: readFileSync(log, 'utf8'), home, repo };
}

test('real run: unrecognized failure continues, lands in summary, exits non-zero', () => {
  const { r, log } = realRun({ codex: 'echo "boom: network down"; exit 1' }, 'codex');
  assert.notEqual(r.status, 0);
  assert.match(log, /codex plugin add compound-engineering@compound-engineering-plugin/);
  assert.match(log, /codex mcp add context7/); // kept going past the first failure
  assert.match(log, /npx -y skills@1\.7\.0 add/);
  const summary = r.stdout.slice(r.stdout.indexOf('== Failures =='));
  assert.ok(r.stdout.includes('== Failures =='));
  assert.match(summary, /codex plugin add compound-engineering@compound-engineering-plugin/);
});

test('real run: already-installed exit 1 is benign', () => {
  const { r } = realRun({ codex: 'echo "Plugin already installed"; exit 1' }, 'codex');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /== Failures ==/);
});

test('real run skips an absent host, runs the rest, exits non-zero', () => {
  const { r, log, home, repo } = realRun({ pi: '' }, 'codex,pi');
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /codex: binary not found, skipped/);
  assert.match(log, /pi install npm:pi-mcp-adapter/);
  assert.match(log, new RegExp(`pi install ${repo}`));
  assert.doesNotMatch(log, /^codex /m);
  assert.ok(existsSync(join(home, '.pi/agent/mcp.json')));
  assert.ok(existsSync(join(repo, '.compound-engineering/config.yaml'))); // seeded in the copy
});
