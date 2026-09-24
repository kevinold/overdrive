# Harness inventory (canonical)

Verified **2026-09-04**. Review this before running `scripts/bootstrap.sh` on a fresh clone.

## Dependencies

`harness/deps.tsv` is the single source: 18 dependencies across 9 marketplaces, one row each,
with a method per host. GitHub renders it as a table. Three methods:

- **`native`** — the host's own plugin install (Claude/Codex/omp marketplaces, Pi `pi install`,
  OpenCode `plugin` array). Unpinned; tracks the marketplace HEAD.
- **`skills`** — `npx skills add <source>#<ref>` into the host's global skill dir, pinned to the
  row's `ref` commit and limited to the row's `skills` list.
- **`none`** — skipped on that host; the `note` column says why (agents/commands/hooks only).

The seven `claude-code-workflows` packs (wshobson/agents) are the "wshobson packs."

### What bootstrap installs

Per selected host (`--agent`, or every host on `PATH`): each dependency by its method in
`harness/deps.tsv`, overdrive itself, the 2 MCP servers by that host's config path, Pi's
`pi-subagents` + `pi-mcp-adapter`, `mise install`, and `.compound-engineering/config.yaml` if
absent. Hosts differ; `docs/capability-matrix.md` has the per-host view. Run
`bootstrap.sh --dry-run` to see every action first.

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

These are compound-engineering keys. How each host sets its driver, reasoning, and peer
models: `docs/capability-matrix.md` (Gears per host).
