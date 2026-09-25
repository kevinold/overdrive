import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initProject, mergeMcp, projectCommands } from '../scripts/init-project.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TMP = [];
const project = (files = {}) => {
  const d = mkdtempSync(join(tmpdir(), 'od-init-'));
  TMP.push(d);
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(d, f, '..'), { recursive: true });
    writeFileSync(join(d, f), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return d;
};
after(() => TMP.forEach((d) => rmSync(d, { recursive: true, force: true })));
const read = (d, f) => readFileSync(join(d, f), 'utf8');
const quiet = { log: () => {} };
const blocks = (s) => s.match(/<!-- overdrive:start/g)?.length ?? 0;

test('empty project gets the full overlay and a no-stack note', () => {
  const d = project();
  initProject(d, quiet);
  const agents = read(d, 'AGENTS.md');
  assert.equal(blocks(agents), 1);
  for (const h of ['## Overdrive harness', '### Project commands', '### Model gears', '### House style', '### Egress disclosure (important)', '### The compounding loop']) {
    assert.ok(agents.includes(`\n${h}\n`), h);
  }
  assert.match(agents, /No stack detected/);
  assert.equal(read(d, 'CLAUDE.md'), '@AGENTS.md\n');
  assert.equal(read(d, 'GEMINI.md'), '@AGENTS.md\n');
  assert.equal(read(d, '.compound-engineering/config.yaml'), read(ROOT, '.compound-engineering/config.example.yaml'));
  assert.ok(existsSync(join(d, 'docs/solutions/README.md')));
  assert.ok(!existsSync(join(d, '.gitignore')), 'no .gitignore invented');
});

test('every file path the block names exists in the project after --init (or links to GitHub)', () => {
  const d = project();
  initProject(d, quiet);
  const block = read(d, 'AGENTS.md');
  const paths = [...block.matchAll(/`([^`\s]+(?:\/|\.md|\.ya?ml|\.json))`/g)].map((m) => m[1]).filter((p) => !p.startsWith('http') && !p.startsWith('~'));
  assert.ok(paths.length > 0);
  for (const p of paths) assert.ok(existsSync(join(d, p)), `${p} named in AGENTS.md but absent`);
});

test('wait-on-shaped JS project: existing AGENTS.md kept, npm scripts listed, .gitignore extended', () => {
  const d = project({
    'package.json': { scripts: { test: 'npm run lint && mocha', lint: 'eslint lib' } },
    'AGENTS.md': '# wait-on\n\nMaintainer notes stay.\n',
    '.gitignore': 'node_modules\n',
  });
  initProject(d, quiet);
  const agents = read(d, 'AGENTS.md');
  assert.ok(agents.startsWith('# wait-on\n\nMaintainer notes stay.\n\n<!-- overdrive:start'));
  assert.match(agents, /Detected stack: JavaScript \(Node\)/);
  assert.match(agents, /- Test: `npm test`\n- Lint: `npm run lint`/);
  assert.doesNotMatch(agents, /tsc/);
  assert.equal(read(d, '.gitignore'), 'node_modules\n.compound-engineering/config.local.yaml\n');
});

test('TypeScript on pnpm without a typecheck script gets tsc --noEmit', () => {
  const d = project({ 'package.json': { scripts: { test: 'vitest', build: 'tsc -p .' } }, 'tsconfig.json': '{}', 'pnpm-lock.yaml': '' });
  const cmds = projectCommands(d);
  assert.equal(cmds.stack, 'TypeScript');
  assert.deepEqual([...cmds], [['Test', 'pnpm test'], ['Typecheck', 'npx tsc --noEmit'], ['Build', 'pnpm build']]);
});

test('Rust project gets cargo test, clippy, fmt, build', () => {
  const d = project({ 'Cargo.toml': '[package]\nname = "x"\n' });
  initProject(d, quiet);
  const agents = read(d, 'AGENTS.md');
  assert.match(agents, /Detected stack: Rust/);
  for (const c of ['cargo test', 'cargo clippy --all-targets -- -D warnings', 'cargo fmt --check', 'cargo build']) assert.ok(agents.includes(`\`${c}\``), c);
});

test('rerun is idempotent and replaces the block in place when the stack changes', () => {
  const d = project({ 'package.json': { scripts: { test: 'mocha' } }, 'AGENTS.md': 'before\n' });
  initProject(d, quiet);
  const first = read(d, 'AGENTS.md');
  const logs = [];
  initProject(d, { log: (l) => logs.push(l) });
  assert.equal(read(d, 'AGENTS.md'), first);
  assert.ok(logs.includes('unchanged AGENTS.md (overdrive block current)'));
  writeFileSync(join(d, 'package.json'), JSON.stringify({ scripts: { test: 'mocha', lint: 'eslint .' } }));
  writeFileSync(join(d, 'AGENTS.md'), `${read(d, 'AGENTS.md')}\nafter\n`);
  initProject(d, quiet);
  const again = read(d, 'AGENTS.md');
  assert.equal(blocks(again), 1);
  assert.match(again, /- Lint: `npm run lint`/);
  assert.ok(again.startsWith('before\n') && again.endsWith('\nafter\n'), 'content around the block kept');
});

test('existing CLAUDE.md gets one @AGENTS.md import; a CLAUDE.md -> AGENTS.md symlink is left alone', () => {
  const d = project({ 'CLAUDE.md': '# Claude notes\n' });
  initProject(d, quiet);
  initProject(d, quiet);
  assert.equal(read(d, 'CLAUDE.md'), '# Claude notes\n\n@AGENTS.md\n');
  const s = project({ 'AGENTS.md': 'x\n' });
  symlinkSync('AGENTS.md', join(s, 'CLAUDE.md'));
  initProject(s, quiet);
  assert.equal(read(s, 'CLAUDE.md'), read(s, 'AGENTS.md'), 'symlink still resolves to AGENTS.md');
});

test('existing gears config is untouched; dry-run writes nothing', () => {
  const d = project({ '.compound-engineering/config.yaml': 'plan_model: opus\n' });
  initProject(d, quiet);
  assert.equal(read(d, '.compound-engineering/config.yaml'), 'plan_model: opus\n');
  const dry = project();
  const logs = [];
  initProject(dry, { dryRun: true, log: (l) => logs.push(l) });
  assert.ok(!existsSync(join(dry, 'AGENTS.md')) && !existsSync(join(dry, 'CLAUDE.md')));
  assert.ok(logs.filter((l) => !l.startsWith('optional:')).every((l) => l.startsWith('DRY-RUN: ')), logs.join('\n'));
});

test('bootstrap.sh --init delegates to the overlay and rejects a missing dir', () => {
  const d = project();
  const r = spawnSync('/bin/bash', [join(ROOT, 'scripts/bootstrap.sh'), '--init', d], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(existsSync(join(d, 'AGENTS.md')));
  assert.equal(spawnSync('/bin/bash', [join(ROOT, 'scripts/bootstrap.sh'), '--init', '/nonexistent/od'], { encoding: 'utf8' }).status, 2);
});

const json = (d, f) => JSON.parse(read(d, f));
const PROJECT_FILES = ['.claude/settings.json', '.pi/settings.json', 'opencode.json', '.mcp.json', '.cursor/mcp.json', '.gemini/settings.json'];

test('plain --init writes no plugin config and offers --project-plugins', () => {
  const d = project();
  const logs = [];
  initProject(d, { log: (l) => logs.push(l) });
  for (const f of PROJECT_FILES) assert.ok(!existsSync(join(d, f)), f);
  assert.ok(logs.some((l) => l.includes('--project-plugins')), logs.join('\n'));
});

test('--project-plugins records every harness plugin for Claude Code, Pi, and OpenCode, plus project MCP', () => {
  const d = project();
  initProject(d, { ...quiet, projectPlugins: true });
  const claude = json(d, '.claude/settings.json');
  for (const [mkt, repo] of [['compound-engineering-plugin', 'EveryInc/compound-engineering-plugin'], ['agent-browser', 'vercel-labs/agent-browser'], ['caveman', 'JuliusBrussee/caveman'], ['ponytail', 'DietrichGebert/ponytail'], ['overdrive', 'kevinold/overdrive']]) {
    assert.deepEqual(claude.extraKnownMarketplaces[mkt], { source: { source: 'github', repo } }, mkt);
  }
  for (const p of ['compound-engineering@compound-engineering-plugin', 'agent-browser@agent-browser', 'caveman@caveman', 'ponytail@ponytail', 'overdrive@overdrive']) {
    assert.equal(claude.enabledPlugins[p], true, p);
  }
  assert.deepEqual(json(d, '.pi/settings.json').packages, [
    'git:github.com/EveryInc/compound-engineering-plugin', 'git:github.com/DietrichGebert/ponytail', 'git:github.com/kevinold/overdrive',
    'npm:pi-subagents', 'npm:pi-mcp-adapter', 'npm:pi-ask-user']);
  const oc = json(d, 'opencode.json');
  assert.deepEqual(oc.plugin, ['compound-engineering@git+https://github.com/EveryInc/compound-engineering-plugin', 'ponytail@git+https://github.com/DietrichGebert/ponytail', 'overdrive@git+https://github.com/kevinold/overdrive']);
  assert.deepEqual(Object.keys(oc.mcp), ['context7', 'codebase-memory-mcp']);
  for (const f of ['.mcp.json', '.cursor/mcp.json']) assert.deepEqual(json(d, f), json(ROOT, '.mcp.json'), f);
  assert.deepEqual(json(d, '.gemini/settings.json').mcpServers, json(ROOT, '.gemini/settings.json').mcpServers);
});

test('--project-plugins merges into existing files without overriding the team\'s choices, and reruns cleanly', () => {
  const d = project({
    '.claude/settings.json': { permissions: { allow: ['Bash(npm test)'] }, enabledPlugins: { 'ponytail@ponytail': false } },
    '.pi/settings.json': { packages: ['npm:pi-subagents'], theme: 'dark' },
    'opencode.json': { plugin: ['my-plugin'], mcp: { mine: { type: 'remote', url: 'https://m' } } },
    '.mcp.json': { mcpServers: { mine: { command: 'x' } } },
  });
  initProject(d, { ...quiet, projectPlugins: true });
  initProject(d, { ...quiet, projectPlugins: true });
  const claude = json(d, '.claude/settings.json');
  assert.deepEqual(claude.permissions, { allow: ['Bash(npm test)'] });
  assert.equal(claude.enabledPlugins['ponytail@ponytail'], false, 'an explicit false stays false');
  assert.equal(claude.enabledPlugins['compound-engineering@compound-engineering-plugin'], true);
  const pi = json(d, '.pi/settings.json');
  assert.equal(pi.theme, 'dark');
  assert.equal(pi.packages.filter((p) => p === 'npm:pi-subagents').length, 1, 'no duplicates');
  const oc = json(d, 'opencode.json');
  assert.equal(oc.plugin[0], 'my-plugin');
  assert.ok(oc.mcp.mine && oc.mcp.context7 && oc.mcp['codebase-memory-mcp']);
  const mcp = json(d, '.mcp.json');
  assert.ok(mcp.mcpServers.mine && mcp.mcpServers.context7 && mcp.mcpServers['codebase-memory-mcp']);
});

test('--project-plugins dry-run writes nothing; bootstrap passes the flag through', () => {
  const d = project();
  initProject(d, { log: () => {}, dryRun: true, projectPlugins: true });
  for (const f of PROJECT_FILES) assert.ok(!existsSync(join(d, f)), f);
  const r = spawnSync('/bin/bash', [join(ROOT, 'scripts/bootstrap.sh'), '--init', d, '--project-plugins'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(existsSync(join(d, '.claude/settings.json')));
});

test('mergeMcp adds only missing servers, keeps the user\'s servers and other keys, and reruns unchanged', () => {
  const d = project({ 'src.json': { mcpServers: { context7: { url: 'new' }, 'codebase-memory-mcp': { command: 'mise' } } },
    'dest.json': { theme: 'dark', mcpServers: { mine: { command: 'x' }, context7: { url: 'old' } } } });
  const logs = [];
  mergeMcp(join(d, 'dest.json'), join(d, 'src.json'), { log: (l) => logs.push(l) });
  assert.deepEqual(JSON.parse(read(d, 'dest.json')),
    { theme: 'dark', mcpServers: { mine: { command: 'x' }, context7: { url: 'old' }, 'codebase-memory-mcp': { command: 'mise' } } });
  assert.match(logs[0], /^update .*dest\.json \(add codebase-memory-mcp\)$/);
  mergeMcp(join(d, 'dest.json'), join(d, 'src.json'), { log: (l) => logs.push(l) });
  assert.match(logs[1], /^unchanged /);
});

test('mergeMcp creates an absent file with mcpServers only; dry-run writes nothing', () => {
  const d = project({ 'src.json': { contextFileName: 'GEMINI.md', mcpServers: { a: { url: 'u' } } } });
  const logs = [];
  mergeMcp(join(d, 'sub/dest.json'), join(d, 'src.json'), { dryRun: true, log: (l) => logs.push(l) });
  assert.ok(!existsSync(join(d, 'sub/dest.json')));
  assert.match(logs[0], /^DRY-RUN: create .*sub\/dest\.json$/);
  mergeMcp(join(d, 'sub/dest.json'), join(d, 'src.json'), quiet);
  assert.deepEqual(JSON.parse(read(d, 'sub/dest.json')), { mcpServers: { a: { url: 'u' } } });
});

test('mergeMcp leaves invalid JSON byte-identical and warns', () => {
  const d = project({ 'src.json': { mcpServers: { a: { url: 'u' } } }, 'dest.json': '{ not json' });
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts/init-project.mjs'), '--merge-mcp', join(d, 'dest.json'), join(d, 'src.json')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(d, 'dest.json'), '{ not json');
  assert.match(r.stderr, /warning: .*dest\.json is not valid JSON; left untouched/);
});
