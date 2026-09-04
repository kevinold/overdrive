#!/usr/bin/env bash
# overdrive bootstrap — idempotent. Default installs the lean core; --with-extras adds opt-ins.
# --dry-run prints every action without mutating anything.
set -euo pipefail

WITH_EXTRAS=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --with-extras) WITH_EXTRAS=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) echo "usage: bootstrap.sh [--with-extras] [--dry-run]"; exit 0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
run() { if [ "$DRY_RUN" = 1 ]; then echo "DRY-RUN: $*"; else "$@"; fi; }

# Claude plugins — printed for you to paste into Claude Code (core = compound-engineering).
echo "== Claude plugins (run these in Claude Code) =="
echo "/plugin marketplace add EveryInc/compound-engineering-plugin"
echo "/plugin install compound-engineering@compound-engineering-plugin"
if [ "$WITH_EXTRAS" = 1 ]; then
  echo "-- extras (beyond-SDLC) --"
  echo "/plugin marketplace add wshobson/agents  # then install: javascript-typescript python-development backend-development cloud-infrastructure debugging-toolkit developer-essentials multi-platform-apps @claude-code-workflows"
  echo "/plugin marketplace add mohitagw15856/pm-claude-skills"
  echo "/plugin install pm-rituals@pm-claude-skills"
  echo "/plugin marketplace add anthropics/claude-plugins-official"
  echo "/plugin install frontend-design@claude-plugins-official"
  echo "/plugin install ralph-loop@claude-plugins-official"
  echo "/plugin marketplace add anthropics/claude-code"
  echo "/plugin install ralph-wiggum@claude-code-plugins"
  echo "(full list + marketplaces: docs/harness-inventory.md)"
fi

# Codex: register the shipped MCP servers into ~/.codex/config.toml (repo .codex is NOT auto-discovered).
if command -v codex >/dev/null 2>&1; then
  echo "== Registering MCP servers with Codex =="
  run codex mcp add context7 -- npx -y mcp-remote https://mcp.context7.com/mcp
  run codex mcp add codebase-memory-mcp -- mise exec -- codebase-memory-mcp
else
  echo "codex not found — skipping codex mcp add (install codex to wire the peer)"
fi

# mise: install pinned tools (codebase-memory-mcp etc.).
if command -v mise >/dev/null 2>&1; then
  echo "== mise install =="
  run mise install
else
  echo "mise not found — install mise (https://mise.jdx.dev) then rerun" >&2
fi

# Seed config.yaml from the example ONLY if absent (preserve edits on rerun).
CFG="$ROOT/.compound-engineering/config.yaml"
if [ -f "$CFG" ]; then
  echo "config.yaml exists — leaving your gears untouched"
else
  echo "seeding config.yaml from config.example.yaml"
  run cp "$ROOT/.compound-engineering/config.example.yaml" "$CFG"
fi

echo "== Next steps =="
echo "1. Review docs/install.md + docs/harness-inventory.md before trusting any marketplace."
echo "2. Edit .compound-engineering/config.yaml gears (note the cross_model_peer egress disclosure in AGENTS.md)."
echo "3. Paste the /plugin lines above into Claude Code."
