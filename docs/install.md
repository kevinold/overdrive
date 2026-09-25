# Install

Per-host setup for the overdrive harness. What each host gets: `docs/capability-matrix.md`.
What gets installed, per dependency and host: `harness/deps.tsv`.

## Before you run bootstrap (supply chain)

`scripts/bootstrap.sh` adds third-party plugin marketplaces, skill packages, and MCP servers.
**Review the list before running it on a fresh clone.**

Vetted marketplaces (verified **2026-09-04**):

- `compound-engineering-plugin`, `agent-browser`, `caveman`, `ponytail`

The catalog holds only what the harness uses (plan/build/review/ship/learn, the two house-style
lenses, browser testing). Add a row to `harness/deps.tsv` to bring another pack in.

Off-Claude hosts also pull from the same GitHub sources through `npx -y skills@1.7.0` (pinned
to the `ref` column of `harness/deps.tsv`), and Pi pulls `npm:pi-subagents` and
`npm:pi-mcp-adapter`, and `npm:pi-ask-user`.

Two freshness models: native plugin installs are unpinned and track the marketplace HEAD;
`skills` installs are commit-pinned. Verification is a point-in-time snapshot — re-check the
owners before trusting them on a new machine. There is no lockfile; this is a personal MIT
starter, not a fail-closed supply chain.

### Check the skill installs first

```bash
bash scripts/bootstrap.sh --check ~/code/some-project
```

Copies the project to a temp dir (without `node_modules` / `.git`), points `HOME` at an empty temp
dir, and runs every pinned `npx skills` row at project scope for Claude Code (`.claude/skills`),
the shared `.agents/skills` dir (Codex, OpenCode, omp), and Pi (`.pi/skills`). It then checks
every pinned skill landed with a `SKILL.md`. Then it registers the MCP servers exactly as a real
run would, into the sandboxed `HOME` (Claude Code and Codex when installed, plus Pi's and omp's
`mcp.json`), and launches every server each agent's config names from the project copy, OpenCode's,
Gemini's, and Cursor's shipped configs included, to finish an MCP `initialize`. It exits non-zero
on any miss. Your project and your real `HOME` are not touched; the temp copy's path is printed so
you can inspect it.

### Least-privilege reminder (optional global add-ons)

`aws-mcp` and `claude-in-chrome` are **not** shipped in `.mcp.json`. If you add them
globally: scope AWS to read-only dev credentials, and keep the browser MCP on its default
per-site permission prompts. Grant the minimum the task needs.

## What bootstrap touches

A real run writes to your global host state:

- Claude plugin cache and marketplaces
- `~/.codex/config.toml` (marketplaces, plugins, MCP), `~/.codex/skills`
- `~/.config/opencode/skills`
- `~/.pi/agent/settings.json`, `~/.pi/agent/skills`, `~/.pi/agent/mcp.json`
- omp's plugin cache
- `~/.agents/skills` (`npx skills` canonical copies)
- `.compound-engineering/config.yaml` in the clone, seeded only if absent

## Running bootstrap

```bash
bash scripts/bootstrap.sh                             # every host found on PATH
bash scripts/bootstrap.sh --agent codex,pi            # only these hosts
bash scripts/bootstrap.sh --dry-run --agent omp       # print every action, mutate nothing
```

`--agent` takes a comma list and repeats; ids: `claude-code`, `codex`, `opencode`, `pi`, `omp`.
No flag and no host on `PATH` is an error. A real run needs `node` ≥ 18; a dry run only warns,
and works without the host binaries. Re-running is safe. The run ends with a numbered manual
checklist for the steps a shell cannot take.

Bootstrap installs overdrive itself from GitHub (`kevinold/overdrive`), so the clone can move
or go away afterwards. Working on overdrive itself? Add `--dev` to install from this clone's
path instead.

## Install options

Two parts, three ways to get them:

- **Machine-wide (every project):** `bash scripts/bootstrap.sh` once per machine. It installs the
  plugins, skills, hooks, and MCP servers at user scope on each agent it finds.
- **Project overlay:** `bash scripts/bootstrap.sh --init <project>`, once per project, committed.
  Adds the conventions, gears config, and `docs/solutions/`. See *Use it in a project* below.
- **Project-scoped plugins (optional):** `bash scripts/bootstrap.sh --init <project> --project-plugins`.
  Also records the harness plugins and MCP servers in committable project files, so a teammate's
  agent offers to install them when they open the repo, before they have run bootstrap.

What each agent supports:

| Agent | Machine-wide (`bootstrap.sh`) | Project-scoped, committed (`--project-plugins`) | Project-scoped by hand, per person |
|---|---|---|---|
| Claude Code | `claude plugin install … ` (user scope) + `claude mcp add --scope user` | `.claude/settings.json` (`extraKnownMarketplaces` + `enabledPlugins`; Claude prompts on trust) + `.mcp.json` | `claude plugin install --scope project <plugin>@<marketplace>` |
| Codex | `codex plugin add …` + `codex mcp add` (global `~/.codex/config.toml`) | not supported (Codex plugins are user-scope only) | none; run `bootstrap.sh` |
| OpenCode | prints a `plugin` snippet for `~/.config/opencode/opencode.json` | `opencode.json` at the project root (`plugin` + `mcp`) | edit the project `opencode.json` |
| Pi | `pi install …` (global) + `~/.pi/agent/mcp.json` | `.pi/settings.json` `packages` (Pi installs them when you trust the project) + `.mcp.json` | `pi install -l <source>` |
| omp | `omp plugin install …` (user) + `~/.omp/agent/mcp.json` | `.mcp.json` only; omp's project plugin file is install state, not meant for commits | `omp plugin install --scope project <plugin>@<marketplace>` |
| Cursor | `~/.cursor/mcp.json` when absent | `.cursor/mcp.json` | edit `.cursor/mcp.json` |
| Gemini | `~/.gemini/settings.json` when absent | `.gemini/settings.json` (`mcpServers`) | edit `.gemini/settings.json` |

`--project-plugins` merges into files that already exist. It adds missing entries and never
changes a value the project set; a plugin set to `false` stays disabled. It also ignores Pi's
project package cache (`.pi/npm/`) in `.gitignore`. Skills installed through `npx skills` (the
caveman lens and agent-browser, for Codex, OpenCode, and Pi) stay machine-wide.
`bootstrap.sh --check <project>` previews the overlay with `--project-plugins` on a throwaway
copy.

## Use it in a project

The steps above set up your agents once per machine. The harness also has a small per-project
part: the conventions agents read, the gears config, and the compounding store.
`--init` writes it into a project:

```bash
bash scripts/bootstrap.sh --check ~/code/wait-on    # preview everything on a throwaway copy
bash scripts/bootstrap.sh --init ~/code/wait-on --dry-run
bash scripts/bootstrap.sh --init ~/code/wait-on
```

What it writes (only what is absent; nothing outside the managed block is touched):

- **`AGENTS.md`**: one marked "Overdrive harness" block with the project's verification
  commands, detected from its stack, plus the gears, house style, egress disclosure, and
  compounding loop. Codex, OpenCode, Pi, omp, and Cursor read `AGENTS.md` natively. Rerun `--init`
  to refresh the block after updating overdrive.
- **`CLAUDE.md` / `GEMINI.md`**: `@AGENTS.md` imports, so Claude Code and Gemini read the same
  file. An existing file gets the import appended once; a symlink to `AGENTS.md` is left alone.
- **`.compound-engineering/config.yaml`**: the gears config (`plan_model`, `brainstorm_model`,
  `cross_model_peer`); compound-engineering reads it per project.
- **`docs/solutions/README.md`**: the compounding store `/ce-compound` writes to.
- **`.gitignore`**: `.compound-engineering/config.local.yaml` (per-developer overrides), when a
  `.gitignore` exists.

Detected stacks: `Cargo.toml` → `cargo test`, `cargo clippy --all-targets -- -D warnings`,
`cargo fmt --check`, `cargo build`. `package.json` → the project's own `test` / `lint` /
`typecheck` / `build` scripts under its package manager (npm, pnpm, yarn, bun). TypeScript
(`tsconfig.json` or a `typescript` dependency) without a typecheck script adds
`npx tsc --noEmit`. Anything else gets a note to add the commands below the block.

**New project.** Scaffold it with the language's own tool, then overlay:

```bash
cargo new myapp && bash scripts/bootstrap.sh --init myapp
npm create vite@latest myapp -- --template vanilla-ts && bash scripts/bootstrap.sh --init myapp
```

overdrive keeps no project skeletons of its own. They would go stale, and the language
scaffolders already do that job.

## Claude Code

```bash
bash scripts/bootstrap.sh --agent claude-code
```

Runs `claude plugin marketplace add <owner/repo>` + `claude plugin install <dep>@<marketplace>`
for every dependency in the catalog, then `claude plugin marketplace add kevinold/overdrive` +
`claude plugin install overdrive@overdrive`, and registers both MCP servers at user scope
(`claude mcp add --scope user …`) so every project gets them.

Manual: restart Claude Code.

Uninstall: `claude plugin uninstall overdrive@overdrive`, then
`claude plugin marketplace remove overdrive`.

## Codex

```bash
bash scripts/bootstrap.sh --agent codex
```

Native plugins for compound-engineering, ponytail, and overdrive
(`codex plugin marketplace add kevinold/overdrive` + `codex plugin add overdrive@overdrive`); pinned
`npx skills … -a codex -g -y` for the agent-browser and caveman skills; MCP via
`codex mcp add context7 --url https://mcp.context7.com/mcp` and
`codex mcp add codebase-memory-mcp -- mise exec github:DeusData/codebase-memory-mcp@0.11.0 -- codebase-memory-mcp`. Adding
context7 opens a browser sign-in; finish it and the server is live. The repo
`.codex/config.toml` is reference only.

Manual: set `[features] hooks = true` in `~/.codex/config.toml`, run `/hooks` and trust
overdrive's SessionStart hook, then restart Codex.

Uninstall: `codex plugin remove overdrive@overdrive`, then
`codex plugin marketplace remove overdrive`.

## OpenCode

```bash
bash scripts/bootstrap.sh --agent opencode
```

Installs pinned `npx skills … -a opencode -g -y` packs and prints a snippet instead of editing
your config. Paste it into `~/.config/opencode/opencode.json`:

```json
"plugin": [
  "compound-engineering@git+https://github.com/EveryInc/compound-engineering-plugin",
  "ponytail@git+https://github.com/DietrichGebert/ponytail",
  "overdrive@git+https://github.com/kevinold/overdrive"
]
```

MCP: copy the `mcp` block from `.opencode/opencode.json` into the same global file (inside
the clone it already applies).

Manual: paste the snippet, then restart OpenCode.

Uninstall: delete the overdrive entry from the `plugin` array.

## Pi

```bash
bash scripts/bootstrap.sh --agent pi
```

Runs `pi install git:github.com/<owner/repo>` for compound-engineering and ponytail (Pi has no
marketplaces), `pi install git:github.com/kevinold/overdrive` for overdrive, `pi install npm:pi-subagents`,
`pi install npm:pi-mcp-adapter`, `pi install npm:pi-ask-user` (compound-engineering asks blocking questions through it), and pinned `npx skills … -a pi -g -y` packs. Copies
`.mcp.json` to `~/.pi/agent/mcp.json` only if that file is absent.

Manual: restart pi.

Uninstall: `pi remove git:github.com/kevinold/overdrive` (with `--dev`: `pi remove <clone-path>`) — the same source used to install, not the package name.

## omp

```bash
bash scripts/bootstrap.sh --agent omp
```

Runs `omp plugin marketplace add <owner/repo>` + `omp plugin install <dep>@<marketplace>` for
every dependency with skills, then `omp plugin marketplace add kevinold/overdrive` + `omp plugin install overdrive@overdrive` for overdrive. Not verified on a
real run (Assumptions A1, A2 in `docs/capability-matrix.md`).

Copies `.mcp.json` to `~/.omp/agent/mcp.json` (omp's user MCP config, same `mcpServers` shape)
only if that file is absent. omp also imports servers from `~/.claude.json` and
`~/.codex/config.toml`.

Manual: `omp config set marketplace.autoUpdate auto`, then restart omp.

Uninstall: `omp plugin uninstall overdrive@overdrive` per `omp plugin --help` (unverified).

## Cursor

`.cursor/rules/overdrive.mdc` (frontmatter `alwaysApply`) points Cursor at `AGENTS.md`, which
Cursor also reads natively. When Cursor is present (`cursor` on `PATH` or `~/.cursor/` exists),
bootstrap copies `.mcp.json` to `~/.cursor/mcp.json` so every project gets both MCP servers,
only if that file is absent; otherwise merge its `mcpServers` block by hand. Not verified on a
real Cursor.

## Gemini

`.gemini/settings.json` sets `GEMINI.md` as the context file and declares the two MCP
servers for this clone. When Gemini is present (`gemini` on `PATH` or `~/.gemini/` exists),
bootstrap copies it to `~/.gemini/settings.json` for every project, only if that file is absent;
otherwise merge its `mcpServers` block by hand. `GEMINI.md` points back at `AGENTS.md`. Not
verified on a real Gemini.
