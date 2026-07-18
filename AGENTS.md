# AGENTS.md - usage contract

The golden path for building a speculative UI, and the methodology agents follow in this repo.

## The loop

```
observe  ->  predict  ->  prepare  ->  reveal  ->  evict
```

1. **observe** signals (hover, open, compare, ambient) and push UI state into context.
2. **predict** a ranked `Prediction[]` from the current context.
3. **prepare** the top predictions during idle time, up the fidelity ladder
   `compose -> prefetch -> materialize`, bounded by a budget.
4. **reveal** the committed intent instantly if warm; otherwise fetch cold inside a transition.
5. **evict** the bets that did not pay off.

## Build through the facade

Consumers build UIs with `defineSpeculativeUI` from `@sre/react`. The config is small:

- `predict(context) => Prediction[]` - the single required blending point.
- `fetch(intent) => Promise<data>` - how a speculation is prepared.
- `render(intent, data, meta) => ReactNode` - how a committed intent is shown (`meta.warm`
  tells you whether it was a cache hit).
- `renderLoading(intent) => ReactNode` - shown while a cold intent resolves.
- optional `learn(from, to)` and `observe(signal)` - forwarded to a stateful predictor so
  history accumulates (see `.wiki/decisions/0003-facade-learning-api.md`).

Drop to `@sre/core` only for a non-React host.

## Predictors

- `createDefaultPredictor()` - first-order Markov over component transitions. The degenerate
  case of the graph predictor: one node kind, one edge kind, weights tuned only by usage.
- `createGraphPredictor(config)` - the typed weighted knowledge graph with spreading activation.
  The recommended predictor; see ADR 0004 for the exact config surface and algorithm.

Both implement the same `Predictor` interface and drop into the facade's `predict`/`learn`/`observe`.

## Rules (read `.wiki/rules.md` in full)

- **R-001** No comments in any source file. Self-documenting names only.
- **R-002** Engine paths are deterministic: never call `Date.now()`, `requestIdleCallback`, or
  real timers. Take `clock` and `scheduler` by injection.
- **R-003** Intent keys are stable and unique. Build them from payload, e.g. `` `page:${id}` ``.
- **R-004** Build via the facade; `@sre/core` stays framework-agnostic (zero DOM, zero React).

## Orchestration

Multi-agent work in this repo runs through the **claude-architect** plugin
(`wfbcargo/PaulClaudePlugins`): an orchestrator decomposes work into epics / specs /
implementations, runs each in an isolated git worktree under `.worktrees/`, and drives
review + architecture-audit before every squash-merge. The methodology lives in the plugin's
`ORCHESTRATION.md`; project memory lives in `.wiki/`. See `CLAUDE.md`.
