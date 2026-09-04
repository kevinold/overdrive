# Install

Per-agent setup for the overdrive harness. Read `docs/harness-inventory.md` first — it is
the canonical list of what gets installed.

## Before you run bootstrap (supply chain)

`scripts/bootstrap.sh` adds third-party plugin marketplaces and MCP servers. **Review the
list before running it on a fresh clone.**

Vetted marketplaces (verified **2026-09-04**):

- `compound-engineering-plugin`, `compound-writing`
- `claude-code-workflows` (wshobson/agents), `claude-plugins-official`, `claude-code-plugins`
- `agent-browser`, `caveman`, `ponytail`, `pm-claude-skills`

Verification is a point-in-time snapshot — re-check the marketplace owners before trusting
them on a new machine. There is no lockfile; this is a personal MIT starter, not a
fail-closed supply chain.

### Least-privilege reminder (optional global add-ons)

`aws-mcp` and `claude-in-chrome` are **not** shipped in `.mcp.json`. If you add them
globally: scope AWS to read-only dev credentials, and keep the browser MCP on its default
per-site permission prompts. Grant the minimum the task needs.

## Claude Code (full harness)

```bash
bash scripts/bootstrap.sh            # installs the whole harness
bash scripts/bootstrap.sh --dry-run  # print every action, mutate nothing
```

Then paste the printed `/plugin marketplace add` and `/plugin install` lines into Claude
Code. `.mcp.json` and `.claude/settings.json` are picked up automatically.

## Codex

`bootstrap.sh` runs `codex mcp add` to register `context7` + `codebase-memory-mcp` into your
`~/.codex/config.toml` (the repo `.codex/config.toml` is reference only — Codex does not
auto-discover it). You get the MCP servers + AGENTS.md, not the Claude plugins.

## Cursor

`.cursor/rules/overdrive.mdc` (frontmatter `alwaysApply`) points Cursor at `AGENTS.md`.
Cursor also reads root `AGENTS.md` natively. Wire the MCP servers via Cursor's MCP settings
using `.mcp.json` as the reference.

## Gemini

`.gemini/settings.json` sets `GEMINI.md` as the context file and declares the two MCP
servers. `GEMINI.md` points back at `AGENTS.md`.

## OpenCode

`.opencode/opencode.json` loads `AGENTS.md` as instructions and declares the same two MCP
servers.

## Portability boundary

AGENTS.md conventions + the two MCP servers port to any agent above. The plugin / skill /
hook acceleration is **Claude-Code-specific**. Non-Claude agents do not get the full harness.
