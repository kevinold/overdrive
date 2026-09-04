# Overdrive: get more out of every token

*A harness that assembles the right set of tools so your coding agent does more with the tokens you already have. Higher gear — not a bigger budget.*

---

You hit the weekly limit on a Wednesday, mid-feature, and it lands like a betrayal. So you scroll back through the session to see where it all went — and the surprise is that it didn't go to the feature. It went to overhead: the four times you re-pasted the same project context because the agent forgot it, the search that dumped forty files into the window you needed for thinking, the plan you walked your most expensive model through twice because it wandered.

The limits aren't the problem. What you do inside them is. Most people are driving a race car in first gear — one heavy model doing everything, the whole project re-explained every session, tool output dumped straight into the main context window, and the same bug rediscovered on Thursday that they already solved on Monday. Of course the meter moves. It's moving on overhead.

The fix isn't more tokens. It's a harness: the right tools, assembled, so the tokens go to *outcomes* instead of ceremony. That's what this is — and it's one `git clone` and one command away.

> **The 20-second version (for people who won't read the rest)**
>
> - **What it is:** a starter repo that assembles the right tools — plugins, MCP servers, model "gears," hooks — around your coding agent. Not a bag of tricks; an intentional set.
> - **Why it matters:** it makes your token usage *more effective* by putting the cheap model on the typing and the expensive reasoning only where reasoning pays. It's the SDLC you already run — plan, build, test, review, ship, learn — accelerated, not skipped.
> - **How to get it:** `git clone git@github.com:kevinold/overdrive.git && bash scripts/bootstrap.sh`
> - **The moat:** it compounds. Every fix gets written down, so the next session starts from the answer instead of rediscovering it.

## You're rationing the wrong thing

Think of your usage limit as a budget and the harness as a transmission.

In first gear, every turn pays full freight — nothing is set up to make the next turn cheaper, so effort and output stay the same number.

Overdrive is the same engine in a higher gear. A cheap worker model does the driving. The big context is cached and reused instead of re-sent. Subagents go do the messy work and hand back only the answer. And the things you learn get written down so you never pay to learn them twice.

One caveat up front, because someone will raise it: caching *amortizes* the harness cost across a session — it doesn't erase it. The first turn of a fresh session pays more, not less; a bigger harness means a bigger warm-up. The win is everything that happens across the turns after. Spin it up and then do nothing with it and yes, you'll pay for the warm-up and get nothing back — but that's a not-actually-working-yet problem, not a limits problem.

Here's the whole machine on one page:

<svg viewBox="0 0 860 300" role="img" aria-label="The overdrive harness as an SDLC loop: Plan, Build, Test, Review, Ship, Learn, looping back to Plan, over a foundation of caching, model gears, 3-layer memory, and hooks." style="width:100%;height:auto;font-family:ui-sans-serif,system-ui,sans-serif;">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8"/>
    </marker>
  </defs>
  <!-- phase boxes -->
  <g>
    <!-- Plan -->
    <rect x="16" y="40" width="120" height="60" rx="10" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="76" y="66" text-anchor="middle" font-size="15" font-weight="700" fill="#3730a3">Plan</text>
    <text x="76" y="86" text-anchor="middle" font-size="10" fill="#475569">Fable escalates</text>
    <!-- Build -->
    <rect x="176" y="40" width="120" height="60" rx="10" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="236" y="66" text-anchor="middle" font-size="15" font-weight="700" fill="#3730a3">Build</text>
    <text x="236" y="86" text-anchor="middle" font-size="10" fill="#475569">worker drives</text>
    <!-- Test -->
    <rect x="336" y="40" width="120" height="60" rx="10" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="396" y="66" text-anchor="middle" font-size="15" font-weight="700" fill="#3730a3">Test</text>
    <text x="396" y="86" text-anchor="middle" font-size="10" fill="#475569">Vitest + Cypress</text>
    <!-- Review -->
    <rect x="496" y="40" width="120" height="60" rx="10" fill="#fef2f2" stroke="#dc2626" stroke-width="1.5"/>
    <text x="556" y="66" text-anchor="middle" font-size="15" font-weight="700" fill="#991b1b">Review</text>
    <text x="556" y="86" text-anchor="middle" font-size="10" fill="#475569">codex peer</text>
    <!-- Ship -->
    <rect x="656" y="40" width="88" height="60" rx="10" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="700" y="66" text-anchor="middle" font-size="15" font-weight="700" fill="#3730a3">Ship</text>
    <text x="700" y="86" text-anchor="middle" font-size="10" fill="#475569">PR + babysit</text>
    <!-- Learn -->
    <rect x="764" y="40" width="80" height="60" rx="10" fill="#ecfdf5" stroke="#059669" stroke-width="1.5"/>
    <text x="804" y="63" text-anchor="middle" font-size="14" font-weight="700" fill="#065f46">Learn</text>
    <text x="804" y="83" text-anchor="middle" font-size="9" fill="#475569">/ce-compound</text>
  </g>
  <!-- arrows between phases -->
  <g stroke="#94a3b8" stroke-width="1.6" fill="none" marker-end="url(#arrow)">
    <line x1="138" y1="70" x2="174" y2="70"/>
    <line x1="298" y1="70" x2="334" y2="70"/>
    <line x1="458" y1="70" x2="494" y2="70"/>
    <line x1="618" y1="70" x2="654" y2="70"/>
    <line x1="746" y1="70" x2="762" y2="70"/>
  </g>
  <!-- loop-back arrow: Learn -> Plan -->
  <path d="M 804 100 C 804 150, 76 150, 76 102" stroke="#94a3b8" stroke-width="1.6" fill="none" marker-end="url(#arrow)"/>
  <text x="440" y="145" text-anchor="middle" font-size="10" fill="#64748b" font-style="italic">each cycle starts from the last one's learnings</text>
  <!-- foundations bar -->
  <rect x="16" y="200" width="828" height="72" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
  <text x="430" y="222" text-anchor="middle" font-size="11" font-weight="700" fill="#334155" letter-spacing="0.5">FOUNDATIONS UNDER EVERY PHASE</text>
  <g font-size="12" fill="#475569" text-anchor="middle">
    <text x="130" y="250" font-weight="600" fill="#334155">Caching</text>
    <text x="130" y="266" font-size="10">reuse, not re-send</text>
    <text x="330" y="250" font-weight="600" fill="#334155">Model gears</text>
    <text x="330" y="266" font-size="10">right model per phase</text>
    <text x="540" y="250" font-weight="600" fill="#334155">3-layer memory</text>
    <text x="540" y="266" font-size="10">tokens · code graph · knowledge</text>
    <text x="730" y="250" font-weight="600" fill="#334155">Hooks</text>
    <text x="730" y="266" font-size="10">automation</text>
  </g>
</svg>

<sub>*Prefer to poke at it? An [interactive version](overdrive-sdlc.html) — pan, zoom, theme-switch, export PNG — lives alongside this post.*</sub>

The rest of this post walks that diagram. Read it top to bottom or skip to the phase you care about.

## The SDLC, accelerated

The most common objection to any of this is that it's "vibe-coding with extra steps." It isn't, and the reason is the diagram above: every tool maps to a phase of the software lifecycle you already run. The harness doesn't let you skip planning, testing, or review. It makes doing them *cheaper than not doing them*.

And it's enforced, not just encouraged. A hook can fire the moment an implementation plan lands without a spec check, or re-index the code graph on session start — automation that gates behavior instead of trusting you to remember. That's what puts teeth in "not vibe-coding": something actually fires.

Before the phases, the foundations that sit under all of them.

**Caching.** Your instructions, conventions, and the shape of your project don't change turn to turn, so they shouldn't be re-sent turn to turn. A stable `AGENTS.md` at the repo root is the cached contract; skills load their bodies only when invoked. The big deposit happens once and gets reused — which is exactly why the first turn of a fresh session looks expensive and the fiftieth turn doesn't.

**Model gears** — the heart of it, so it gets its own section below.

**Three-layer memory.** Three different things get remembered at three different horizons: the prompt cache holds *tokens* within a session; `codebase-memory-mcp` holds a *code graph* you query instead of re-reading files; and `docs/solutions/` plus file-memory hold *durable knowledge* across sessions. Different caches, different lifespans, one principle — don't pay twice for the same thing.

**Hooks.** The automation layer. Re-index the code graph on session start; gate spec-less plans; keep the workspace honest without you thinking about it.

Now the phases.

- **Plan** — `ce-plan`, `ce-brainstorm`, `ce-doc-review`. The reasoning-heavy step gets the reasoning model; the research gets delegated to subagents instead of typed by hand.
- **Build** — `ce-work`, `lfg`, the worker model, subagent isolation, `context7`, `codebase-memory-mcp`. The agent walks the code graph instead of dumping files into the window, and looks APIs up in `context7` rather than guessing them.
- **Test** — Vitest and Cypress in a dual-layer TDD discipline, plus `agent-browser` and `ui-visual-validator` for the things a unit test can't see. Tests come first, and validation runs on every change.
- **Review** — this is a headline, so read the next section. A *different* model checks the work.
- **Ship** — `ce-commit-push-pr`, `ce-babysit-pr`, and the small conventions that keep CI cheap.
- **Learn** — `/ce-compound` writes what you learned into `docs/solutions/`, and the next session reads it.

The full inventory — every plugin, marketplace, and MCP server, with the exact install lines — lives in [`docs/harness-inventory.md`](../docs/harness-inventory.md).

## Three gears, never one model

Running one model for everything is the single biggest source of wasted budget — and the easiest thing to fix.

The harness runs three gears, set in [`.compound-engineering/config.yaml`](../.compound-engineering/config.yaml):

**Driver — the worker.** Opus or Sonnet, whatever you set per session, does the typing and the building. This is the gear you spend most of your day in. It should be capable, not maximal.

**Overdrive — reasoning.** A reasoning-tuned model (Fable) escalates for the steps where thinking actually pays: authoring a plan, generating approaches. You don't burn your reasoning budget renaming variables; you spend it on the two or three moments per feature where a better plan saves an hour of building.

```yaml
plan_model: fable
brainstorm_model: fable
cross_model_peer: codex
```

**Peer — the second opinion.** `cross_model_peer: codex` sends the work to a *different*, differently-trained model to adversarially re-review it. One model grading its own homework misses its own blind spots; a second one, trained by someone else, catches them. This is the quality half of "effective": a second set of eyes on the diff before it ships.

Two notes on the peer, surfaced up front so you don't find out the hard way:

1. It runs on a **separate subscription**. Codex is not free and not covered by your Claude budget. It buys a second opinion, not more tokens.
2. It **sends your code to a third party**. Enabling `cross_model_peer` means full file contents leave your Claude provider and go to codex/OpenAI. That's a deliberate, reviewed choice — weigh it against how sensitive your repo is. If your code can't leave, leave `cross_model_peer` unset. The repo's [`AGENTS.md`](../AGENTS.md) spells this out at the top, on purpose.

## One real session

Here's what a task looks like end to end, so the gears stop being abstract.

A ticket comes in. The **worker** (Opus, driving) reads it and the relevant code — via the code graph, not by dumping files into the window. The problem is gnarly enough to plan, so it **escalates to Fable**, which writes the plan while the worker waits. A wide "where is this used across the repo" search goes to a **subagent**, which reads forty files and hands back three lines; the other thirty-seven never touch the main window. The worker builds against the plan, writes the tests first, and when the diff is ready it goes to the **codex peer**, which flags an edge case the primary model was too close to see. Fixed. Then `/ce-compound` writes the whole thing — the bug, the fix, what didn't work — into `docs/solutions/`, so the next time this shape of problem shows up, the session opens with the answer already in hand.

Count the gears: your reasoning model ran once, to plan; the peer ran once, on its own subscription; the cheap worker did everything else. The messy search never polluted the context, and the lesson got banked. On your Claude budget, those are the tokens you'd have spent anyway — pointed at the work instead of the warm-up.

## Get it: clone and one command

The whole harness is a starter repo. Clone it, run one command:

```bash
git clone git@github.com:kevinold/overdrive.git && cd overdrive
bash scripts/bootstrap.sh              # lean core: compound-engineering + the two MCP servers + gears + validation
bash scripts/bootstrap.sh --with-extras   # adds the opt-in plugins
bash scripts/bootstrap.sh --dry-run    # prints every action, changes nothing
```

The default install is deliberately lean — enough to feel the difference on the first task, not a 30-minute setup you abandon halfway. The full kit is one flag away. And the lean core — the part that actually stretches your tokens — runs entirely on the Claude subscription you already have; the codex peer is an optional add-on you opt into, not a second bill you need before any of this pays off.

One boundary, so you're not surprised: **overdrive is a Claude Code harness that ports its conventions to any agent — not a full harness for every agent.** The `AGENTS.md` contract and the two MCP servers (`context7`, `codebase-memory-mcp`) work anywhere that reads `AGENTS.md` and speaks MCP — Codex, Cursor, Gemini, OpenCode all get that. The plugin, skill, and hook acceleration is Claude-Code-specific. Don't clone it expecting Cursor to run `ce-plan`; do clone it expecting every agent to share the same context contract and memory layer.

Before you run it on anything that matters: skim [`docs/harness-inventory.md`](../docs/harness-inventory.md) and [`docs/install.md`](../docs/install.md), and review the marketplace list. You're installing third-party plugins that can run commands in your agent's environment. Trust, then verify.

## The part that compounds

Everything above makes a single session more effective. The reason to actually adopt it is what happens across sessions.

Every non-trivial fix gets written to `docs/solutions/`. File-memory carries what matters between sessions. The code graph stays current. So the harness doesn't just run efficiently today — it gets *more* effective the longer you use it, because it stops rediscovering things it already knew. That's the moat: a machine that learns and keeps what it learns.

The limits never moved. You just stopped idling in first gear.

*Clone it: [`github.com/kevinold/overdrive`](https://github.com/kevinold/overdrive). Kick the tires with `--dry-run` first.*
