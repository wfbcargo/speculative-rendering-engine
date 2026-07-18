# 0003 - Facade learning API (`learn`/`observe`)

Date: 2026-07-18
Status: accepted

## Context

The engine (`packages/core/src/engine.ts`) invokes `predictor.learn?.(from, to)` on every commit and
`predictor.observe?.(signal)` on every raw signal. `@sre/core` ships a stateful first-order Markov
predictor (`createDefaultPredictor`) built around those hooks.

If the `defineSpeculativeUI` facade collapses its config into `const predictor: Predictor = { predict }`,
it drops `learn` and `observe`. A learning predictor wired through the facade would then never
accumulate history: navigation history could not pre-warm likely next intents without a hover.

## Decision

The `SpeculativeUIConfig` carries two optional fields alongside the required `predict`:

- `learn?: (from: Intent | undefined, to: Intent) => void`
- `observe?: (signal: Signal) => void`

The facade forwards both to the engine's predictor: `{ predict: guardedPredict, learn, observe }`.
The duplicate-key dev guard still wraps `predict` only.

Chosen over a full `predictor?: Predictor` alternative because keeping `predict` as the single
required blending point is more composable: consumers hold a stateful model (e.g.
`createDefaultPredictor` or `createGraphPredictor`), forward `learn`/`observe`, and blend
`model.predict(context)` with other signals (hover, compare, ambient) inside their own `predict`.

## Consequences

- Backward compatible: `predict`-only configs are unchanged; both new fields are optional.
- History-based pre-warming is possible end-to-end through the facade.
- `@sre/core` public types are untouched: `Predictor` already declares `learn`/`observe`.
