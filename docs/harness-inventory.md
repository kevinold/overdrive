# Harness inventory (canonical)

Verified **2026-09-04**. This is the single source the rest of the build reads —
`bootstrap.sh`, `README.md`, and `docs/install.md` all reference these exact names.
Review this list before running `scripts/bootstrap.sh` on a fresh clone.

## Plugins — 18 enabled across 11 registered marketplaces

Install form: `/plugin marketplace add <owner/repo>` then
`/plugin install <plugin>@<marketplace>`.

| Plugin | Marketplace |
|---|---|
| compound-engineering | compound-engineering-plugin |
| compound-writing | compound-writing |
| javascript-typescript | claude-code-workflows (wshobson/agents) |
| python-development | claude-code-workflows (wshobson/agents) |
| backend-development | claude-code-workflows (wshobson/agents) |
| cloud-infrastructure | claude-code-workflows (wshobson/agents) |
| debugging-toolkit | claude-code-workflows (wshobson/agents) |
| developer-essentials | claude-code-workflows (wshobson/agents) |
| multi-platform-apps | claude-code-workflows (wshobson/agents) |
| typescript-lsp | claude-plugins-official |
| frontend-design | claude-plugins-official |
| skill-creator | claude-plugins-official |
| ralph-loop | claude-plugins-official |
| agent-browser | agent-browser |
| ralph-wiggum | claude-code-plugins |
| caveman | caveman |
| ponytail | ponytail |
| pm-rituals | pm-claude-skills |

The seven `claude-code-workflows` packs (wshobson/agents) are the "wshobson packs."

### Core vs. extras (D5)

`bootstrap.sh` defaults to a **lean core** and gates the rest behind `--with-extras`.

- **Core (default):** compound-engineering + the 2 MCP servers + the model gears +
  the validation layer (`.claude/agents/ui-visual-validator.md`).
- **Extras (`--with-extras`):** the wshobson `claude-code-workflows` packs, pm-rituals,
  frontend-design, ralph-loop, ralph-wiggum, caveman, ponytail, agent-browser,
  typescript-lsp, skill-creator, compound-writing — "beyond-SDLC extras."

## MCP servers

**Shipped in `.mcp.json`:**

| Name | Transport | Endpoint |
|---|---|---|
| context7 | http | `https://mcp.context7.com/mcp` |
| codebase-memory-mcp | stdio | `mise exec -- codebase-memory-mcp` |

**Optional global add-ons (documented, not shipped):** aws-mcp, claude-in-chrome.
See `docs/install.md` for the least-privilege reminder before enabling these.

## mise pins

Required — `mise exec -- codebase-memory-mcp` fails on a fresh clone without the pin.

| Tool | Version |
|---|---|
| `github:DeusData/codebase-memory-mcp` | `0.10.8` |
| act, actionlint, gh, jq, aws | latest (dev convenience) |

## Config gears (`.compound-engineering/config.yaml`)

| Key | Value | Role |
|---|---|---|
| `plan_model` | `fable` | Reasoning model authors plans (ce-plan escalation) |
| `brainstorm_model` | `fable` | Reasoning model for ce-brainstorm |
| `cross_model_peer` | `codex` | Second-opinion peer — **sends full file content to a third-party model** (opt-in; see egress disclosure in AGENTS.md) |

`~/.claude/settings.json` `model` (e.g. `fable[1m]`) is the fallback/subagent default,
**not** the driver. The driver (worker) model is Opus/Sonnet, set per session.
