---
spec_id: 86753a86
slug: core-engine
epic: b47bbbe8_sre-engine
status: implemented
---

# Spec: @sre/core engine foundation

## Objective

Build the framework-agnostic speculative-execution engine in `packages/core` (`@sre/core`,
`@sre/core/testing`): the full predict -> reconcile -> promote/demote/evict -> commit lifecycle, a
budget policy, a metrics collector with a rolling hit-rate series, injectable clock + scheduler, a
deterministic test harness, and the first-order Markov predictor. Zero DOM, zero React (R-004).
Every engine path deterministic via injection (R-002). No source comments (R-001). This is the
blocking foundation the graph predictor (Spec B) and the React facade (Spec C) build on.

## Deliverables

1. **`src/types.ts`** — the single source of truth for shared types:
   - `Intent` = `{ kind: string; key: string; payload?: unknown }`.
   - `Signal` = `{ type: string; at: number; data?: unknown }`.
   - `Prediction` = `{ intent: Intent; probability: number }`.
   - `Predictor` = `{ predict(context): Prediction[]; learn?(from: Intent | undefined, to: Intent): void; observe?(signal: Signal): void }`.
   - `PredictContext` = `{ current?: Intent; prior?: Intent; appContext?: unknown; trajectory?: Intent[] }`.
   - `LadderLevel<T>` = a fidelity rung: `{ name: string; prepare(intent, ctx): Promise<T> | T; evict?(intent, prepared): void }`.
   - `Speculation` = an intent being prepared with its current level/state.
   - `Clock` = `{ now(): number }`; `IdleScheduler` = `{ schedule(task): handle; cancel(handle): void }` (shape at implementer's discretion, but manual + system variants must satisfy it).
   - `BudgetPolicy`, `BudgetSnapshot`, `TelemetryEvent`, `CommitResult`.
   Keep names aligned with `.wiki/architecture.md` and `.wiki/glossary.md`.
2. **`src/clock.ts`** — `systemClock` (wraps whatever time base the host injects; the default may read a monotonic source) and `createManualClock(start?)` (advanceable) for tests. No `Date.now()` in any engine path (R-002); `systemClock` is the single sanctioned boundary.
3. **`src/scheduler.ts`** — `createIdleScheduler` (production; may use `requestIdleCallback`/`setTimeout` fallback, isolated here) and `createManualScheduler` (tests: tasks queue and run only when drained). The engine takes the scheduler by injection.
4. **`src/budget.ts`** — `createFixedBudget(caps)` and `createAdaptiveBudget(opts)` (device/concurrency-aware caps governing how many speculations occupy each rung). Pure given inputs.
5. **`src/metrics.ts`** — `createMetricsCollector(options?)`: records commits (warm/cold), exposes a hit-rate snapshot and a **bounded rolling `hitRateHistory()`** series (capacity via `MetricsCollectorOptions`). Deterministic.
6. **`src/predictor.ts`** — `createDefaultPredictor()`: first-order Markov over component transitions. Implements `Predictor`; `learn(from, to)` accumulates transition counts; `predict(context)` returns ranked normalized `{ intent, probability }` from `context.current`/`context.prior`/history. Deterministic; no wall-clock.
7. **`src/engine.ts`** — `createEngine(config)` returning `SpeculationEngine`. Responsibilities:
   - Hold the speculation pool; on new predictions, reconcile: promote toward each bet's target rung within budget along an injected ladder, demote/evict bets that fell out of prediction or budget.
   - `observe(signal)` forwards to `predictor.observe`; `setContext`/`predict` drive reconciliation.
   - `commit(intent)`: reveal the matching warm speculation instantly (`CommitResult` with `warm: true`) or prepare cold (`warm: false`); flush wrong bets; call `predictor.learn(prior, intent)`; record metrics; append to trajectory.
   - All timing via injected `clock`; all deferred work via injected `scheduler`. Emit `TelemetryEvent`s.
8. **`src/trajectory.ts`** — committed-path tracking + `computeReturnCandidates(trajectory, opts)` (recently departed states graded by recency, kept warm so undo/redo resolve instantly).
9. **`src/prefetch.ts`** — `createPrefetchLevel(fetch)`: a reusable async ladder level (the prefetch rung) usable by consumers/adapters.
10. **`src/testing.ts`** (`@sre/core/testing`) — `createTestHarness(config?)` wiring a `createManualClock` + `createManualScheduler` + engine, and `drain(harness)` to run all pending idle tasks to quiescence deterministically. The canonical way to test the engine.
11. **`src/index.ts`** — re-export the public surface (types, `createEngine`, predictors, budget, metrics, clock/scheduler factories, trajectory, prefetch). `testing.ts` is exported via the separate `./testing` entry, not from index.
12. **Tests** (`vitest`, via `@sre/core/testing`): lifecycle (predict -> promote -> commit warm hit; wrong-bet eviction; budget caps enforced), Markov history bias accumulates across repeated commits, metrics hit-rate + rolling history, return-candidates. All deterministic (manual clock + scheduler), no real timers, no DOM.

## Acceptance criteria

- [x] `pnpm -C packages/core build` and `pnpm -C packages/core typecheck` green.
- [x] `pnpm -C packages/core test` green; tests use `@sre/core/testing` (fake clock + manual scheduler), no real timers, no DOM.
- [x] No `Date.now()` / `requestIdleCallback` / real timers in any engine path outside the sanctioned `clock.ts`/`scheduler.ts` production factories (R-002).
- [x] Zero React/DOM imports in `@sre/core` (R-004); `packages/core/tsconfig.json` has no DOM lib and still typechecks.
- [x] No source comments anywhere (R-001); intent keys built from payload and unique (R-003).
- [x] Public API re-exported from `src/index.ts`; `@sre/core/testing` exposes `createTestHarness` + `drain`.
- [x] `.wiki/specs/86753a86_core-engine.md` status flipped to `implemented` at close.

## Notes

- The exact internal shapes of `Speculation`, `IdleScheduler`, `LadderLevel`, and `BudgetPolicy` are
  the implementer's call, but they must (a) satisfy determinism, (b) let the React facade in Spec C
  supply a `compose -> prefetch -> materialize` ladder without touching core, and (c) let the graph
  predictor in Spec B implement `Predictor` with an injected `clock`. Design the `Predictor` and
  `Clock` surfaces so ADR 0004's `createGraphPredictor` slots in unchanged.
- Keep the public type names consistent with `.wiki/architecture.md`; downstream specs import them.
