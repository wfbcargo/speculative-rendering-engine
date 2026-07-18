# 0004 - Graph-activation predictor

Status: accepted
Date: 2026-07-18
Supersedes: none (extends the `Predictor` contract; complements `createDefaultPredictor`)

## Context

`predict(context) => Prediction[]` is otherwise an opaque function. To be developed further:
authored by LLMs, tuned by humans, inspected by tooling, prediction needs a **standardized, legible
data structure** the function runs over, not more ad-hoc code.

The chosen structure is a **typed, weighted, directed knowledge graph with spreading activation**:
the branch-predictor analogy made concrete as a semantic network (Collins & Loftus; the
associative-strength half of ACT-R). `createDefaultPredictor` (first-order Markov over component
transitions) is the degenerate case: one node kind, one edge kind, weights tuned only by usage, no
authored topology, no spreading. This decision generalizes it.

This graph is a *better source* for the same `{ intent, probability }[]` the engine already
consumes. Nothing downstream changes: `createGraphPredictor` implements the existing `Predictor`
interface (`observe?`, `learn?`, `predict`) and drops into the `defineSpeculativeUI` facade's
`predict`/`learn`/`observe` config (see 0003).

## Decision

### Node kinds (3)

- **concept** - an abstract activity the user is engaged in. Drawn from a small **controlled
  vocabulary** (see below). The live "how lit is each concept" vector is the compressed,
  human-readable predictive state.
- **action** - a verb the user performs (e.g. `use`, `hover`, `compare`, `open`).
- **component** - a renderable unit that maps to a committable `Intent`.

### Concept vocabulary (controlled, activity-axis)

Concepts are **activities** (gerunds, "what the user is doing"), one consistent kind so LLM
classification is reliable. Default core set (developer-overridable, but a *closed* vocabulary: map
into it, do not mint freely):

| Concept | The user is... |
| --- | --- |
| Administering | managing accounts, permissions, settings, org config |
| Reporting | assembling / viewing summaries, dashboards, exports |
| Creating | bringing a new entity into existence |
| Exploring | browsing, sampling, sandboxing without commitment |
| Onboarding | first-run, setup, guided learning of the product |
| Editing | changing an existing entity's content |
| Analyzing | comparing, drilling into, interrogating data |
| Designing | arranging layout, style, visual structure |
| Rewarding | recognition, incentives, gamification, achievements |
| Protecting | security, backup, validation, guardrails |

### Edges (directed, weighted, two classes)

- **authored** - structural, static, developer/LLM-defined. `{ from, to, weight }`.
- **learned** - emergent, usage-created via `learn(from, to)` on commit. Directional (A->B != B->A).
  Created only after **support threshold** N co-occurrences; start weak; weighted by confidence;
  **forget** via temporal decay; distinct class from authored; **no auto-promotion to authored** in
  this version (a v2 avenue).

### Strengthening rules

`{ action, target (component), concept, gain }`. When `action` is observed on `target`, add `gain`
activation toward `concept`; from `concept`, activation spreads to the components bonded to it. This
encodes "when the user *uses* the *report* component, strengthen *Reporting* across everything bonded
to it."

### Spreading activation (relational)

Iterative propagation from seeded nodes:

- **Geometric per-hop decay.** `A[j] += A[i] * W[i,j] * D`, default **D = 0.25** (aggressive/local
  on purpose: a UI predictor wants tight, confident clusters, not diffuse warming; 2 hops and it is
  effectively dead).
- **Fan-out normalization (on by default).** Divide each contribution by the source node's out-degree
  (`* 1 / deg_out(i)`): the fan effect. Without it, hub concepts (bonded to many components)
  over-broadcast. This is the knob that makes the "spread to all nodes within report" example behave.
  Exposed as the `fanOut` config flag (default `true`); disabling it (`fanOut: false`) is reserved for
  demonstrating the over-broadcast failure mode and degrades prediction quality in production.
- **Firing threshold F.** A node whose newly-received activation is below F does not propagate
  further (and, below a floor, is dropped).
- **Hop cap.** `maxHops` (default 3) bounds propagation regardless of decay.

### Temporal decay (base-level)

Orthogonal to relational decay. Node base-level activation and learned-edge weight decay over **time
since last reinforcement** by a **hyperbolic half-life** law: `factor = halfLife / (halfLife + elapsed)`,
equivalently `(1 + elapsed / halfLife)^-1`. This is non-exponential (activation at two half-lives is
`1/3`, not `1/4`) and honors the configured half-life, so a concept lit a while ago cools and unused
learned edges fade. Parameterized by a half-life in clock units (`temporalHalfLife` / `forgetHalfLife`).
The general ACT-R power law (`t^-d` with a tunable exponent) is a later avenue behind the same config.

### Determinism (R-002)

The predictor is an engine path: it MUST NOT call `Date.now()` / real timers. Time comes from an
**injected `clock`** (default `systemClock` in prod, manual clock in tests) and/or `signal.at` on
observed signals. `predict` is pure given the clock, so the full lifecycle (pump, spread, decay,
forget) is unit-tested with a fake clock and manual scheduler via `@sre/core/testing`.

### Output

`predict(context)`:
1. Apply temporal decay to current activation for elapsed clock time.
2. Seed from currently-active concepts + `context.current` + `context.prior`.
3. Spread (geometric decay, fan-out, threshold, hop cap) over authored union learned edges.
4. Collect **component-node** activations, map each to an `Intent` via `intentFor`, exclude the
   current intent, normalize to probabilities, return ranked.

An intent = a single component node in this version. The lit-subgraph / spatial-arrangement idea is
deferred to the reveal layer (association decides *what*; the render decides *where*).

## API as shipped (`@sre/core`)

```ts
type GraphNodeKind = 'concept' | 'action' | 'component'
interface GraphNode { id: string; kind: GraphNodeKind }
interface AuthoredEdge { from: string; to: string; weight: number }
interface StrengtheningRule { action: string; target: string; concept: string; gain: number }

interface GraphPredictorConfig {
  concepts?: string[]
  nodes: GraphNode[]
  edges: AuthoredEdge[]
  rules: StrengtheningRule[]
  intentFor: (componentId: string) => Intent
  decay?: { hopFactor?: number; threshold?: number; maxHops?: number; fanOut?: boolean; temporalHalfLife?: number }
  learning?: { supportThreshold?: number; initialWeight?: number; forgetHalfLife?: number }
  clock?: Clock
}

function createGraphPredictor(config: GraphPredictorConfig): GraphPredictor

interface GraphPredictor extends Predictor {
  conceptActivation(now?: number): { concept: string; level: number }[]
}
```

`observe(signal)` maps a signal to an action + target, applies strengthening rules, pumps activation
(stamped with clock/`signal.at`). `learn(from, to)` reinforces a directional learned edge, respecting
the support threshold. `predict(context)` runs the pipeline above. `conceptActivation(now?)` exposes
the decayed concept base-level vector, the "compressed human-readable predictive state" named above,
so consumers (instrumentation, the demo) read it directly instead of re-deriving the pump/decay.
Callers pass a `now` on the same time base as the injected `clock`/`signal.at`.

## Consequences

- The predictor becomes a **data structure + fixed algorithm**, not bespoke code: LLM-authorable,
  human-diffable, tooling-visualizable, the original goal.
- Backward compatible: `createDefaultPredictor` stays; `createGraphPredictor` is additive.
- Risk concentrated in the activation math (fan-out + dual decay + determinism). Mitigated by
  exhaustive deterministic tests; a subtly-wrong activation function is worse than none.

## Alternatives considered

- **Random-walk-with-restart / personalized PageRank** - principled, degree-aware, self-normalizing,
  no hand-tuned constants. Rejected for v1 as **opaque**: it defeats the legibility goal. Filed as a
  later optimization behind the same `Predictor` interface.
- **Logarithmic hop decay** - the intuitive "16 -> 4 -> 1" is in fact *geometric* (x1/4); true
  logarithmic decay is flatter and spreads too far. Rejected.
