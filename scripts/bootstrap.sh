#!/usr/bin/env bash
# overdrive bootstrap — idempotent. Installs the whole harness.
# --dry-run prints every action without mutating anything.
set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) echo "usage: bootstrap.sh [--dry-run]"; exit 0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
run() { if [ "$DRY_RUN" = 1 ]; then echo "DRY-RUN: $*"; else "$@"; fi; }

# Claude plugins. Plugins install via slash commands inside Claude Code, not the shell,
# so bootstrap prints the full set for you to paste in. This is the whole harness.
echo "== Claude plugins (paste into Claude Code) =="
cat <<'PLUGINS'
/plugin marketplace add EveryInc/compound-engineering-plugin
/plugin install compound-engineering@compound-engineering-plugin
/plugin marketplace add EveryInc/compound-writing
/plugin install compound-writing@compound-writing
/plugin marketplace add wshobson/agents
/plugin install javascript-typescript@claude-code-workflows
/plugin install python-development@claude-code-workflows
/plugin install backend-development@claude-code-workflows
/plugin install cloud-infrastructure@claude-code-workflows
/plugin install debugging-toolkit@claude-code-workflows
/plugin install developer-essentials@claude-code-workflows
/plugin install multi-platform-apps@claude-code-workflows
/plugin marketplace add anthropics/claude-plugins-official
/plugin install typescript-lsp@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install skill-creator@claude-plugins-official
/plugin install ralph-loop@claude-plugins-official
/plugin marketplace add vercel-labs/agent-browser
/plugin install agent-browser@agent-browser
/plugin marketplace add anthropics/claude-code
/plugin install ralph-wiggum@claude-code-plugins
/plugin marketplace add JuliusBrussee/caveman
/plugin install caveman@caveman
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
/plugin marketplace add mohitagw15856/pm-claude-skills
/plugin install pm-rituals@pm-claude-skills
PLUGINS

# Codex: register the shipped MCP servers into ~/.codex/config.toml (repo .codex is NOT auto-discovered).
if command -v codex >/dev/null 2>&1; then
  echo "== Registering MCP servers with Codex =="
  run codex mcp add context7 -- npx -y mcp-remote https://mcp.context7.com/mcp
  run codex mcp add codebase-memory-mcp -- mise exec -- codebase-memory-mcp
else
  echo "codex not found. Skipping codex mcp add. Install codex to wire the peer."
fi

# mise: install pinned tools (codebase-memory-mcp etc.).
if command -v mise >/dev/null 2>&1; then
  echo "== mise install =="
  run mise install
else
  echo "mise not found. Install mise (https://mise.jdx.dev) then rerun." >&2
fi

# Seed config.yaml from the example ONLY if absent (preserve edits on rerun).
CFG="$ROOT/.compound-engineering/config.yaml"
if [ -f "$CFG" ]; then
  echo "config.yaml exists. Leaving your gears untouched."
else
  echo "seeding config.yaml from config.example.yaml"
  run cp "$ROOT/.compound-engineering/config.example.yaml" "$CFG"
fi

echo "== Next steps =="
echo "1. Review docs/install.md + docs/harness-inventory.md before trusting any marketplace."
echo "2. Edit .compound-engineering/config.yaml (note the cross_model_peer egress disclosure in AGENTS.md)."
echo "3. Paste the /plugin lines above into Claude Code."
