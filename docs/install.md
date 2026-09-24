# Install

Per-host setup for the overdrive harness. What each host gets: `docs/capability-matrix.md`.
What gets installed, per dependency and host: `harness/deps.tsv`.

## Before you run bootstrap (supply chain)

`scripts/bootstrap.sh` adds third-party plugin marketplaces, skill packages, and MCP servers.
**Review the list before running it on a fresh clone.**

Vetted marketplaces (verified **2026-09-04**):

- `compound-engineering-plugin`, `claude-plugins-official`, `claude-code-plugins`
- `agent-browser`, `caveman`, `ponytail`

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

Bootstrap installs overdrive itself from the clone's absolute path, so keep the clone where it
is.

## Claude Code

```bash
bash scripts/bootstrap.sh --agent claude-code
```

Runs `claude plugin marketplace add <owner/repo>` + `claude plugin install <dep>@<marketplace>`
for every dependency in the catalog, then `claude plugin marketplace add <clone>` +
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
(`codex plugin marketplace add <clone>` + `codex plugin add overdrive@overdrive`); pinned
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
  "<clone>/.opencode/plugins/overdrive.mjs"
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
marketplaces), `pi install <clone>` for overdrive, `pi install npm:pi-subagents`,
`pi install npm:pi-mcp-adapter`, `pi install npm:pi-ask-user` (compound-engineering asks blocking questions through it), and pinned `npx skills … -a pi -g -y` packs. Copies
`.mcp.json` to `~/.pi/agent/mcp.json` only if that file is absent.

Manual: restart pi.

Uninstall: `pi remove <clone-path>` — the same source used to install, not the package name.

## omp

```bash
bash scripts/bootstrap.sh --agent omp
```

Runs `omp plugin marketplace add <owner/repo>` + `omp plugin install <dep>@<marketplace>` for
every dependency with skills, then `omp plugin link <clone>` for overdrive. Not verified on a
real run (Assumptions A1, A2 in `docs/capability-matrix.md`).

Copies `.mcp.json` to `~/.omp/agent/mcp.json` (omp's user MCP config, same `mcpServers` shape)
only if that file is absent. omp also imports servers from `~/.claude.json` and
`~/.codex/config.toml`.

Manual: `omp config set marketplace.autoUpdate auto`, then restart omp.

Uninstall: reverse `omp plugin link` per `omp plugin --help` (unverified).

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
