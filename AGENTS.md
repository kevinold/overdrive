# overdrive

A harness starter that assembles the right set of tools — plugins, MCP servers,
model "gears," hooks — to get **more out of every token**. Higher gear, not a bigger budget.

## Portability boundary (read this first)

**What ports to any coding agent:** these AGENTS.md conventions and the two MCP servers
(`context7`, `codebase-memory-mcp`). Any agent that reads `AGENTS.md` and speaks MCP gets
the context contract and the memory layer.

**What is Claude-Code-specific:** the plugin / skill / hook acceleration. The gears table,
the SDLC command flow (`ce-plan`, `ce-work`, `ce-code-review`, `/ce-compound`), and the
hook automation run under Claude Code. Codex / Cursor / Gemini / OpenCode get AGENTS.md +
the MCP servers — **not** the full harness. Do not assume parity.

## Setup

```bash
git clone git@github.com:kevinold/overdrive.git && cd overdrive
bash scripts/bootstrap.sh            # installs the whole harness
bash scripts/bootstrap.sh --dry-run  # prints every action, changes nothing
```

Review `docs/harness-inventory.md` and `docs/install.md` before running bootstrap on a
fresh clone. `bootstrap.sh --dry-run` prints every action without mutating anything.

## Model gears

Three gears, never one model:

- **Driver (worker)** — Opus 4.8 or Sonnet, set per session. Does the typing/building.
- **Overdrive (reasoning)** — Fable escalates for plan + brainstorm via `plan_model: fable`
  / `brainstorm_model: fable` in `.compound-engineering/config.yaml`.
- **Peer (second opinion)** — `cross_model_peer: codex`. A *different*, differently-trained
  model adversarially re-reviews. Never trust one model's output.

`~/.claude/settings.json` `model` is the fallback/subagent default, not the driver.

## House style

Two behavior plugins run by default. They set how the agent works, not what it builds.

- **ponytail**: build the least code that works. Reuse before you add. Question whether a piece needs to exist.
- **caveman**: keep output terse. Signal, not filler.

Toggle per session: `/ponytail lite|full|ultra`, `/caveman lite|full|ultra`. Turn off with `stop ponytail` or `stop caveman`.

## Egress disclosure (important)

`cross_model_peer: codex` **sends full file/document content to a separate third-party
model** (codex / OpenAI). It runs on a *separate* subscription — it buys a second opinion,
not free tokens, and it is not covered by your Claude budget.

Enable it as a **reviewed, opt-in** decision weighed against your repo's data sensitivity —
**not** a default. If your code must not leave your Claude provider, leave `cross_model_peer`
unset. See `.compound-engineering/config.example.yaml`.

## The compounding loop

Knowledge compounds instead of being rediscovered:

1. Solve a non-trivial problem during a session.
2. Run `/ce-compound` — it writes the learning to `docs/solutions/`.
3. File-memory + `docs/solutions/` are read by the next session, so the next cycle starts
   from the fix instead of rediscovering it.

Three memory layers under everything: prompt cache (reuse, not re-send) ·
`codebase-memory-mcp` (code graph) · file-memory + `docs/solutions/` (durable knowledge).

## Why these tools (SDLC, accelerated)

Every piece maps to an SDLC phase — the harness accelerates the discipline you already run,
it does not skip it.

| Phase | Tools | Gear |
|---|---|---|
| Plan | ce-plan, ce-brainstorm, ce-doc-review | Fable (reasoning) |
| Build | ce-work, lfg, subagents/fork, context7, codebase-memory-mcp | Opus/Sonnet (driver) |
| Test | Vitest + Cypress TDD, agent-browser, ui-visual-validator, frozen-clock | driver |
| Review | ce-code-review, cross-model peer (codex), caveman/ponytail lenses | Peer (codex) |
| Ship | ce-commit-push-pr, ce-babysit-pr | driver |
| Learn | /ce-compound → docs/solutions/, file-memory | — |

Full inventory: `docs/harness-inventory.md`.
