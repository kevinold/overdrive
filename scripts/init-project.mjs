#!/usr/bin/env node
// Overlay the overdrive harness's project-level pieces onto a project:
//   node scripts/init-project.mjs <project-dir> [--dry-run]
// Writes only what is absent, plus one managed block in AGENTS.md that a rerun replaces.
// Never touches content outside that block.
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sections } from '../hooks/lib.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO_URL = 'https://github.com/kevinold/overdrive';
const START = '<!-- overdrive:start (managed by overdrive `bootstrap.sh --init`; a rerun replaces this block) -->';
const END = '<!-- overdrive:end -->';
const BLOCK_RE = /<!-- overdrive:start[\s\S]*?<!-- overdrive:end -->/;
const HARNESS_HEADINGS = ['## Model gears', '## House style', '## Egress disclosure (important)', '## The compounding loop'];

const OVERDRIVE = { dep: 'overdrive', marketplace: 'overdrive', source: 'kevinold/overdrive' };
const PI_COMPANIONS = ['npm:pi-subagents', 'npm:pi-mcp-adapter', 'npm:pi-ask-user'];

// Catalog rows a host installs natively, plus overdrive itself.
export function nativeFor(host) {
  const lines = readFileSync(join(ROOT, 'harness/deps.tsv'), 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
  const [head, ...rows] = lines.map((l) => l.split('\t'));
  const col = head.indexOf(host);
  return [...rows.filter((r) => r[col] === 'native').map(([dep, marketplace, source]) => ({ dep, marketplace, source })), OVERDRIVE];
}

const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };

const put = (file, text) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); };
const addServers = (into, from) => { for (const [k, v] of Object.entries(from)) into[k] ??= v; return into; };

// Merge fn's result into a JSON file: adds what is missing, never flips a value already set.
// An unparseable file is left untouched with a warning.
function mergeJson(file, fn, { dryRun = false, log = console.log, label = file, note = '' } = {}) {
  let cur = null;
  if (existsSync(file)) {
    try { cur = JSON.parse(readFileSync(file, 'utf8')); } catch {
      console.error(`warning: ${file} is not valid JSON; left untouched`);
      return;
    }
  }
  const next = fn(structuredClone(cur ?? {}));
  if (cur && JSON.stringify(cur) === JSON.stringify(next)) return log(`unchanged ${label}`);
  log(`${dryRun ? 'DRY-RUN: ' : ''}${cur ? 'update' : 'create'} ${label}${cur ? note : ''}`);
  if (!dryRun) put(file, `${JSON.stringify(next, null, 2)}\n`);
}

// Add src's MCP servers missing from dest. Other keys and existing servers stay as they are.
// ponytail: a fresh dest gets mcpServers only (Gemini's contextFileName is its default anyway).
export function mergeMcp(dest, src, opts = {}) {
  const servers = readJson(src).mcpServers;
  const have = readJson(dest)?.mcpServers ?? {};
  const added = Object.keys(servers).filter((k) => !(k in have));
  mergeJson(dest, (c) => ({ ...c, mcpServers: addServers(c.mcpServers ?? {}, servers) }), { ...opts, note: ` (add ${added.join(', ')})` });
}

// Verification commands the agents run before calling work done, from the project's own stack.
export function projectCommands(dir) {
  const cmds = [];
  const pkg = readJson(join(dir, 'package.json'));
  if (pkg) {
    const pm = existsSync(join(dir, 'pnpm-lock.yaml')) ? 'pnpm' : existsSync(join(dir, 'yarn.lock')) ? 'yarn'
      : existsSync(join(dir, 'bun.lock')) || existsSync(join(dir, 'bun.lockb')) ? 'bun' : 'npm';
    const run = (s) => (s === 'test' ? `${pm} test` : pm === 'npm' || pm === 'bun' ? `${pm} run ${s}` : `${pm} ${s}`);
    const scripts = pkg.scripts || {};
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const ts = existsSync(join(dir, 'tsconfig.json')) || 'typescript' in deps;
    for (const [label, names] of [['Test', ['test']], ['Lint', ['lint']], ['Typecheck', ['typecheck', 'type-check', 'tsc']], ['Build', ['build']]]) {
      const s = names.find((n) => scripts[n]);
      if (s) cmds.push([label, run(s)]);
      else if (label === 'Typecheck' && ts) cmds.push([label, 'npx tsc --noEmit']);
    }
    cmds.stack = ts ? 'TypeScript' : 'JavaScript (Node)';
  }
  if (existsSync(join(dir, 'Cargo.toml'))) {
    cmds.push(['Test', 'cargo test'], ['Lint', 'cargo clippy --all-targets -- -D warnings'], ['Format', 'cargo fmt --check'], ['Build', 'cargo build']);
    cmds.stack = cmds.stack ? `${cmds.stack} + Rust` : 'Rust';
  }
  return cmds;
}

export function harnessBlock(dir) {
  const found = sections(ROOT, HARNESS_HEADINGS);
  if (!found) throw new Error(`overdrive AGENTS.md is missing one of: ${HARNESS_HEADINGS.join(', ')}`);
  // Demote headings under the block's H2, and point overdrive-only paths at their project or GitHub homes.
  const demote = (s) => s.replace(/^(#{2,5}) /gm, '#$1 ')
    .replaceAll('`docs/capability-matrix.md`', `[docs/capability-matrix.md](${REPO_URL}/blob/main/docs/capability-matrix.md)`)
    .replaceAll('`.compound-engineering/config.example.yaml`', '`.compound-engineering/config.yaml`');
  const cmds = projectCommands(dir);
  const commands = cmds.length
    ? [`Detected stack: ${cmds.stack}. Run these before calling work done:`, '', ...cmds.map(([l, c]) => `- ${l}: \`${c}\``)].join('\n')
    : 'No stack detected. Add this project\'s test and lint commands in a section below this block, so agents run them before calling work done.';
  return [
    START,
    '## Overdrive harness',
    '',
    `This project uses the [overdrive](${REPO_URL}) harness. Install or update the agent side (plugins, skills, hooks, MCP) with \`npx -y github:kevinold/overdrive\`; what each agent gets: [capability matrix](${REPO_URL}/blob/main/docs/capability-matrix.md).`,
    '',
    '### Project commands',
    '',
    commands,
    '',
    ...found.map(demote).flatMap((s) => [s, '']),
    END,
  ].join('\n');
}

export function initProject(dir, { dryRun = false, projectPlugins = false, log = console.log } = {}) {
  const act = (verb, rel, write) => {
    log(`${dryRun ? 'DRY-RUN: ' : ''}${verb} ${rel}`);
    if (!dryRun) write();
  };

  // AGENTS.md: the managed block (Codex, OpenCode, Pi, omp, and Cursor read AGENTS.md natively).
  const agents = join(dir, 'AGENTS.md');
  const block = harnessBlock(dir);
  if (!existsSync(agents)) act('create', 'AGENTS.md', () => put(agents, `${block}\n`));
  else {
    const cur = readFileSync(agents, 'utf8');
    const next = BLOCK_RE.test(cur) ? cur.replace(BLOCK_RE, block) : `${cur.replace(/\s*$/, '')}\n\n${block}\n`;
    if (next === cur) log('unchanged AGENTS.md (overdrive block current)');
    else act('update', 'AGENTS.md (overdrive block)', () => writeFileSync(agents, next));
  }

  // Claude Code reads CLAUDE.md and Gemini reads GEMINI.md; both import AGENTS.md with `@AGENTS.md`.
  for (const f of ['CLAUDE.md', 'GEMINI.md']) {
    const p = join(dir, f);
    if (!existsSync(p)) act('create', `${f} (@AGENTS.md)`, () => put(p, '@AGENTS.md\n'));
    else if (lstatSync(p).isSymbolicLink() || /@AGENTS\.md/.test(readFileSync(p, 'utf8'))) log(`unchanged ${f} (already reads AGENTS.md)`);
    else act('update', `${f} (append @AGENTS.md)`, () => writeFileSync(p, `${readFileSync(p, 'utf8').replace(/\s*$/, '')}\n\n@AGENTS.md\n`));
  }

  // Gears config (compound-engineering reads it per repo) and the compounding store.
  for (const [rel, src] of [['.compound-engineering/config.yaml', '.compound-engineering/config.example.yaml'], ['docs/solutions/README.md', 'docs/solutions/README.md']]) {
    if (existsSync(join(dir, rel))) log(`unchanged ${rel} (exists)`);
    else act('create', rel, () => put(join(dir, rel), readFileSync(join(ROOT, src), 'utf8')));
  }

  // Keep per-developer gear overrides (and Pi's project package cache) out of git.
  const gi = join(dir, '.gitignore');
  const ignores = ['.compound-engineering/config.local.yaml', ...(projectPlugins ? ['.pi/npm/'] : [])];
  if (existsSync(gi)) {
    const missing = ignores.filter((i) => !readFileSync(gi, 'utf8').split('\n').includes(i));
    if (missing.length) act('update', `.gitignore (${missing.join(', ')})`, () =>
      writeFileSync(gi, `${readFileSync(gi, 'utf8').replace(/\s*$/, '')}\n${missing.join('\n')}\n`));
  }

  if (!projectPlugins) {
    log(`optional: record the harness plugins and MCP servers in this project so teammates' agents offer to install them: bootstrap.sh --init ${dir} --project-plugins`);
    return;
  }

  // --project-plugins: committable, project-scoped plugin + MCP config. Merges: adds what is missing,
  // never flips a value the project already set.
  const merge = (rel, fn) => mergeJson(join(dir, rel), fn, { dryRun, log, label: rel });
  const union = (list, add) => [...list, ...add.filter((x) => !list.includes(x))];

  // Claude Code: teammates who trust the folder are prompted to add these marketplaces and plugins.
  merge('.claude/settings.json', (c) => {
    c.extraKnownMarketplaces ??= {};
    c.enabledPlugins ??= {};
    for (const d of nativeFor('claude-code')) {
      c.extraKnownMarketplaces[d.marketplace] ??= { source: { source: 'github', repo: d.source } };
      c.enabledPlugins[`${d.dep}@${d.marketplace}`] ??= true;
    }
    return c;
  });
  // Pi: project packages (installed on first run in the project) plus the companions the harness needs.
  merge('.pi/settings.json', (c) => {
    c.packages = union(c.packages ?? [], [...nativeFor('pi').map((d) => `git:github.com/${d.source}`), ...PI_COMPANIONS]);
    return c;
  });
  // OpenCode: project opencode.json plugins + MCP.
  const ocShipped = readJson(join(ROOT, '.opencode/opencode.json'));
  merge('opencode.json', (c) => {
    c.$schema ??= ocShipped.$schema;
    c.plugin = union(c.plugin ?? [], nativeFor('opencode').map((d) => `${d.dep}@git+https://github.com/${d.source}`));
    c.mcp = addServers(c.mcp ?? {}, ocShipped.mcp);
    return c;
  });
  // Project MCP: .mcp.json (Claude Code, Pi's adapter, omp), Cursor, Gemini.
  for (const [rel, src] of [['.mcp.json', '.mcp.json'], ['.cursor/mcp.json', '.mcp.json'], ['.gemini/settings.json', '.gemini/settings.json']]) {
    mergeMcp(join(dir, rel), join(ROOT, src), { dryRun, log, label: rel });
  }
  log('Codex and omp have no committable project plugin config: each teammate runs bootstrap.sh (see docs/install.md "Install options").');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--merge-mcp') { // bootstrap.sh: add missing harness MCP servers to an agent's global config
    const [dest, src] = args.slice(1).filter((a) => !a.startsWith('--'));
    mergeMcp(dest, src, { dryRun: args.includes('--dry-run') });
    process.exit(0);
  }
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir || !existsSync(dir) || !lstatSync(dir).isDirectory()) {
    console.error(`--init: not a directory: ${dir ?? '(none)'}`);
    process.exit(2);
  }
  initProject(dir, { dryRun: args.includes('--dry-run'), projectPlugins: args.includes('--project-plugins') });
}
