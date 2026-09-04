# overdrive

**A harness that assembles the right set of tools to get more out of every token.**
Higher gear — more out of every token. Not a bigger budget; a better-used one.

overdrive is a clonable *starter* repo. It wires up the plugins, MCP servers, model "gears,"
and hooks that make an AI coding agent spend more of each session on **outcomes** and less on
overhead — a worker model drives, context is cached and reused, subagents stay isolated, and
knowledge compounds across sessions.

## Portability boundary (honest scope)

- **Ports to any coding agent:** the `AGENTS.md` context contract + the two MCP servers
  (`context7`, `codebase-memory-mcp`).
- **Claude-Code-specific:** the plugin / skill / hook acceleration — the gears flow, the
  SDLC commands (`ce-plan`, `ce-work`, `ce-code-review`, `/ce-compound`), the hooks.

Codex / Cursor / Gemini / OpenCode get AGENTS.md + the MCP servers. They do **not** get the
full harness. This README does not claim parity.

## Install

```bash
git clone git@github.com:kevinold/overdrive.git && cd overdrive
bash scripts/bootstrap.sh                 # lean core: compound-engineering + 2 MCP + gears + validation
bash scripts/bootstrap.sh --with-extras   # + opt-in plugins (wshobson packs, pm-rituals, frontend-design, ralph-*)
bash scripts/bootstrap.sh --dry-run       # print every action, mutate nothing
```

Review `docs/install.md` and `docs/harness-inventory.md` before running bootstrap on a fresh
clone — it adds third-party marketplaces and MCP servers.

## Model gears

| Gear | Model | Role |
|---|---|---|
| Driver (worker) | Opus 4.8 / Sonnet | Does the typing/building; set per session |
| Overdrive (reasoning) | Fable | Escalates for plan + brainstorm (`plan_model`, `brainstorm_model`) |
| Peer (second opinion) | codex | A *different* model adversarially re-reviews (`cross_model_peer`) |

Configure in `.compound-engineering/config.yaml`.

## Egress disclosure

`cross_model_peer: codex` **sends full file/document content to a separate third-party model**
(codex / OpenAI). It runs on a separate subscription — a second opinion, not free tokens, and
not covered by your Claude budget. Enable it as a **reviewed, opt-in** decision against your
repo's data sensitivity, **not** a default. Unset `cross_model_peer` to keep code on your
Claude provider. Details in `AGENTS.md` and `.compound-engineering/config.example.yaml`.

## Per-agent setup

- **Claude Code** — `bootstrap.sh` + paste the printed `/plugin` lines. Full harness.
- **Codex** — `bootstrap.sh` runs `codex mcp add` into `~/.codex/config.toml`. MCP + AGENTS.md.
- **Cursor** — `.cursor/rules/overdrive.mdc` + native root `AGENTS.md`. MCP + AGENTS.md.
- **Gemini** — `.gemini/settings.json` + `GEMINI.md`. MCP + AGENTS.md.
- **OpenCode** — `.opencode/opencode.json`. MCP + AGENTS.md.

Full walkthrough: `docs/install.md`.

## SDLC, accelerated

The harness accelerates the software lifecycle you already run — it does not skip it.

| Phase | Tools |
|---|---|
| Plan | ce-plan (Fable), ce-brainstorm, ce-doc-review |
| Build | ce-work, lfg, subagents/fork, context7, codebase-memory-mcp |
| Test | Vitest + Cypress TDD, agent-browser, ui-visual-validator, frozen-clock |
| Review | ce-code-review, cross-model peer (codex), caveman/ponytail lenses |
| Ship | ce-commit-push-pr, ce-babysit-pr |
| Learn | /ce-compound → `docs/solutions/`, file-memory |

## Compounding

Every non-trivial fix becomes a doc the next session reads. `/ce-compound` writes to
`docs/solutions/`; file-memory + those docs seed the next cycle. The harness gets more
effective the longer you use it. See `docs/solutions/README.md`.

## License

MIT — see `LICENSE`.
