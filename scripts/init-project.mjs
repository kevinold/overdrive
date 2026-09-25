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

const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };

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
    `This project uses the [overdrive](${REPO_URL}) harness. Install or update the agent side (plugins, skills, hooks, MCP) from an overdrive clone with \`bash scripts/bootstrap.sh\`; what each agent gets: [capability matrix](${REPO_URL}/blob/main/docs/capability-matrix.md).`,
    '',
    '### Project commands',
    '',
    commands,
    '',
    ...found.map(demote).flatMap((s) => [s, '']),
    END,
  ].join('\n');
}

export function initProject(dir, { dryRun = false, log = console.log } = {}) {
  const act = (verb, rel, write) => {
    log(`${dryRun ? 'DRY-RUN: ' : ''}${verb} ${rel}`);
    if (!dryRun) write();
  };
  const put = (rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };

  // AGENTS.md: the managed block (Codex, OpenCode, Pi, omp, and Cursor read AGENTS.md natively).
  const agents = join(dir, 'AGENTS.md');
  const block = harnessBlock(dir);
  if (!existsSync(agents)) act('create', 'AGENTS.md', () => put('AGENTS.md', `${block}\n`));
  else {
    const cur = readFileSync(agents, 'utf8');
    const next = BLOCK_RE.test(cur) ? cur.replace(BLOCK_RE, block) : `${cur.replace(/\s*$/, '')}\n\n${block}\n`;
    if (next === cur) log('unchanged AGENTS.md (overdrive block current)');
    else act('update', 'AGENTS.md (overdrive block)', () => writeFileSync(agents, next));
  }

  // Claude Code reads CLAUDE.md and Gemini reads GEMINI.md; both import AGENTS.md with `@AGENTS.md`.
  for (const f of ['CLAUDE.md', 'GEMINI.md']) {
    const p = join(dir, f);
    if (!existsSync(p)) act('create', `${f} (@AGENTS.md)`, () => put(f, '@AGENTS.md\n'));
    else if (lstatSync(p).isSymbolicLink() || /@AGENTS\.md/.test(readFileSync(p, 'utf8'))) log(`unchanged ${f} (already reads AGENTS.md)`);
    else act('update', `${f} (append @AGENTS.md)`, () => writeFileSync(p, `${readFileSync(p, 'utf8').replace(/\s*$/, '')}\n\n@AGENTS.md\n`));
  }

  // Gears config (compound-engineering reads it per repo) and the compounding store.
  for (const [rel, src] of [['.compound-engineering/config.yaml', '.compound-engineering/config.example.yaml'], ['docs/solutions/README.md', 'docs/solutions/README.md']]) {
    if (existsSync(join(dir, rel))) log(`unchanged ${rel} (exists)`);
    else act('create', rel, () => put(rel, readFileSync(join(ROOT, src), 'utf8')));
  }

  // Keep per-developer gear overrides out of git.
  const gi = join(dir, '.gitignore');
  if (existsSync(gi) && !/config\.local\.yaml/.test(readFileSync(gi, 'utf8'))) {
    act('update', '.gitignore (.compound-engineering/config.local.yaml)', () =>
      writeFileSync(gi, `${readFileSync(gi, 'utf8').replace(/\s*$/, '')}\n.compound-engineering/config.local.yaml\n`));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir || !existsSync(dir) || !lstatSync(dir).isDirectory()) {
    console.error(`--init: not a directory: ${dir ?? '(none)'}`);
    process.exit(2);
  }
  initProject(dir, { dryRun: args.includes('--dry-run') });
}
