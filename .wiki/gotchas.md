# Gotchas

Non-obvious pitfalls. Things that bite once.

## Clock-base mismatch decays activation to ~0
The graph predictor's temporal decay is computed from elapsed clock time. If `observe` stamps
signals with `performance.now()` but the predictor's default clock is `Date.now()` (a ~13-digit ms
epoch vs a small since-page-load number), the elapsed delta is astronomically large and every
activation decays to nothing. In any browser consumer (the demo, the site lab), inject a
`performance.now`-based clock into `createGraphPredictor` so `observe` (`signal.at`), `predict`, and
`conceptActivation(now)` all share one time base. This has bitten the project before; do not
reintroduce it.

## `<Stage>` must be inside `<Provider>`
If a speculation reaches the materialize rung with no `<sre.Stage>` mounted, it never resolves
(silent stall). The facade logs an orphan-prepare warning in dev. Always mount both `Provider` and
`Stage`.

## `predict` only sees `context.appContext`
The predictor cannot read React state directly. Push UI state (hover/select) via `useSetContext` so
predictions can react to it. Forgetting this makes predictions look "stuck."

## Don't load data inside `render`
The facade owns cache-aware rendering. Supply `fetch` and let the engine warm the cache;
`render(intent, data, meta)` is called with warm data instantly on a hit (`meta.warm === true`), or
`renderLoading` while cold then `render` with `meta.warm === false`. Writing your own data-loading
hook inside `render` defeats speculation.

## Whole-slot vs per-component transitions
`<sre.Stage />` defaults the slot's `view-transition-name` to `sre-current` (whole-slot crossfade).
For elements that should persist beside changing panels (e.g. a chart), pass
`<sre.Stage viewTransitionName={null} />` so individual elements own their transitions.

## Workspace typecheck needs libs built first
`@sre/react` (and `demo`) resolve `@sre/core` across packages. A cold `pnpm -r typecheck` can fail
with "Cannot find module '@sre/core'" if nothing is built. Run `pnpm -r build` first: the
authoritative order is build -> typecheck -> test. (Source-alias consumers like the demo can
sidestep this via `tsconfig` `paths` / Vite aliases to source.)

## Fan-out normalization is not optional
Spreading activation divides each contribution by the source node's out-degree. Without it, hub
concepts bonded to many components over-broadcast and the whole graph lights up uniformly (no useful
prediction). It is the knob that keeps clusters tight. See ADR 0004.
