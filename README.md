# Speculative Rendering Engine (SRE)

A speculative-execution runtime for user interfaces. SRE is a **branch predictor for intent**:
it observes what the user is doing, predicts the ranked set of next intents, prepares them at
graded fidelity during idle time within a budget, and reveals the matching one **instantly** on
commit, discarding the rest.

```
observe  ->  predict  ->  prepare (idle, budgeted)  ->  reveal (instant)  ->  evict wrong bets
```

Modern UIs fetch and render *after* the user acts. SRE moves that work *before* the act, on
speculation, so the common path is already warm when the user commits to it. The same machinery
speculates over data, computation, or rendered UI alike: what a speculation *prepares* and how it
is *committed* are consumer-supplied callbacks, so the engine core is framework-agnostic.

## The star: a graph-activation predictor

Prediction is not opaque code. It is a **typed, weighted, directed knowledge graph** with
spreading activation over three node kinds: **concepts** (activities the user is doing, a closed
controlled vocabulary), **actions** (verbs the user performs), and **components** (renderable units
that map to committable intents). Interacting with a component pumps activation into its concept;
activation spreads to the sibling components bonded to that concept, so a whole cluster of surfaces
pre-warms before the user touches it. The live "how lit is each concept" vector is the compressed,
human-readable predictive state.

See [`.wiki/decisions/0004-graph-activation-predictor.md`](.wiki/decisions/0004-graph-activation-predictor.md)
for the full algorithm (geometric per-hop decay, fan-out normalization, power-law temporal decay,
determinism).

## Packages

| Package | Module | Role |
| ------- | ------ | ---- |
| `packages/core` | `@sre/core`, `@sre/core/testing` | Framework-agnostic engine. Zero DOM, zero React. |
| `packages/react` | `@sre/react` | React adapter + `defineSpeculativeUI` facade. |
| `packages/demo` | `@sre/demo` | Vite "Concept Lab" showcase. |

Dependency direction is strict: `core <- react <- demo`. The core never imports the adapter.

## Develop

```bash
pnpm install
pnpm -r build          # build order: core, then react, then demo
pnpm -r typecheck
pnpm -r test           # deterministic engine tests (fake clock + manual scheduler)
pnpm -C packages/demo dev
```

## Status

Fresh start (v0.1). The pure engine plus a single flagship visualization (Concept Lab + warm-vs-cold
race + hit-rate sparkline). A native version of the Concept Lab also runs at
[paullovy.com/lab](https://paullovy.com/lab).

MIT licensed.
