# Overdrive

*Make your coding agent do more with the tokens you already have.*

---

You hit your weekly limit mid-feature. Now look at where the tokens actually went.

Not the feature. Overhead. Context you re-pasted because the agent forgot it. A search that dumped forty files into your window. The same plan, explained twice.

The limit isn't the problem. The waste inside it is.

Overdrive is a repo you clone that cuts the waste:

- A cheap model does the typing. Your best model is saved for the hard thinking.
- Your project stays cached, so you stop re-explaining it every session.
- Subagents run the big searches and hand back the answer. Your context stays clean.
- A second model, from a different company, reviews the diff before it ships.
- Every fix gets written down, so you solve it once.

Same limit. More of it on real work. One clone, one command.

Here's the whole machine on one page.

![The overdrive harness as an SDLC loop. Plan, Build, Test, Review, Ship, Learn, cycling back to Plan, over a base layer of caching, model gears, 3-layer memory, and hooks.](overdrive-sdlc-loop.svg)

<sub>*Want to poke at it? There's an [interactive version](overdrive-sdlc.html) next to this post. Pan, zoom, switch themes, export a PNG.*</sub>

Read straight through, or jump to the layer you care about.

## What's in the harness

The harness is a stack of layers. Each does one job. For each, what it is and why it earns a place.

Bottom up. The foundations that make each turn cheaper. The glue that ties it together. The gears that pick the right model. The instincts that shape how it works. The phase tools that make the SDLC faster to follow than to skip.

### The foundation: make every turn cheaper

**The cached contract: [`AGENTS.md`](https://agents.md).** Your conventions and your project's shape don't change turn to turn. So you state them once, in a file at the repo root, and the model reads them from cache. You stop re-explaining your project every morning. The agent shows up already knowing it. (`CLAUDE.md` is the same file for Claude.)

**[`codebase-memory-mcp`](https://github.com/DeusData/codebase-memory-mcp): a map of your code.** A local graph of the whole repo. Every symbol, call, and reference, indexed. The agent asks the graph "what calls this?" and gets one line back. It stops reading ten files into its context to find out. Re-reading is where a lot of a session's tokens quietly go.

**[`context7`](https://github.com/upstash/context7): current docs on tap.** It pulls real, version-correct docs for a library the moment the agent needs them. No more confident code against an API that changed two versions ago. The agent looks the API up instead of guessing.

**Three memories, three horizons.** These are three different things, so treat them as one layered memory. The prompt cache holds this session's tokens. `codebase-memory-mcp` holds your code's shape. `docs/solutions/` and file-memory hold what you learned, across sessions. Three caches. Three lifespans. One rule: don't pay twice for the same thing.

**Hooks: automation you'd forget.** Small scripts the harness runs for you. Re-index the code graph when a session starts. Fire a gate when a plan lands with no spec check. This is why "not vibe-coding" is more than a slogan. A hook actually fires. You don't have to remember the discipline.

### The glue: compound-engineering

Most of what follows comes from [**compound-engineering**](https://github.com/EveryInc/compound-engineering-plugin). It's the plugin that ties the loose tools into one workflow. Alone, you have a drawer of sharp tools. compound-engineering makes them a harness.

It gives you the model-gear config, the `ce-plan → ce-work → ce-code-review` flow, and `/ce-compound`. Run `lfg` to do the whole loop at once. Everything below is a layer it provides or wires together.

The full list of plugins and MCP servers, with install commands, is in [`docs/harness-inventory.md`](../docs/harness-inventory.md).

### The gears: which model does what

Running one model for everything wastes the most budget. It's also the easiest thing to fix. The harness runs three gears, set in [`.compound-engineering/config.yaml`](../.compound-engineering/config.yaml):

```yaml
plan_model: fable
brainstorm_model: fable
cross_model_peer: codex
```

**Driver.** Opus or Sonnet, set per session. It does the typing and the building. You spend most of the day here, so it should be capable, not maximal.

**Reasoning.** Fable escalates for the few steps where thinking pays: writing a plan, generating approaches. You don't spend a reasoning model renaming variables. You spend it on the two or three moments per feature where a better plan saves an hour.

**Peer review.** This is the layer people skip. It catches what the others can't. `cross_model_peer: codex` hands the finished work to a different model, trained by a different company, and asks it to attack the work. A second opinion from a system with different blind spots. It has caught production-write bugs the main model was too close to see.

Two caveats. The peer runs on a separate subscription. [Codex](https://github.com/openai/codex) costs money and sits outside your Claude budget. And it sends your code to a third party. Full file contents leave Claude and go to OpenAI. Turn it on as a choice, weighed against how sensitive your repo is. Leave `cross_model_peer` unset if your code can't leave. The repo's [`AGENTS.md`](../AGENTS.md) says so at the top, on purpose.

### The instincts: ponytail and caveman

Two layers change how the agent behaves, not what it builds.

[**ponytail**](https://github.com/DietrichGebert/ponytail) makes it a lazy senior developer. The best code is the code you don't write. It stops the agent gold-plating. It reaches for the smallest thing that works, reuses what's already there, and questions whether a piece needs to exist at all. Less code to read. Less to maintain. Fewer tokens to write it.

[**caveman**](https://github.com/JuliusBrussee/caveman) strips the agent's prose to signal. No filler. No "certainly, I'd be happy to." The output stays short, so the context you pay to keep clear doesn't fill with padding.

Both run by default. `AGENTS.md` states the house style in one line each, and the plugins enforce it:

```markdown
- ponytail: build the least code that works.
- caveman: keep output terse.
```

Toggle per session with `/ponytail` or `/caveman`. Type `stop ponytail` to turn it off.

### The phases: the SDLC, faster

Every tool above lands on a phase you already run. The harness doesn't let you skip a phase. It makes running one cheaper than skipping it.

**Plan.** `ce-plan` sends the hard thinking to Fable. `ce-brainstorm` opens the problem first. `ce-doc-review` runs a panel of reviewers, and the cross-model peer, over the plan before you build. The thinking happens on the right model, and gets reviewed, before a line is written.

**Build.** `ce-work` and `lfg` run on the worker model. The quiet workhorse is subagent isolation. A wide "where is this used" search runs in a subagent. It reads forty files and hands back three lines. The other thirty-seven never touch your window. That isolation is the biggest lever on getting more done per token. Your thinking context stays clean.

**Test.** The harness ships a testing discipline, not just a runner. [Vitest](https://vitest.dev) and [Cypress](https://www.cypress.io) in a dual-layer TDD contract, where a behavior change updates both. [`agent-browser`](https://github.com/vercel-labs/agent-browser) and [`ui-visual-validator`](https://github.com/wshobson/agents) cover what a unit test can't see. Tests come first. Validation runs on every change.

**Review.** The cross-model peer leads. Then `ce-code-review` runs a structured pass over the diff. A different model and a fresh set of eyes both see the change before it ships.

**Ship.** `ce-commit-push-pr` writes the PR. `ce-babysit-pr` watches CI to green.

**Learn.** `/ce-compound` writes each real fix into `docs/solutions/`: the bug, the fix, what didn't work. The next session reads it. This is the layer that makes the whole thing compound.

## One real session

One task, end to end:

1. A ticket comes in. The worker (Opus) reads it and the code through the graph, not by dumping files into the window.
2. It needs a plan, so it escalates to Fable. Fable plans while the worker waits.
3. A "where is this used" search runs in a subagent. Forty files in, three lines back. Your context stays clean.
4. The worker builds against the plan, tests first.
5. The codex peer reviews the diff and catches an edge case the main model missed.
6. `/ce-compound` writes it to `docs/solutions/`. Next time, the session opens with the answer.

The reasoning model ran once. The peer ran once. The worker did the rest. The same tokens you'd have spent, now on the work.

## Get it

The whole harness is a starter repo. Clone it. Run one command.

```bash
git clone git@github.com:kevinold/overdrive.git && cd overdrive
bash scripts/bootstrap.sh              # installs the whole harness
bash scripts/bootstrap.sh --dry-run    # prints every action, changes nothing
```

One command sets up the whole harness. It prints the plugin installs for you to paste into Claude Code, wires the MCP servers into Codex, pins the CLI tools, and seeds your config. Run it with `--dry-run` first to see every action.

It all runs on the Claude subscription you already have. The one exception is the codex peer. It's optional, and it's the only part that costs extra.

One boundary, so you're not surprised. overdrive is a [Claude Code](https://claude.com/claude-code) harness that ports its conventions to any agent. It is not a full harness for every agent. The `AGENTS.md` contract and the two MCP servers work anywhere that reads `AGENTS.md` and speaks [MCP](https://modelcontextprotocol.io). Codex, Cursor, Gemini, and OpenCode all get that. The plugins, skills, and hooks are Claude Code only. Don't expect Cursor to run `ce-plan`. Do expect every agent to share the same context contract and memory.

Before you run it on anything that matters, skim [`docs/harness-inventory.md`](../docs/harness-inventory.md) and [`docs/install.md`](../docs/install.md), and read the marketplace list. You're installing third-party plugins that can run commands in your agent's environment. Trust, then verify.

## The part that compounds

Everything above makes one session better. The reason to adopt it is what happens across sessions.

Every real fix gets written to `docs/solutions/`. File-memory carries what matters between sessions. The code graph stays current. So the harness doesn't just run well today. It runs better the longer you use it, because it stops rediscovering what it already knew.

That's the payoff. A machine that learns and keeps what it learns.

The limit never moved. You just stopped wasting it.

*Clone it: [`github.com/kevinold/overdrive`](https://github.com/kevinold/overdrive). Try `--dry-run` first.*
