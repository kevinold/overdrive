# overdrive

A harness starter that assembles the right set of tools — plugins, MCP servers,
model "gears," hooks — to get **more out of every token**. Higher gear, not a bigger budget.

## Per-host support

Full harness (skills, hooks, MCP, gears) on Claude Code, Codex, OpenCode, Pi, and omp; each
host gets it by its own mechanism, with gaps. Cursor and Gemini get this file + the two MCP
servers. What each host gets: `docs/capability-matrix.md`.

## Setup

```bash
git clone git@github.com:kevinold/overdrive.git && cd overdrive
bash scripts/bootstrap.sh                # every agent host found on PATH
bash scripts/bootstrap.sh --agent codex  # or pick hosts: claude-code,codex,opencode,pi,omp
bash scripts/bootstrap.sh --dry-run      # prints every action, changes nothing
bash scripts/bootstrap.sh --check <project>  # preview skills, MCP, and --init on a throwaway copy
bash scripts/bootstrap.sh --init <project>   # overlay the harness onto a project
```

Review `docs/harness-inventory.md` and `docs/install.md` before running bootstrap on a
fresh clone. `bootstrap.sh --dry-run` prints every action without mutating anything.

## Model gears

Three gears, never one model:

- **Driver (worker)** — the everyday model, set per session. Does the typing/building.
- **Overdrive (reasoning)** — a stronger model escalates for plan + brainstorm
  (compound-engineering: `plan_model` / `brainstorm_model`).
- **Peer (second opinion)** — `cross_model_peer`. A *different*, differently-trained model
  adversarially re-reviews. Never trust one model's output.

Each host sets gears its own way: `docs/capability-matrix.md` (Gears per host).

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
