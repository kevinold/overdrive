# Capability matrix

What each agent host gets from overdrive, and how. Full-harness hosts: Claude Code, Codex,
OpenCode, Pi, omp. Cursor and Gemini get `AGENTS.md` + the two MCP servers. Per-dependency
install methods live in `harness/deps.tsv`; install steps in `docs/install.md`.

| Capability | Claude Code | Codex | OpenCode | Pi | omp | Cursor | Gemini |
|---|---|---|---|---|---|---|---|
| Skills | native plugins (every catalog dep + overdrive) | native plugins (compound-engineering, ponytail, overdrive) + pinned `npx skills` | `plugin` array (compound-engineering, ponytail, overdrive) + pinned `npx skills` | `pi install` (compound-engineering, ponytail, overdrive) + pinned `npx skills` | marketplace plugins (A1 pending) | none; `AGENTS.md` only | none; `AGENTS.md` only |
| Subagents | plugin `agents/`; `ui-visual-validator` wrapper defers to the skill | none; `ui-visual-validator` as a skill | none; `ui-visual-validator` as a skill | `pi-subagents` companion; `ui-visual-validator` as a skill | none; `ui-visual-validator` as a skill | none | none |
| Hook context (overdrive) | `hooks/hooks.json` SessionStart | same `hooks/hooks.json`, after one-time `/hooks` trust (not live-verified) | `.opencode/plugins/overdrive.mjs` system-prompt transform (unit-tested only) | `.pi/extensions/overdrive.js` `before_agent_start` (verified) | Pi extension if A2 holds; else `AGENTS.md` | `AGENTS.md` via `.cursor/rules/overdrive.mdc` | `AGENTS.md` via `GEMINI.md` |
| House style: ponytail | native hook | native hook | native plugin hook | native hook | skills; hook pending A2 | `AGENTS.md` text | `AGENTS.md` text |
| House style: caveman | native always-on hook | `/caveman` skills only, no always-on hook | `/caveman` skills only | `/caveman` skills only | `/caveman` skills only | `AGENTS.md` text | `AGENTS.md` text |
| MCP | `claude mcp add --scope user` (verified: Claude reports both Connected) | `codex mcp add` → `~/.codex/config.toml` (verified) | `.opencode/opencode.json` (project); global snippet printed (config verified) | `pi-mcp-adapter` + `~/.pi/agent/mcp.json` (config verified) | `~/.omp/agent/mcp.json` (config verified) | bootstrap writes `~/.cursor/mcp.json` if absent (config verified) | bootstrap writes `~/.gemini/settings.json` if absent (config verified) |
| Gears | CE config + `/model` | `model`, profiles | per-agent `model` | `/model`, `--models` | `modelRoles` | host model picker | host model picker |

Notes:

- **Two freshness models.** Native plugin installs are unpinned and track the marketplace
  HEAD. `skills`-method installs are commit-pinned to the `ref` column of `harness/deps.tsv`.
- **Every catalog dependency reaches every full-harness host.** None is Claude-only today; a
  future `none` cell prints a skip with the row's `note`.
- **Caveman** off-Claude is three pinned skills (`caveman`, `caveman-commit`,
  `caveman-review`). Its always-on hook exists only on Claude Code.
- **agent-browser** off-Claude pins only the `agent-browser` skill and needs the
  `agent-browser` binary on `PATH`.
- **OpenCode may list a skill twice.** `npx skills` keeps a canonical copy in
  `~/.agents/skills/` and links it into each host dir; OpenCode reads both. Harmless.
- **omp fallback** if a marketplace pack is rejected: `npx skills add … -a universal`
  project-scope (`.agents/skills/`). `bootstrap.sh --check <project>` exercises exactly that
  install path (verified against a sample project); omp loading it is still unverified.

## Assumptions

- **A1 — pending.** omp's marketplace flow installs any repo with
  `.claude-plugin/marketplace.json` and loads its `skills/`. omp not installed locally.
- **A2 — pending.** omp fires Pi's `before_agent_start` and honors the returned system prompt.
  Until verified, omp hook context degrades to `AGENTS.md`.
- **A3 — verified.** `pi-mcp-adapter` reads `~/.pi/agent/mcp.json` in the `.mcp.json`
  `mcpServers` shape (its README), and `bootstrap.sh --check` launches both servers from that file.
  "config verified" in the MCP row means `--check` launched every server that agent's config names
  and completed an MCP `initialize` from inside a sample project; the agent itself loading the file
  is verified only for Claude Code.
- **A4 — verified.** Codex accepts overdrive as a marketplace (verified from a local clone; the GitHub source `kevinold/overdrive` is the same manifest): `codex plugin marketplace add <clone>`
  + `codex plugin add overdrive@overdrive` succeed.

## Gears per host

Three gears on every host: **driver** (does the building), **reasoning** (plans and
brainstorms), **peer** (a different model re-reviews). Each host sets them its own way; there
is no unifying config.

### Claude Code

`.compound-engineering/config.yaml` (seeded from `config.example.yaml`):

```yaml
plan_model: fable        # reasoning gear for ce-plan (elevation verified on Claude Code only)
brainstorm_model: fable  # reasoning gear for ce-brainstorm
cross_model_peer: codex  # peer gear — egress, see AGENTS.md
```

Driver: `/model` per session. `~/.claude/settings.json` `model` is the fallback/subagent
default, not the driver.

### Codex

`~/.codex/config.toml`:

```toml
model = "<driver-model>"
model_reasoning_effort = "medium"

[profiles.plan]
model = "<reasoning-model>"
model_reasoning_effort = "high"
```

Switch gear with `codex --profile plan`.

### OpenCode

Per-agent `model` in `opencode.json`, as `provider/model-id`:

```json
{ "agent": { "build": { "model": "<provider>/<driver-model>" },
             "plan":  { "model": "<provider>/<reasoning-model>" } } }
```

### Pi

`/model` switches in session; the chosen model is saved as the default. `--models` sets the
shortlist to cycle through. No per-role config.

### omp

`modelRoles` in omp's config maps roles to models:

```yaml
modelRoles:
  default: <driver-model>
  plan: <reasoning-model>
  slow: <reasoning-model>
  task: <driver-model>
```

### Peer gear (all hosts)

compound-engineering (3.28.2) reads `cross_model_peer` from `.compound-engineering/config.yaml`.
Accepted values: `codex`, `claude`, `grok`, `cursor`, `composer`, `opencode`. Unset, it picks
the first available peer that is not the host, in order `codex → claude → grok → composer`.
`cross_model_review_mode: off` disables the pass. On a non-Claude driver the natural peer is a
different vendor's CLI — on Codex, `claude`. Every peer sends file content to that vendor
(egress disclosure in `AGENTS.md`).
