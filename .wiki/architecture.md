# Architecture

SRE is a speculative-execution runtime for UIs: observe signals -> predict ranked next intents ->
prepare them at graded fidelity during idle time within a budget -> reveal the matching one
instantly on commit, discard the rest. A branch predictor for intent.

## Packages

TypeScript pnpm monorepo (`packages/*`). Strict TS, ESM, bundler resolution (`tsconfig.base.json`).

| Package | Module name | Role |
| ------- | ----------- | ---- |
| `packages/core` | `@sre/core`, `@sre/core/testing` | Framework-agnostic engine. Zero DOM, zero React. |
| `packages/react` | `@sre/react` | React adapter + `defineSpeculativeUI` facade. |
| `packages/demo` | `@sre/demo` | Vite Concept Lab showcase. |

## Dependency direction

`core <- react <- demo`. The core never imports the adapter; the adapter never imports the demo.
UI materialization is the first adapter, not part of the engine: what a speculation *prepares* and
how it is *committed* are consumer-supplied callbacks, so the runtime can speculate over data,
computation, or rendered UI alike.

## @sre/core layout

- `types.ts` - all shared types (`Intent`, `Signal`, `Prediction`, `Speculation`, `LadderLevel`,
  `Clock`, `IdleScheduler`, `BudgetPolicy`, `TelemetryEvent`, ...). Single source of truth.
- `engine.ts` - the lifecycle: predict -> reconcile -> promote/demote/evict -> commit.
  `createEngine`, `SpeculationEngine`, `CommitResult`.
- `predictor.ts` - `createDefaultPredictor` (first-order Markov).
- `graph-predictor.ts` - `createGraphPredictor`, `defaultConcepts`, and the `Graph*` type surface:
  spreading-activation over a typed weighted knowledge graph (see
  [decisions/0004](./decisions/0004-graph-activation-predictor.md)).
- `budget.ts` - `createFixedBudget`, `createAdaptiveBudget` (device/concurrency caps).
- `trajectory.ts` - committed path + `computeReturnCandidates` (undo/redo as warm speculations).
- `prefetch.ts` - async prefetch ladder level (`createPrefetchLevel`).
- `metrics.ts` - `createMetricsCollector`, hit-rate snapshots, and a bounded rolling hit-rate series
  (`hitRateHistory()`, capacity via `MetricsCollectorOptions`).
- `clock.ts` / `scheduler.ts` - injectable `systemClock`, `createIdleScheduler`, and the manual
  variants.
- `testing.ts` (`@sre/core/testing`) - `createTestHarness` + `drain`: deterministic engine with a
  manual scheduler + fake clock.

## @sre/react layout

- `defineSpeculativeUI.tsx` - the facade. Wires engine + prefetch cache + materializer + View
  Transitions and owns cache-aware rendering. Config takes `predict` plus optional `learn`/`observe`,
  forwarded to the engine predictor so history-learning predictors work end-to-end (see
  [decisions/0003](./decisions/0003-facade-learning-api.md)). The primary API.
- `context.tsx` - `SpeculationProvider`, engine context.
- `hooks.ts` - `useSpeculation`, `useTrajectory`, `useObserve`, `useSetContext`, `useEngine`.
- `commit.ts` - `useCommit`, `useTransitionalCommit`.
- `materializer.ts` - `createReactMaterializer` (the materialize rung's React bridge).
- `Stage.tsx` - `SpeculationStage`, renders the committed intent; must be inside the provider.
- `transition.ts` - `withViewTransition`, reversible View Transitions layer.

## Data flow

1. Host feeds signals (`useObserve`) and pushes UI state (`useSetContext` -> `context.appContext`).
2. `predict(context)` returns ranked `Prediction[]`.
3. Engine reconciles the speculation pool against predictions, promoting toward `targetLevel`
   within budget along the ladder `compose -> prefetch -> materialize`.
4. `commit(intent)` reveals the matching speculation instantly (warm hit) or fetches cold, inside a
   view transition; wrong bets are evicted.
5. Departed trajectory states stay warm as return-candidates, so undo/redo resolve instantly.

## Demo (`packages/demo`)

A Vite app that makes the engine visible. The **Concept Lab** is a workspace of surfaces grouped
into activity clusters (Analyzing, Reporting, Creating, Designing, Exploring); hovering or opening a
surface lights its concept, activation spreads to sibling surfaces in the cluster (they pre-warm),
and committing reveals a warmed surface instantly. A live **concept-activation vector** is the
visual star. A **warm-vs-cold race** dramatizes the latency win (same intent revealed warm and cold
side by side), and a **hit-rate sparkline** tracks warm-serve rate over time.

The demo injects a `performance.now`-based clock into the predictor so `observe`, `predict`, and
`conceptActivation` share one time base (see [gotchas.md](./gotchas.md)).
