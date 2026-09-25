---
title: Harness Update Propagation - Plan
type: feat
date: 2026-09-25
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Harness Update Propagation - Plan

**Target branch:** new branch `feat-harness-update-propagation` cut from current `main` (PR #2, which added `npx` install, is already merged), shipped as a new PR against `main`.

## Goal Capsule

- **Objective:** When something is added to the harness (a new MCP server, a new catalog row, new managed content), an existing consumer gets it by rerunning the one command they already know, and the README says which command for which kind of change. Today a server added to `.mcp.json` or `.gemini/settings.json` never reaches a Pi, omp, Cursor, or Gemini user whose global config already exists, because bootstrap writes those files only when absent.
- **Means:** Replace the absent-only copy in `scripts/bootstrap.sh` with an additive merge that adds missing servers and touches nothing else, reusing the merge helpers `scripts/init-project.mjs` already has for `--project-plugins` (KTD1). Add a README "Updating" table and fix the per-host wording in `docs/install.md`.
- **Authority:** this plan > overdrive `AGENTS.md` house style (ponytail: least code, reuse, question existence) > the existing `--project-plugins` merge in `scripts/init-project.mjs` as the reference implementation.
- **Stop conditions:** hoisting the merge helper out of `initProject` changes any existing `tests/init-project.test.js` assertion beyond the invalid-JSON behavior named in KTD2 — stop and report rather than loosening the test. Nothing else here can block: no host binary is needed, every path is exercised with a temp `HOME`.
- **Execution profile:** hands-off on `feat-harness-update-propagation`; ships as a new PR against `main`. Real Cursor/Gemini merges on the developer's machine are not run (user direction: unit tests with a temp `HOME` only).

## Product Contract

### Summary

Rerunning `npx -y github:kevinold/overdrive` (or `bash scripts/bootstrap.sh`) brings every selected host's global MCP config up to the harness's current server list: Pi (`~/.pi/agent/mcp.json`), omp (`~/.omp/agent/mcp.json`), Cursor (`~/.cursor/mcp.json`), and Gemini (`~/.gemini/settings.json`) gain any server they are missing and keep every server and every other key they already have. A file that is not valid JSON is left byte-identical with a warning. `--dry-run` says per file whether it would create, update (naming the servers it would add), or leave it unchanged. Claude Code and Codex already add idempotently; OpenCode keeps its printed snippet. The README gains an "Updating" section that maps each kind of harness change to the command that propagates it and states the one known limit: a changed launch spec for a server name the user already has is never overwritten on any host and must be edited by hand.

### Problem Frame

The user asked how consumers get updates when the harness grows. Plugin update commands refresh overdrive's own skills, agents, and hooks, and rerunning bootstrap installs new catalog rows, but `mcp_copy` and `global_mcp` in `scripts/bootstrap.sh` write the Pi, omp, Cursor, and Gemini configs only when the file is absent, and the Cursor/Gemini branch tells the user to merge by hand. So an MCP server added after first install silently never arrives for those hosts. `scripts/init-project.mjs` already solves the same problem for project files (`mergeJson` + `addServers`: add what is missing, never flip what exists) but the helpers are local to `initProject`. Docs describe the absent-only behavior in several places and have no single "how do I update" answer.

### Requirements

**MCP propagation**

- R1. A bootstrap run with Pi or omp selected adds every harness server missing from `~/.pi/agent/mcp.json` / `~/.omp/agent/mcp.json`, creating the file when absent, sourced from `.mcp.json`.
- R2. The Cursor and Gemini step does the same for `~/.cursor/mcp.json` (from `.mcp.json`) and `~/.gemini/settings.json` (from `.gemini/settings.json`, Gemini's `httpUrl` shape), under the existing presence rule (binary on `PATH` or config dir exists).
- R3. A server name already present in the user's file is never changed or removed, and keys outside `mcpServers` are preserved with their values; the file is re-serialized as 2-space JSON, as `--project-plugins` files are today, so whitespace may change but no value does. A file already holding every harness server is not rewritten.
- R4. An existing file that fails to parse as JSON is left byte-identical, a warning naming the file is printed to stderr, and the run continues with exit status unaffected by that file.
- R5. `--dry-run` writes nothing and prints, per file, `DRY-RUN: create <path>`, `DRY-RUN: update <path> (add <server names>)`, or `unchanged <path>`.
- R6. `--check` registers Pi and omp into its sandboxed `HOME` through the same merge; its probes are unchanged.
- R7. `--project-plugins` keeps its current results for `.mcp.json`, `.cursor/mcp.json`, and `.gemini/settings.json` and shares the same helper.

**Docs**

- R8. `README.md` has an "Updating" section: a table mapping each kind of harness change (overdrive's own skills/agents/hooks; new `harness/deps.tsv` row or bumped ref; new MCP server; `--init` managed content; `--project-plugins` entries) to the command to rerun, plus the known limit that a changed spec for an existing server name is not propagated on any host (Claude's `mcp add` included) and is edited by hand. The "How overdrive installs itself" paragraph points at it instead of repeating update commands.
- R9. `docs/install.md` no longer says "only if that file is absent" or "merge by hand" for Pi, omp, Cursor, or Gemini; the "What bootstrap touches" list names all four global MCP files; the install-options table rows say the file is merged.

**Quality**

- R10. `npm test` passes with the new behavior covered by node:test, and `shellcheck scripts/bootstrap.sh` stays clean.

### Key Decisions

- KD1. **Merge Pi/omp/Cursor/Gemini global MCP configs additively on rerun** (session-settled: user-approved — chosen over leaving existing files untouched or overwriting them: additions reach existing users while the user's own servers and edits survive). Governs R1–R6.
- KD2. **One README "Updating" section answers "what do I rerun"** (session-settled: user-approved — chosen over per-host notes scattered through `docs/install.md`: one table, one place to keep current). Governs R8.
- KD3. **No update-available notice** (session-settled: user-approved — chosen over a version check at session start: skip until someone misses it).

### Scope Boundaries

- Overwriting or removing a server spec the user already has — the never-overwrite contract is the point; the limit is documented, not automated.
- OpenCode's global `~/.config/opencode/opencode.json` — bootstrap keeps printing the snippet.
- Claude Code and Codex MCP paths — already idempotent adders.
- An update-available notice (KD3).

## Planning Contract

### Key Technical Decisions

- KTD1. **Merge logic lives once, in `scripts/init-project.mjs`.** Hoist `mergeJson` and `addServers` from inside `initProject` to module scope, taking an absolute path plus `{ dryRun, log, label }` (label defaults to the path; `initProject` passes the project-relative name so its log lines read as today). Add and export `mergeMcp(dest, src, opts)`: read `src`'s `mcpServers`, merge into `dest`'s `mcpServers` with `addServers`, spread every other key of `dest` through unchanged. `--project-plugins` calls `mergeMcp` for its three MCP files. Bootstrap reaches it through a new `--merge-mcp <dest> <src> [--dry-run]` argv mode in the same script's entry block, branched before the project-dir check. Chosen over a new `scripts/merge-mcp.mjs` (an extra file with the same import chain) and over bash + `jq` (jq is not guaranteed; node already is, since bootstrap runs `scripts/init-project.mjs` and `scripts/mcp-probe.mjs`). Instantiates KD1; governs R1, R2, R7.
- KTD2. **Invalid JSON warns and skips, in the shared helper.** `mergeJson` catches the parse failure, prints `warning: <path> is not valid JSON; left untouched` to stderr (matching bootstrap's `warn()` shape), and returns without writing. Because the helper is shared, `--project-plugins` inherits the same behavior where it used to throw and abort the overlay; this is the one intended change to existing project behavior (see Stop conditions). Governs R4.
- KTD3. **Bootstrap calls node directly, not through `run`.** Follow the `--init` block: build an args array, append `--dry-run` when `DRY_RUN=1`, invoke node. The node side then prints the concrete outcome (`DRY-RUN: create …`, `DRY-RUN: update … (add …)`, `unchanged …`) instead of `run`'s opaque `DRY-RUN: node …`; a non-zero exit is appended to `FAILS` and sets `RC=1` like any other step. One bash function `mcp_merge <dest> <src>` replaces `mcp_copy` at every call site (Pi, omp, and the two `--check` lines); `global_mcp` keeps its presence check and calls `mcp_merge` in place of the exists/cp branches. Directory creation moves to the node side (`put` already creates parent dirs). Governs R1, R2, R5, R6.
- KTD4. **Absent destination gets `{ mcpServers }` only.** For Pi/omp/Cursor that equals today's copy of `.mcp.json`. For Gemini it drops the shipped `contextFileName: "GEMINI.md"`, which is Gemini's default anyway, and matches what `--project-plugins` already writes for a fresh `.gemini/settings.json`. Mark with a `ponytail:` comment. Governs R2, R3.
- KTD5. **Tests stay node:test spawning bash.** The update line names added servers so a dry run is auditable; `mergeMcp` computes the missing names from the destination before calling `mergeJson`. `repoCopy()` in `tests/bootstrap.test.js` must add `hooks` (`scripts/init-project.mjs` imports `../hooks/lib.js`, so a repo copy without it fails at import) and `.gemini` (the Gemini merge reads `.gemini/settings.json`). Governs R10.

## Implementation Units

### U1. Shared `mergeMcp` helper and CLI mode

- **Goal:** one exported, dry-run-aware, invalid-JSON-tolerant merge that `--project-plugins` and bootstrap both use.
- **Requirements:** R3, R4, R5, R7; KTD1, KTD2, KTD4.
- **Dependencies:** none.
- **Files:** `scripts/init-project.mjs`, `tests/init-project.test.js`.
- **Approach:**
  1. Hoist `mergeJson`/`addServers` to module scope (KTD1) and add the parse guard (KTD2).
  2. Add `mergeMcp(dest, src, { dryRun, log })`; its update label lists the servers being added.
  3. Switch the three `--project-plugins` MCP lines to `mergeMcp`.
  4. Add the `--merge-mcp <dest> <src>` argv branch ahead of the project-dir check, exiting 0 after the merge (a warning is not a failure).
- **Execution note:** write the scenarios below red first.
- **Patterns:** `act`, `mergeJson`, `addServers`, `readJson`, and the `.gitignore (a, b)` label style in `scripts/init-project.mjs`.
- **Test scenarios:**
  - Existing dest with `theme` and a `mine` server plus an older `context7` spec gains `codebase-memory-mcp` only; the `context7` spec, `theme`, and `mine` are untouched; a second call logs `unchanged`.
  - Dest absent creates a file holding only `mcpServers`.
  - Dest with invalid JSON is byte-identical afterwards, nothing is written, and the warning names the file.
  - `dryRun: true` writes nothing and the log line starts `DRY-RUN: create` or `DRY-RUN: update … (add …)`.
  - The existing `--project-plugins` tests keep passing unchanged.
- **Verification:** `npm test` green; existing `--project-plugins` merge and dry-run tests unchanged.

### U2. Bootstrap uses the merge for Pi, omp, Cursor, Gemini, and `--check`

- **Goal:** rerun propagates added servers on all four hosts with auditable dry-run output.
- **Requirements:** R1, R2, R5, R6, R10; KTD3, KTD5.
- **Dependencies:** U1.
- **Files:** `scripts/bootstrap.sh`, `tests/bootstrap.test.js`.
- **Approach:**
  1. Add `mcp_merge` per KTD3 and delete `mcp_copy`.
  2. Call it from the Pi and omp cases, both `--check` lines, and `global_mcp`'s write branch.
  3. Rewrite the Cursor/Gemini comment block so it no longer promises absent-only writes; mark the no-jq choice with a `ponytail:` comment.
  4. Update the existing Pi/omp dry-run assertions (currently `DRY-RUN: cp …`) to `DRY-RUN: create <home>/.pi/agent/mcp.json` and the omp equivalent, and extend `repoCopy()` per KTD5.
- **Patterns:** `boot`, `stubDir`, `realRun`, `repoCopy`, temp `HOME` in `tests/bootstrap.test.js`; the `--init` node delegation and `FAILS`/`RC` bookkeeping in `scripts/bootstrap.sh`.
- **Test scenarios:**
  - Dry run against a temp `HOME` whose `.pi/agent/mcp.json` already has `mine` and `context7` prints `DRY-RUN: update … (add codebase-memory-mcp)` and leaves the file byte-identical.
  - Real run on that file yields `mine`, the original `context7` spec, and `codebase-memory-mcp`; a second real run logs `unchanged`.
  - Real run with an invalid `~/.omp/agent/mcp.json` leaves it byte-identical, prints the warning on stderr, and prints no `== Failures ==`.
  - Real run with a `.gemini` dir in the temp `HOME` and a `settings.json` holding `theme` plus `mine` keeps both, adds both harness servers in Gemini's `httpUrl` shape, and introduces no `contextFileName`.
  - Existing `--check` and "absent host" tests still pass (Pi file exists after the run).
- **Verification:** `npm test` green (count above the current 60); `shellcheck scripts/bootstrap.sh` clean; `bash scripts/bootstrap.sh --dry-run --agent pi,omp` on the developer machine prints `unchanged` or an `update … (add …)` line for the real files and modifies nothing.

### U3. README "Updating" section and install.md wording

- **Goal:** a consumer knows what to rerun for each kind of change and reads accurate per-host MCP behavior.
- **Requirements:** R8, R9; KD2.
- **Dependencies:** U2 (wording must match shipped behavior).
- **Files:** `README.md`, `docs/install.md`, `docs/capability-matrix.md`.
- **Approach:**
  1. Add `## Updating` after "How overdrive installs itself" with the change-kind → command table from R8 and one paragraph on the changed-spec limit (remove the server from the host config — for Claude Code, `claude mcp remove` — then rerun).
  2. Trim the install paragraph's update sentence to a pointer at the new section.
  3. In `docs/install.md`, extend "What bootstrap touches" with the four global MCP files (`mcpServers` only) and change the Pi, omp, Cursor, and Gemini rows and sections to "adds the harness servers missing from the file (created if absent); servers already there are left as they are".
  4. In `docs/capability-matrix.md`, change the MCP row's Cursor and Gemini cells ("bootstrap writes … if absent") to say bootstrap merges missing servers; then search `docs/` for any other absent-only or by-hand MCP wording and fix it.
- **Test expectation:** none — docs only; a search for "if absent", "only if that file is absent", and "by hand" across `README.md` and `docs/` finds no MCP-config wording (the unrelated `config.yaml` "seeded only if absent" line stays).
- **Verification:** tables render cleanly; every command in the Updating table exists in bootstrap or the host CLI as documented elsewhere in the repo.

## Verification Contract

| Check | Proves |
|---|---|
| `npm test` | U1 and U2 scenarios pass; no existing assertion loosened |
| `shellcheck scripts/bootstrap.sh` | bootstrap stays clean |
| `bash scripts/bootstrap.sh --dry-run --agent pi,omp` on the developer machine | per-file outcome lines print; no file changes; no real Cursor/Gemini merge is run |
| Read of README "Updating" | each of the five change kinds maps to a command; the changed-spec limit is stated |

## Definition of Done

- U1–U3 landed as commits on `feat-harness-update-propagation`; a new PR against `main` whose body states the behavior change (Pi/omp/Cursor/Gemini configs are merged on rerun; invalid JSON warns instead of aborting) and the changed-spec limit.
- `npm test` and `shellcheck scripts/bootstrap.sh` green.
- No absent-only or merge-by-hand MCP wording remains in `README.md` or `docs/` (including `docs/capability-matrix.md`).
- No abandoned-attempt code left in the diff.
- Any non-obvious learning (for example the `repoCopy` import-chain gotcha in KTD5) captured under `docs/solutions/`, or the skip reason noted in the PR body.
