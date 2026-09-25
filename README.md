# overdrive

**A harness that assembles the right set of tools to get more out of every token.**
Higher gear — more out of every token. Not a bigger budget; a better-used one.

overdrive is a clonable *starter* repo. It wires up the plugins, MCP servers, model "gears,"
and hooks that make an AI coding agent spend more of each session on **outcomes** and less on
overhead — a worker model drives, context is cached and reused, subagents stay isolated, and
knowledge compounds across sessions.

## Install

No clone needed. npx fetches the repo and runs `scripts/bootstrap.sh` with your flags:

```bash
npx -y github:kevinold/overdrive                 # every agent host found on PATH
npx -y github:kevinold/overdrive --agent codex   # or pick hosts: claude-code,codex,opencode,pi,omp
npx -y github:kevinold/overdrive --dry-run       # print every action, mutate nothing
npx -y github:kevinold/overdrive --check .       # preview skills, MCP, and --init on a throwaway copy
npx -y github:kevinold/overdrive --init .        # overlay the harness onto the project you're in
```

Prefer a clone? `git clone git@github.com:kevinold/overdrive.git` and run
`bash scripts/bootstrap.sh` with the same flags. Pin a version with `github:kevinold/overdrive#<tag-or-sha>`.

The first run sets up your agents, once per machine. `--init` then adds the harness to each
project. It works on an existing repo, and on a new one right after `cargo new` or `npm create`.
Add `--project-plugins` to also record the plugins and MCP servers in the repo's own config, so
teammates' agents offer to install them when they open it. See
[Install options](docs/install.md#install-options) for what each agent supports, and
[Use it in a project](docs/install.md#use-it-in-a-project).

### How overdrive installs itself

overdrive is a plugin too, published from this GitHub repo. Bootstrap points each agent's own
plugin manager at `kevinold/overdrive`. The agent then fetches the repo into its plugin cache
and reads the manifest meant for it:

| Agent | Command bootstrap runs | Manifest it reads |
|---|---|---|
| Claude Code | `claude plugin marketplace add kevinold/overdrive` + `claude plugin install overdrive@overdrive` | `.claude-plugin/` |
| Codex | `codex plugin marketplace add kevinold/overdrive` + `codex plugin add overdrive@overdrive` | `.agents/plugins/marketplace.json` + `.codex-plugin/` |
| OpenCode | prints `"overdrive@git+https://github.com/kevinold/overdrive"` for its `plugin` array | `package.json` `main` |
| Pi | `pi install git:github.com/kevinold/overdrive` | `package.json` `pi` |
| omp | `omp plugin marketplace add kevinold/overdrive` + `omp plugin install overdrive@overdrive` | `.omp-plugin/marketplace.json` |

Every manifest points at the same `skills/`, `agents/`, and `hooks/`. The npx copy (or your
clone) is only the installer; nothing depends on it after bootstrap. Update overdrive with each agent's own
update command (e.g. `claude plugin update overdrive@overdrive`, `omp plugin upgrade
overdrive@overdrive`), or rerun bootstrap. Working on overdrive itself? `--dev` installs from
your clone's path instead, so local edits take effect.

Review `docs/install.md` and `docs/harness-inventory.md` before running bootstrap — it adds
third-party marketplaces and MCP servers. `--dry-run` shows every action first.

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

## Built on

overdrive assembles other people's work. The harness is theirs; overdrive wires it together.

- **[Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin)** (Every):
  the core of the harness. `ce-plan`, `ce-work`, `ce-code-review`, `ce-commit-push-pr`,
  `ce-babysit-pr`, `/ce-compound`, `lfg`, and the rest of the plan → build → review → ship →
  learn loop. It already ships a native plugin for every agent overdrive targets.
- **[caveman](https://github.com/JuliusBrussee/caveman)**: terse-output house style, plus the
  commit and review lenses.
- **[ponytail](https://github.com/DietrichGebert/ponytail)**: least-code house style: reuse
  before adding, question whether it needs to exist.
- **[agent-browser](https://github.com/vercel-labs/agent-browser)**: browser automation for
  testing UI changes.
- **MCP servers:** [context7](https://github.com/upstash/context7) (current library docs) and
  [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) (code graph).
- **Plumbing:** [`npx skills`](https://github.com/vercel-labs/skills) installs pinned skills
  across agents; Pi uses [pi-subagents](https://www.npmjs.com/package/pi-subagents),
  [pi-mcp-adapter](https://www.npmjs.com/package/pi-mcp-adapter), and
  [pi-ask-user](https://www.npmjs.com/package/pi-ask-user); [mise](https://mise.jdx.dev) pins
  the CLI tools.

## License

MIT — see `LICENSE`.
