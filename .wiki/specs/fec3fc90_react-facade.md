---
spec_id: fec3fc90
slug: react-facade
epic: b47bbbe8_sre-engine
status: implemented
---

# Spec: @sre/react facade

## Objective

Build the React adapter and the `defineSpeculativeUI` facade in `packages/react` (`@sre/react`): the
primary API consumers use to build a speculative UI on top of `@sre/core` (Spec A, merged). It wires
the engine + a prefetch/materialize cache + a React materializer + View Transitions, owns cache-aware
rendering, and forwards `learn`/`observe` to the predictor per
[ADR 0003](../decisions/0003-facade-learning-api.md). React/DOM live ONLY here, never in core
(R-004). No source comments (R-001). No em dashes anywhere.

## Deliverables

1. **`src/defineSpeculativeUI.tsx`** - the facade. `defineSpeculativeUI(config)` returns an object
   with `{ Provider, Stage, useCommit, useSetContext, useObserve, useTrajectory, useSpeculation }`
   (plus `engine` access for instrumentation). Config:
   - `predict(context) => Prediction[]` (required; wrapped by a dev duplicate-key guard per R-003).
   - `learn?(from, to)` and `observe?(signal)` (optional; forwarded to the engine predictor, ADR 0003).
   - `fetch(intent) => Promise<data> | data` (how a speculation is prepared / the prefetch rung).
   - `render(intent, data, meta) => ReactNode` (`meta.warm` tells hit vs cold).
   - `renderLoading?(intent) => ReactNode` (shown while a cold intent resolves).
   - Supplies the engine a `compose -> prefetch -> materialize` ladder built from `fetch` + the
     React materializer (the ladder is an adapter concern, not core, per ADR 0002).
2. **`src/context.tsx`** - `SpeculationProvider` and the engine React context.
3. **`src/hooks.ts`** - `useSpeculation` (current pool / warm state), `useTrajectory`, `useObserve`,
   `useSetContext` (push UI state to `context.appContext` so `predict` can see it).
4. **`src/commit.ts`** - `useCommit` and `useTransitionalCommit` (commit inside a View Transition).
5. **`src/materializer.ts`** - `createReactMaterializer`: the materialize rung's React bridge (holds
   rendered/warmed output keyed by intent, surfaced to `Stage`).
6. **`src/transition.ts`** - `withViewTransition`: a reversible View Transitions wrapper that
   degrades gracefully when `document.startViewTransition` is unavailable (and respects
   `prefers-reduced-motion`).
7. **`src/Stage.tsx`** - `SpeculationStage`: renders the committed intent from the materializer;
   defaults the slot `view-transition-name` to `sre-current`, overridable via
   `viewTransitionName={null}`. Must be inside the provider (dev warns on orphan prepare).
8. **`src/index.tsx`** - re-export the public surface (`defineSpeculativeUI`, the hooks, `Stage`
   types, `createReactMaterializer`, `withViewTransition`).
9. **Tests** (vitest, jsdom): a smoke/behavioral test that mounts `Provider` + `Stage`, commits an
   intent, and asserts the rendered output; a test that a warm (pre-fetched) intent renders with
   `meta.warm === true` and a cold one goes `renderLoading` then `render` with `meta.warm === false`;
   a test that `learn`/`observe` are forwarded (a stateful predictor accumulates). Configure vitest
   `environment: 'jsdom'` and add `@testing-library/react` + `jsdom` as devDependencies. Guard the
   View Transition path so tests pass without `document.startViewTransition`.

## Acceptance criteria

- [x] `pnpm -C packages/react build`, `typecheck`, and `test` all green.
- [x] Facade exposes `Provider`, `Stage`, `useCommit`, `useSetContext`, `useObserve`, `useTrajectory`, `useSpeculation`; `predict` required, `learn`/`observe` optional and forwarded (ADR 0003).
- [x] Cache-aware rendering: warm commit renders instantly with `meta.warm === true`; cold path shows `renderLoading` then `render` with `meta.warm === false` (do not load data inside `render`).
- [x] View Transitions used for commits, degrading gracefully without `startViewTransition` and under `prefers-reduced-motion`.
- [x] `@sre/core` is consumed as the dependency (no engine logic reimplemented here); React/DOM stays out of core (R-004).
- [x] No source comments (R-001); intent keys stable/unique (R-003); changes confined to `packages/react/`.
- [x] `.wiki/specs/fec3fc90_react-facade.md` status flipped to `implemented` at close.

## Notes

- Import the engine surface from `@sre/core`: `createEngine`, `EngineConfig`, `SpeculationEngine`,
  `Intent`, `Signal`, `Prediction`, `Predictor`, `LadderLevel`, `LadderContext`, `systemClock`,
  `createIdleScheduler`. The engine climbs the ladder one rung per scheduler pass; a bet is warm when
  `currentLevel >= targetLevel` (`targetLevel = floor(probability * ladder.length)`, overridable via
  `EngineConfig.targetLevelFor`). A cold `commit` returns a `CommitResult` whose prepared value may
  be pending; await it before revealing.
- `@sre/core` exports point at its TypeScript source (its package.json `exports` map), so
  `@sre/react` typechecks against core without a prior build; still, run `pnpm -r build` if a stale
  resolution appears.
- Do NOT touch `packages/core`. If you find you need a core change, STOP and escalate (it would
  change a shared surface another spec depends on).
