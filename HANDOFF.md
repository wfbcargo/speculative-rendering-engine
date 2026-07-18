# HANDOFF

Bootstrap context for a fresh session.

## What this is

The Speculative Rendering Engine (SRE): a speculative-execution runtime for UIs. Read `README.md`
for the concept and `AGENTS.md` for the usage contract. The design memory is in `.wiki/` (start at
`.wiki/README.md`).

## Where things are

- `packages/core` - `@sre/core`, the framework-agnostic engine (predict / prepare / commit /
  evict lifecycle, budget, metrics, injectable clock + scheduler, the Markov and graph predictors,
  and `@sre/core/testing`). Zero DOM, zero React.
- `packages/react` - `@sre/react`, the React adapter and the `defineSpeculativeUI` facade.
- `packages/demo` - the Vite Concept Lab showcase.

## The design decisions that matter

- `.wiki/decisions/0001` - determinism via injected clock + scheduler (R-002).
- `.wiki/decisions/0002` - framework-agnostic core, React as the first adapter (R-004).
- `.wiki/decisions/0003` - the facade `learn`/`observe` learning API.
- `.wiki/decisions/0004` - the graph-activation predictor (the star). The activation math
  (spreading + fan-out + dual decay + determinism) is where the risk concentrates; it is unit
  tested exhaustively with a fake clock.

## Gate order

`pnpm -r build` -> `pnpm -r typecheck` -> `pnpm -r test`. Libraries must build before a
workspace typecheck resolves cross-package imports.

## Known trap

Inject a `performance.now`-based clock into the graph predictor in any browser demo, so that
`observe` (signal timestamps), `predict`, and `conceptActivation` share one time base. Mixing a
`Date.now` default clock with `performance.now` demo timestamps decays activation to ~0 (a real bug
that has bitten this project). See `.wiki/gotchas.md`.
