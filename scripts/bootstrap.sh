#!/usr/bin/env bash
# overdrive bootstrap — idempotent. Installs the harness on every selected agent host
# from harness/deps.tsv. --dry-run prints every action without mutating anything.
# Bash 3.2 compatible (macOS /bin/bash): no associative arrays.
# shellcheck disable=SC2329 # catalog callbacks are invoked indirectly via each_row
set -uo pipefail # no -e: the tolerant runner decides what a failure means

VALID="claude-code codex opencode pi omp"
# Agents launch the pinned tool explicitly so it resolves from any project, not only this clone.
CBM_TOOL="github:DeusData/codebase-memory-mcp@0.11.0" # keep in sync with mise.toml (tests/mcp-probe.test.js)
CONTEXT7_URL="https://mcp.context7.com/mcp"
OVERDRIVE_REPO="kevinold/overdrive" # overdrive installs itself from GitHub, so the clone can move or go away
usage() { echo "usage: bootstrap.sh [--dry-run] [--dev] [--agent <id>[,<id>]]... | --init <project-dir> | --check <project-dir>  ids: $VALID"; }

DRY_RUN=0
REQ=""
CHECK=""
INIT=""
DEV=0 # --dev: install overdrive itself from this clone instead of GitHub (for working on overdrive)
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --agent) [ $# -ge 2 ] || { usage >&2; exit 2; }; REQ="$REQ ${2//,/ }"; shift ;;
    --agent=*) v="${1#--agent=}"; REQ="$REQ ${v//,/ }" ;;
    --check) [ $# -ge 2 ] || { usage >&2; exit 2; }; CHECK="$2"; shift ;;
    --check=*) CHECK="${1#--check=}" ;;
    --init) [ $# -ge 2 ] || { usage >&2; exit 2; }; INIT="$2"; shift ;;
    --init=*) INIT="${1#--init=}" ;;
    --dev) DEV=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown flag: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

ROOT="$(cd "${BASH_SOURCE[0]%/*}/.." && pwd)"
cd "$ROOT" || exit 1
RC=0
FAILS=()

# Tolerant runner: never aborts. Already-installed/exists output on non-zero is benign.
run() {
  if [ "$DRY_RUN" = 1 ]; then echo "DRY-RUN: $*"; return 0; fi
  echo "+ $*"
  local out code
  out="$("$@" </dev/null 2>&1)"; code=$? # </dev/null: installers must not eat the catalog loop's stdin
  [ -n "$out" ] && printf '%s\n' "$out"
  [ "$code" = 0 ] && return 0
  if printf '%s' "$out" | grep -qiE 'already (installed|exists|added|configured|present)|is already'; then
    echo "  (already present, fine)"
  else
    FAILS+=("$* (exit $code)"); RC=1
  fi
}

# MCP wiring, shared by the real run and --check. User scope, so every project gets the servers.
mcp_claude() {
  run claude mcp add --scope user --transport http context7 "$CONTEXT7_URL"
  run claude mcp add --scope user codebase-memory-mcp -- mise exec "$CBM_TOOL" -- codebase-memory-mcp
}
mcp_codex_stdio() { run codex mcp add codebase-memory-mcp -- mise exec "$CBM_TOOL" -- codebase-memory-mcp; }
mcp_copy() { # dest: install .mcp.json there only if absent (Pi and omp read the same mcpServers shape)
  if [ -f "$1" ]; then echo "$1 exists. Leaving it untouched."; else run mkdir -p "${1%/*}"; run cp "$ROOT/.mcp.json" "$1"; fi
}

bin_of() { if [ "$1" = claude-code ]; then echo claude; else echo "$1"; fi; }
has() { command -v "$1" >/dev/null 2>&1; }
warn() { echo "warning: $*" >&2; }

# --init <project>: overlay the project-level harness pieces (managed AGENTS.md block, CLAUDE.md /
# GEMINI.md imports, gears config, docs/solutions). Only writes what is absent; reruns refresh the block.
if [ -n "$INIT" ]; then
  [ -d "$INIT" ] || { echo "--init: not a directory: $INIT" >&2; exit 2; }
  if [ "$DRY_RUN" = 1 ]; then node "$ROOT/scripts/init-project.mjs" "$INIT" --dry-run; else node "$ROOT/scripts/init-project.mjs" "$INIT"; fi
  exit $?
fi

# --check <project>: install every skills row into a throwaway copy of <project> (project scope,
# sandboxed HOME) for Claude Code, the shared .agents/skills dir (Codex, OpenCode, omp), and Pi,
# then verify each pinned skill landed. Touches neither <project> nor your real HOME.
if [ -n "$CHECK" ]; then
  [ -d "$CHECK" ] || { echo "--check: not a directory: $CHECK" >&2; exit 2; }
  WORK="$(mktemp -d "${TMPDIR:-/tmp}/overdrive-check.XXXXXX")"
  mkdir -p "$WORK/project" "$WORK/home"
  (cd "$CHECK" && tar -cf - --exclude node_modules --exclude .git .) | (cd "$WORK/project" && tar -xf -)
  echo "== check: $CHECK -> $WORK/project (HOME=$WORK/home) =="
  cd "$WORK/project" || exit 1
  total=0
  while IFS=$'\t' read -r dep _ src ref skills _; do
    case "$dep" in '#'*|dep|'') continue ;; esac
    [ "$ref" = - ] && continue
    IFS=' ' read -r -a names <<< "$skills"
    run env HOME="$WORK/home" npm_config_cache="${npm_config_cache:-$HOME/.npm}" npx -y skills@1.7.0 add "$src#$ref" -s "${names[@]}" -a claude-code universal pi -y --copy
    [ "$DRY_RUN" = 1 ] && continue
    for n in "${names[@]}"; do
      [ "$n" = '*' ] && continue
      total=$((total + 1))
      for d in .claude/skills .agents/skills .pi/skills; do
        [ -f "$d/$n/SKILL.md" ] || { FAILS+=("$dep: missing $d/$n/SKILL.md"); RC=1; }
      done
    done
  done < "$ROOT/harness/deps.tsv"
  [ "$RC" = 0 ] && echo "ok: $total skills present in .claude/skills, .agents/skills, .pi/skills"

  # MCP: register exactly as the real run does, but into a sandboxed HOME, then probe every
  # agent's resulting config by launching each server from the project copy.
  echo "== check: MCP wiring (HOME=$WORK/home) =="
  REAL_HOME="$HOME"; HOME="$WORK/home"
  probes=()
  if has claude; then mcp_claude; probes+=("claude-code=mcpServers:$HOME/.claude.json")
  else echo "claude-code: binary not found, registration not exercised"; fi
  if has codex; then
    mcp_codex_stdio
    # Not `codex mcp add --url` here: it opens an OAuth sign-in in the browser. Same config, written directly.
    f="$HOME/.codex/config.toml"
    [ "$DRY_RUN" = 1 ] || grep -qs '^\[mcp_servers\.context7\]' "$f" || { mkdir -p "${f%/*}"; printf '\n[mcp_servers.context7]\nurl = "%s"\n' "$CONTEXT7_URL" >> "$f"; }
    for srv in codebase-memory-mcp context7; do
      codex mcp get "$srv" --json </dev/null > "$WORK/codex-$srv.json" 2>/dev/null
      probes+=("codex=codex-get:$WORK/codex-$srv.json")
    done
  else echo "codex: binary not found, registration not exercised"; fi
  mcp_copy "$HOME/.pi/agent/mcp.json"; probes+=("pi=mcpServers:$HOME/.pi/agent/mcp.json")
  mcp_copy "$HOME/.omp/agent/mcp.json"; probes+=("omp=mcpServers:$HOME/.omp/agent/mcp.json")
  probes+=("opencode=opencode:$ROOT/.opencode/opencode.json" "gemini=mcpServers:$ROOT/.gemini/settings.json" "cursor=mcpServers:$ROOT/.mcp.json")
  HOME="$REAL_HOME" # servers launch with the real HOME, as each agent would run them
  run node "$ROOT/scripts/mcp-probe.mjs" --cwd "$WORK/project" "${probes[@]}"

  echo "== check: --init overlay on the copy =="
  run node "$ROOT/scripts/init-project.mjs" "$WORK/project"
  [ "$DRY_RUN" = 1 ] || echo "review the result: $WORK/project/AGENTS.md"
  if [ ${#FAILS[@]} -gt 0 ]; then echo "== Failures =="; for f in "${FAILS[@]}"; do echo "  $f"; done; fi
  exit "$RC"
fi

# Host selection.
HOSTS=""
if [ -n "${REQ// /}" ]; then
  for h in $REQ; do
    case " $VALID " in *" $h "*) ;; *) echo "unknown agent id: $h (valid: $VALID)" >&2; exit 2 ;; esac
    case " $HOSTS " in *" $h "*) ;; *) HOSTS="$HOSTS $h" ;; esac
  done
else
  for h in $VALID; do has "$(bin_of "$h")" && HOSTS="$HOSTS $h"; done
  [ -n "$HOSTS" ] || { echo "no agent found on PATH (looked for: claude codex opencode pi omp). Pass --agent <id>." >&2; exit 1; }
fi

# node >= 18: npx skills and the hooks need it.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
  if [ "$DRY_RUN" = 1 ]; then warn "node >= 18 not found (a real run will stop here)"
  else echo "node >= 18 is required. Install it (https://nodejs.org, fnm, or nvm) then rerun." >&2; exit 1; fi
fi

# Missing host binary: dry-run warns, real run skips the host.
SEL=""
for h in $HOSTS; do
  if has "$(bin_of "$h")"; then SEL="$SEL $h"
  elif [ "$DRY_RUN" = 1 ]; then warn "$h: binary not found (dry-run continues)"; SEL="$SEL $h"
  else echo "$h: binary not found, skipped"; RC=1; fi
done

# Call "$1" with each catalog row's 11 tab-separated columns ('-' keeps empty cells from collapsing).
each_row() {
  local cols
  while IFS=$'\t' read -r -a cols || [ ${#cols[@]} -gt 0 ]; do
    case "${cols[0]:-#}" in '#'*|dep) cols=(); continue ;; esac
    "$1" "${cols[@]}"; cols=()
  done < harness/deps.tsv
}

# Catalog columns: 1 dep 2 marketplace 3 source 4 ref 5 skills 6 claude-code 7 codex 8 opencode 9 pi 10 omp 11 note
method_for() { # host dep-row-columns... → the host's method cell
  case "$1" in claude-code) echo "$7" ;; codex) echo "$8" ;; opencode) echo "$9" ;; pi) echo "${10}" ;; omp) echo "${11}" ;; esac
}

SEEN="" # "host:marketplace" pairs already added
OC_PLUGINS=""
native() { # host dep marketplace source
  local h=$1 dep=$2 mkt=$3 src=$4 key="$1:$3"
  case " $SEEN " in *" $key "*) key="" ;; *) SEEN="$SEEN $key" ;; esac
  case "$h" in
    claude-code) [ -n "$key" ] && run claude plugin marketplace add "$src"; run claude plugin install "$dep@$mkt" ;;
    codex) [ -n "$key" ] && run codex plugin marketplace add "$src"; run codex plugin add "$dep@$mkt" ;;
    omp) [ -n "$key" ] && run omp plugin marketplace add "$src"; run omp plugin install "$dep@$mkt" ;;
    pi) run pi install "git:github.com/$src" ;;
    # ponytail: generic git spec for every opencode-native dep, no per-dep npm names in the catalog.
    opencode) OC_PLUGINS="$OC_PLUGINS \"$dep@git+https://github.com/$src\"," ;;
  esac
}

host_row() { # CUR_HOST set by caller
  local m; m="$(method_for "$CUR_HOST" "$@")"
  case "$m" in
    native) native "$CUR_HOST" "$1" "$2" "$3" ;;
    none) echo "skip $1 on $CUR_HOST: ${11}" ;;
  esac
}

skills_row() {
  local h hs=() names=()
  for h in $SEL; do [ "$(method_for "$h" "$@")" = skills ] && hs+=("$h"); done
  [ ${#hs[@]} -gt 0 ] || return 0
  IFS=' ' read -r -a names <<< "$5" # read never globs, so '*' stays literal
  run npx -y skills@1.7.0 add "$3#$4" -s "${names[@]}" -a "${hs[@]}" -g -y
}

if [ "$DEV" = 1 ]; then SELF="$ROOT"; OC_SELF="$ROOT/.opencode/plugins/overdrive.mjs"
else SELF="$OVERDRIVE_REPO"; OC_SELF="overdrive@git+https://github.com/$OVERDRIVE_REPO"; fi

for CUR_HOST in $SEL; do
  echo "== $CUR_HOST =="
  each_row host_row
  case "$CUR_HOST" in
    claude-code)
      run claude plugin marketplace add "$SELF"; run claude plugin install overdrive@overdrive
      mcp_claude ;;
    codex)
      run codex plugin marketplace add "$SELF"; run codex plugin add overdrive@overdrive
      run codex mcp add context7 --url "$CONTEXT7_URL" # Codex opens a browser sign-in for it
      mcp_codex_stdio ;;
    pi)
      if [ "$DEV" = 1 ]; then run pi install "$ROOT"; else run pi install "git:github.com/$OVERDRIVE_REPO"; fi
      run pi install npm:pi-subagents
      run pi install npm:pi-mcp-adapter
      run pi install npm:pi-ask-user # compound-engineering's recommended Pi companion for its blocking questions
      mcp_copy "$HOME/.pi/agent/mcp.json" ;;
    omp)
      if [ "$DEV" = 1 ]; then run omp plugin link "$ROOT"
      else run omp plugin marketplace add "$OVERDRIVE_REPO"; run omp plugin install overdrive@overdrive; fi
      mcp_copy "$HOME/.omp/agent/mcp.json" ;;
    opencode)
      echo "OpenCode: add to the \"plugin\" array in ~/.config/opencode/opencode.json:"
      echo "  \"plugin\": [${OC_PLUGINS} \"$OC_SELF\"]"
      echo "MCP: copy the \"mcp\" block from $ROOT/.opencode/opencode.json into ~/.config/opencode/opencode.json." ;;
  esac
done

echo "== skills (npx skills, commit-pinned) =="
each_row skills_row

# Cursor and Gemini: global MCP so every project gets both servers. Written only when the agent is
# present and the file is absent; an existing file is left for you to merge.
echo "== MCP for Cursor / Gemini =="
global_mcp() { # agent binary config-dir dest source
  if ! has "$2" && [ ! -d "$3" ]; then echo "$1: not found, skipped"
  elif [ -f "$4" ]; then echo "$4 exists. Leaving it untouched; merge the mcpServers block from $5 by hand."
  else run mkdir -p "$3"; run cp "$5" "$4"; fi
}
global_mcp Cursor cursor "$HOME/.cursor" "$HOME/.cursor/mcp.json" "$ROOT/.mcp.json"
global_mcp Gemini gemini "$HOME/.gemini" "$HOME/.gemini/settings.json" "$ROOT/.gemini/settings.json"

# mise: install pinned tools (codebase-memory-mcp etc.).
if has mise; then
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

echo "== Manual checklist =="
n=0
step() { n=$((n + 1)); echo "$n. $*"; }
step "Review docs/install.md + docs/harness-inventory.md before trusting any marketplace."
for h in $SEL; do
  case "$h" in
    codex) step "Codex: set [features] hooks = true in ~/.codex/config.toml, run /hooks and trust overdrive's SessionStart hook, then restart Codex." ;;
    opencode) step "OpenCode: paste the plugin snippet above into ~/.config/opencode/opencode.json, then restart OpenCode." ;;
    omp) step "omp: run 'omp config set marketplace.autoUpdate auto', then restart omp." ;;
    pi) step "Pi: restart pi so the new packages load." ;;
    claude-code) step "Claude Code: restart so the new plugins load." ;;
  esac
done
step "Overlay each project that should use the harness: bash scripts/bootstrap.sh --init <project> (--check <project> previews it)."
step "Edit .compound-engineering/config.yaml (note the cross_model_peer egress disclosure in AGENTS.md)."

if [ ${#FAILS[@]} -gt 0 ]; then
  echo "== Failures =="
  for f in "${FAILS[@]}"; do echo "  $f"; done
fi
exit "$RC"
