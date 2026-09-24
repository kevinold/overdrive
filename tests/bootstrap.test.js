import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const CAVEMAN = 'JuliusBrussee/caveman#655b7d9c5431f822264b7732e9901c5578ac84cf';
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

test('claude-code, pi, and omp register both MCP servers at user scope with the pinned tool', () => {
  const home = tmp('od-home-');
  const r = boot(['--dry-run', '--agent', 'claude-code,pi,omp'], { home });
  assert.equal(r.status, 0, r.stderr);
  const L = lines(r.stdout);
  assert.ok(L.includes('DRY-RUN: claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp'));
  assert.ok(L.includes('DRY-RUN: claude mcp add --scope user codebase-memory-mcp -- mise exec github:DeusData/codebase-memory-mcp@0.11.0 -- codebase-memory-mcp'));
  assert.ok(L.includes(`DRY-RUN: cp ${ROOT}/.mcp.json ${home}/.pi/agent/mcp.json`));
  assert.ok(L.includes(`DRY-RUN: cp ${ROOT}/.mcp.json ${home}/.omp/agent/mcp.json`));
});

test('codex dry-run: native, skills, none rows + MCP + trust checklist', () => {
  const r = boot(['--dry-run', '--agent', 'codex']);
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout;
  const add = lines(out).filter((l) => l === 'DRY-RUN: codex plugin marketplace add EveryInc/compound-engineering-plugin');
  assert.equal(add.length, 1);
  assert.match(out, /DRY-RUN: codex plugin add compound-engineering@compound-engineering-plugin/);
  assert.ok(lines(out).includes(`DRY-RUN: npx -y skills@1.7.0 add ${CAVEMAN} -s caveman caveman-commit caveman-review -a codex -g -y`));
  assert.match(out, /DRY-RUN: codex mcp add context7 --url https:\/\/mcp\.context7\.com\/mcp/);
  assert.match(out, /DRY-RUN: codex mcp add codebase-memory-mcp -- mise exec github:DeusData\/codebase-memory-mcp@0\.11\.0 -- codebase-memory-mcp/);
  assert.match(out, /\[features\] hooks = true/);
  assert.match(out, /\/hooks/);
  assert.equal(lines(out).filter((l) => l.startsWith('skip typescript-lsp on codex:')).length, 1);
  assert.ok(lines(out).includes('skip typescript-lsp on codex: LSP manifest; binary is a tool prerequisite'));
  assert.doesNotMatch(out, /typescript-lsp@/);
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
  assert.match(r.stdout, /DRY-RUN: omp plugin marketplace add JuliusBrussee\/caveman/);
  assert.match(r.stdout, /DRY-RUN: omp plugin install caveman@caveman/);
  assert.ok(lines(r.stdout).includes(`DRY-RUN: omp plugin link ${ROOT}`));
  assert.doesNotMatch(r.stdout, /npx -y skills/);
  // marketplace adds dedupe per (host, marketplace): claude-plugins-official carries two claude-native rows
  const c = boot(['--dry-run', '--agent', 'claude-code']);
  assert.equal(lines(c.stdout).filter((l) => l === 'DRY-RUN: claude plugin marketplace add anthropics/claude-plugins-official').length, 1);
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
  const fd = lines(r.stdout).filter((l) => l.includes('-s agent-browser'));
  assert.equal(fd.length, 1);
  assert.match(fd[0], / -a codex pi -g -y$/);
  // repeatable --agent is equivalent
  const r2 = boot(['--dry-run', '--agent', 'codex', '--agent', 'pi']);
  assert.equal(r2.stdout, r.stdout);
});

test('skills names split into separate args', () => {
  const r = boot(['--dry-run', '--agent', 'pi']);
  assert.match(r.stdout, / -s caveman caveman-commit caveman-review -a pi /);
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

// Fake npx for --check: creates <dir>/<skill>/SKILL.md for every -s name under every -a host's project dir.
const FAKE_NPX = `echo "HOME=$HOME PWD=$PWD" >> "$STUB_LOG"
mode=""; names=""; hosts=""
for a in "$@"; do
  case "$a" in -s) mode=s ;; -a) mode=a ;; -*) mode="" ;;
    *) [ "$mode" = s ] && names="$names $a"; [ "$mode" = a ] && hosts="$hosts $a" ;; esac
done
for h in $hosts; do
  case "$h" in claude-code) d=.claude/skills ;; universal) d=.agents/skills ;; pi) d=.pi/skills ;; *) continue ;; esac
  for n in $names; do mkdir -p "$d/$n" && echo x > "$d/$n/SKILL.md"; done
done`;

function sampleProject() {
  const dir = tmp('od-sample-');
  writeFileSync(join(dir, 'package.json'), '{}');
  return dir;
}

// Fake `mise` for --check: behaves as the codebase-memory-mcp stdio server the configs launch.
const FAKE_MISE = `read l; echo '{"jsonrpc":"2.0","id":1,"result":{"serverInfo":{"name":"stub-cbm","version":"0"}}}'; sleep 1`;

test('--check installs every skills row into a throwaway copy and verifies SKILL.md per host dir', () => {
  process.env.OVERDRIVE_MCP_OFFLINE = '1';
  const sample = sampleProject();
  const home = tmp('od-home-');
  const log = join(home, 'stub.log');
  writeFileSync(log, '');
  process.env.STUB_LOG = log;
  const r = boot(['--check', sample], { path: `${stubDir({ npx: FAKE_NPX, mise: FAKE_MISE })}:${SYS_PATH}`, home });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const agent of ['pi', 'omp', 'opencode', 'gemini', 'cursor']) {
    assert.match(r.stdout, new RegExp(`^ok\\s+${agent} codebase-memory-mcp: stub-cbm`, 'm'), agent);
  }
  assert.ok(!existsSync(join(home, '.omp')) && !existsSync(join(home, '.pi')), 'real HOME untouched');
  assert.match(r.stdout, /skills present in \.claude\/skills, \.agents\/skills, \.pi\/skills/);
  assert.match(r.stdout, /-a claude-code universal pi -y --copy/);
  const l = readFileSync(log, 'utf8');
  assert.doesNotMatch(l, new RegExp(`HOME=${home}\\b`), 'HOME must be sandboxed, not the caller HOME');
  assert.doesNotMatch(l, new RegExp(`PWD=${sample}`), 'installs run in the copy, never the sample');
  assert.ok(!existsSync(join(sample, '.claude')), 'sample project untouched');
});

test('--check reports a skill that did not land and exits non-zero', () => {
  const home = tmp('od-home-');
  process.env.STUB_LOG = join(home, 'stub.log');
  const r = boot(['--check', sampleProject()], { path: `${stubDir({ npx: 'exit 0' })}:${SYS_PATH}`, home });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /== Failures ==[\s\S]*missing \.claude\/skills\/caveman\/SKILL\.md/);
});

test('--check without an existing project dir exits 2', () => {
  assert.equal(boot(['--check', '/nonexistent/od-project']).status, 2);
  assert.equal(boot(['--check']).status, 2);
});

test('real run: an installer that reads stdin cannot swallow the rest of the catalog', () => {
  // npx and the host CLIs may read stdin; the catalog loop must not hand them deps.tsv.
  const { r, log } = realRun({ codex: 'cat >/dev/null; exit 0', npx: 'cat >/dev/null; exit 0' }, 'codex');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(log, /codex plugin add compound-engineering@compound-engineering-plugin/);
  assert.match(log, /codex plugin add ponytail@ponytail/);
  assert.match(log, /npx -y skills@1\.7\.0 add JuliusBrussee\/caveman#/);
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
