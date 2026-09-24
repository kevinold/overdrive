#!/usr/bin/env bash
# overdrive bootstrap — idempotent. Installs the harness on every selected agent host
# from harness/deps.tsv. --dry-run prints every action without mutating anything.
# Bash 3.2 compatible (macOS /bin/bash): no associative arrays.
# shellcheck disable=SC2329 # catalog callbacks are invoked indirectly via each_row
set -uo pipefail # no -e: the tolerant runner decides what a failure means

VALID="claude-code codex opencode pi omp"
usage() { echo "usage: bootstrap.sh [--dry-run] [--agent <id>[,<id>]]...  ids: $VALID"; }

DRY_RUN=0
REQ=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --agent) [ $# -ge 2 ] || { usage >&2; exit 2; }; REQ="$REQ ${2//,/ }"; shift ;;
    --agent=*) v="${1#--agent=}"; REQ="$REQ ${v//,/ }" ;;
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

bin_of() { if [ "$1" = claude-code ]; then echo claude; else echo "$1"; fi; }
has() { command -v "$1" >/dev/null 2>&1; }
warn() { echo "warning: $*" >&2; }

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

for CUR_HOST in $SEL; do
  echo "== $CUR_HOST =="
  each_row host_row
  case "$CUR_HOST" in
    claude-code)
      run claude plugin marketplace add "$ROOT"; run claude plugin install overdrive@overdrive
      echo "MCP: .mcp.json is project-scoped; nothing to add." ;;
    codex)
      run codex plugin marketplace add "$ROOT"; run codex plugin add overdrive@overdrive
      run codex mcp add context7 --url https://mcp.context7.com/mcp
      run codex mcp add codebase-memory-mcp -- mise exec -- codebase-memory-mcp ;;
    pi)
      run pi install "$ROOT"
      run pi install npm:pi-subagents
      run pi install npm:pi-mcp-adapter
      if [ -f "$HOME/.pi/agent/mcp.json" ]; then echo "$HOME/.pi/agent/mcp.json exists. Leaving it untouched."
      else run mkdir -p "$HOME/.pi/agent"; run cp "$ROOT/.mcp.json" "$HOME/.pi/agent/mcp.json"; fi ;;
    omp)
      run omp plugin link "$ROOT"
      echo "MCP: register context7 + codebase-memory-mcp in omp's MCP config (servers listed in $ROOT/.mcp.json)." ;;
    opencode)
      echo "OpenCode: add to the \"plugin\" array in ~/.config/opencode/opencode.json:"
      echo "  \"plugin\": [${OC_PLUGINS} \"$ROOT/.opencode/plugins/overdrive.mjs\"]"
      echo "MCP: copy the \"mcp\" block from $ROOT/.opencode/opencode.json into ~/.config/opencode/opencode.json." ;;
  esac
done

echo "== skills (npx skills, commit-pinned) =="
each_row skills_row

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
step "Edit .compound-engineering/config.yaml (note the cross_model_peer egress disclosure in AGENTS.md)."

if [ ${#FAILS[@]} -gt 0 ]; then
  echo "== Failures =="
  for f in "${FAILS[@]}"; do echo "  $f"; done
fi
exit "$RC"
