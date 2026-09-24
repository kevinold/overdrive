# overdrive

**A harness that assembles the right set of tools to get more out of every token.**
Higher gear — more out of every token. Not a bigger budget; a better-used one.

overdrive is a clonable *starter* repo. It wires up the plugins, MCP servers, model "gears,"
and hooks that make an AI coding agent spend more of each session on **outcomes** and less on
overhead — a worker model drives, context is cached and reused, subagents stay isolated, and
knowledge compounds across sessions.

## Install

```bash
git clone git@github.com:kevinold/overdrive.git && cd overdrive
bash scripts/bootstrap.sh                 # every agent host found on PATH
bash scripts/bootstrap.sh --agent codex   # or pick hosts: claude-code,codex,opencode,pi,omp
bash scripts/bootstrap.sh --dry-run       # print every action, mutate nothing
bash scripts/bootstrap.sh --check ~/code/app  # try the pinned skill installs in a throwaway copy
```

Review `docs/install.md` and `docs/harness-inventory.md` before running bootstrap on a fresh
clone — it adds third-party marketplaces and MCP servers.

## Model gears

| Gear | Model | Role |
|---|---|---|
| Driver (worker) | Opus 4.8 / Sonnet | Does the typing/building; set per session |
| Overdrive (reasoning) | Fable | Escalates for plan + brainstorm (`plan_model`, `brainstorm_model`) |
| Peer (second opinion) | codex | A *different* model adversarially re-reviews (`cross_model_peer`) |

Claude Code: `.compound-engineering/config.yaml`. Other hosts: `docs/capability-matrix.md`.

## Egress disclosure

`cross_model_peer: codex` **sends full file/document content to a separate third-party model**
(codex / OpenAI). It runs on a separate subscription — a second opinion, not free tokens, and
not covered by your Claude budget. Enable it as a **reviewed, opt-in** decision against your
repo's data sensitivity, **not** a default. Unset `cross_model_peer` to keep code on your
Claude provider. Details in `AGENTS.md` and `.compound-engineering/config.example.yaml`.

## Per-host support

| Host | Gets |
|---|---|
| Claude Code | Full harness: plugins, skills, subagents, hooks, MCP |
| Codex | Plugins + pinned skills, hook after one-time `/hooks` trust, MCP |
| OpenCode | Plugins (pasted snippet) + pinned skills, plugin hook, MCP |
| Pi | Packages + pinned skills, extension hook, `pi-subagents`, MCP adapter |
| omp | Marketplace plugins; hook and install unverified (A1, A2) |
| Cursor, Gemini | `AGENTS.md` + the two MCP servers |

Full matrix: [`docs/capability-matrix.md`](docs/capability-matrix.md). Walkthrough: `docs/install.md`.

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
