# Speculative Rendering Engine

A speculative-execution runtime for UIs. **TypeScript pnpm monorepo**, strict + ESM.

## Commands

```bash
pnpm install
pnpm -r build          # order: core -> react -> demo
pnpm -r typecheck
pnpm -r test           # deterministic engine tests (fake clock + manual scheduler)
pnpm -C packages/demo dev
```

## Layout

```
packages/core     @sre/core, @sre/core/testing  — framework-agnostic engine (zero DOM, zero React)
packages/react    @sre/react                    — React adapter + defineSpeculativeUI facade
packages/demo     @sre/demo                     — Vite Concept Lab showcase
.wiki/            committed project memory (design decisions, rules, conventions)
```

Dependency direction is strict: `core <- react <- demo`. The core never imports the adapter.

## Read first

- `.wiki/README.md` — index into the project memory.
- `.wiki/rules.md` — active rules (R-001..R-004). Every sub-agent gets these at spawn.
- `.wiki/architecture.md` — package layout, module boundaries, data flow.
- `.wiki/decisions/0004-graph-activation-predictor.md` — the star algorithm.
- `README.md` / `AGENTS.md` — the concept and the usage contract.

## Rules (summary; `.wiki/rules.md` is authoritative)

- **R-001** No comments in any source file (`.ts`/`.tsx`/`.css`/`.json`). Markdown docs are fine.
- **R-002** Engine paths are deterministic: `clock` + `scheduler` are injected, never `Date.now()`
  or real timers.
- **R-003** Intent keys are stable and unique.
- **R-004** Build via the facade; `@sre/core` stays framework-agnostic.

Never use em dashes in rendered copy, JSX, comments, or docs. Use a colon, comma, parentheses, or
a period.

## Orchestration

Multi-agent work runs through the **claude-architect** plugin (enabled in `.claude/settings.json`
from `wfbcargo/PaulClaudePlugins`): an orchestrator decomposes work into epics / specs /
implementations, runs each in an isolated git worktree under `.worktrees/`, and drives a review +
architecture-audit + merge pipeline before every squash-merge. The methodology is the plugin's
`ORCHESTRATION.md`; durable project knowledge lives in `.wiki/`, ephemeral per-worktree scratch in
`.work-log/` (gitignored, stripped before PR).
