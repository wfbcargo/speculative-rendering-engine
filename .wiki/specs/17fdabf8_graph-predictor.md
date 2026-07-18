---
spec_id: 17fdabf8
slug: graph-predictor
epic: b47bbbe8_sre-engine
status: implemented
---

# Spec: graph-activation predictor (the star)

## Objective

Implement `createGraphPredictor` in `packages/core/src/graph-predictor.ts` exactly per
[ADR 0004](../decisions/0004-graph-activation-predictor.md): prediction as a typed, weighted,
directed knowledge graph over which a fixed spreading-activation algorithm runs. It implements the
existing `Predictor` interface from `@sre/core` (Spec A, already merged) and drops into the engine
and the facade unchanged. The concept-activation vector is the compressed, human-readable predictive
state and the visual star of the demo. Deterministic via injected `clock` (R-002). No source
comments (R-001). No em dashes anywhere.

## Deliverables

1. **`src/graph-predictor.ts`**:
   - Graph type surface per ADR 0004: `GraphNodeKind = 'concept' | 'action' | 'component'`,
     `GraphNode`, `AuthoredEdge`, `StrengtheningRule`, `GraphPredictorConfig`, `GraphPredictor`
     (extends `Predictor` with `conceptActivation(now?): { concept; level }[]`).
   - `defaultConcepts` = the closed controlled activity vocabulary from ADR 0004 (Administering,
     Reporting, Creating, Exploring, Onboarding, Editing, Analyzing, Designing, Rewarding,
     Protecting).
   - `createGraphPredictor(config)`:
     - `observe(signal)`: map signal -> action + target (component), apply matching
       `StrengtheningRule`s to pump activation toward the concept, stamped with `clock.now()` or
       `signal.at`.
     - `learn(from, to)`: reinforce a directional learned edge, respecting the support threshold
       (N co-occurrences before creation), start weak, distinct class from authored, no
       auto-promotion.
     - `predict(context)`: (1) apply temporal power-law decay for elapsed clock time; (2) seed from
       active concepts + `context.current` + `context.prior`; (3) spread over authored union learned
       edges with geometric per-hop decay (default D = 0.25), REQUIRED fan-out normalization
       (divide each contribution by source out-degree), firing threshold, and hop cap
       (default maxHops = 3); (4) collect component-node activations, map each via `intentFor`,
       exclude the current intent, normalize to probabilities, return ranked `Prediction[]`.
     - `conceptActivation(now?)`: the decayed concept base-level vector.
   - Determinism: NO `Date.now()` / real timers; time only from injected `clock` (default the core
     `systemClock`) and `signal.at`. `predict` is pure given the clock.
2. **`src/index.ts`**: add exports for `createGraphPredictor`, `defaultConcepts`, and the `Graph*`
   types (append to the existing Spec A export block; do not remove or reorder existing exports).
3. **Tests** (`src/graph-predictor.test.ts`, vitest, deterministic via `createManualClock`):
   - A lit concept spreads activation to its bonded sibling components (cluster pre-warm).
   - Fan-out normalization: a hub concept bonded to many components does NOT over-broadcast versus a
     low-degree one (assert the normalization actually divides by out-degree).
   - Geometric decay: activation at hop 2 is ~D^2 of the seed contribution; beyond `maxHops` it does
     not propagate.
   - Firing threshold: a contribution below F does not propagate further.
   - Temporal power-law decay: a concept lit then left idle for elapsed clock time cools; a learned
     edge left unreinforced fades (forget half-life).
   - Learned edges: created only after the support threshold; directional (A->B != B->A).
   - `predict` output: ranked, normalized to probabilities, excludes `context.current`, maps
     components via `intentFor`.
   - `conceptActivation(now)` reflects the decayed vector on the same time base.

## Acceptance criteria

- [x] `pnpm -C packages/core build`, `typecheck`, and `test` all green (existing Spec A tests still pass).
- [x] `createGraphPredictor` implements `Predictor` and matches the ADR 0004 API signature exactly.
- [x] Fan-out normalization, geometric per-hop decay, firing threshold, hop cap, and power-law temporal decay are all present and unit-proven.
- [x] Determinism: no `Date.now()` / real timers; all time via injected `clock` / `signal.at` (R-002).
- [x] No source comments (R-001); intent keys stable/unique (R-003); no changes outside `packages/core/src/graph-predictor.ts`, its test, and appended `index.ts` exports.
- [x] `.wiki/specs/17fdabf8_graph-predictor.md` status flipped to `implemented` at close.

## Notes

- The core public surface from Spec A is in `packages/core/src/index.ts` / `types.ts`. Import
  `Predictor`, `Intent`, `Prediction`, `PredictContext`, `Signal`, `Clock`, `systemClock` from there.
- A subtly-wrong activation function is worse than none; the tests are the deliverable as much as
  the code. Prove the math, do not just exercise it.
