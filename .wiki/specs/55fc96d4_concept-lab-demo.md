---
spec_id: 55fc96d4
slug: concept-lab-demo
epic: b47bbbe8_sre-engine
status: implemented
---

# Spec: Concept Lab demo (the standalone showcase)

## Objective

Build `packages/demo` (`@sre/demo`): a Vite + React app that makes the engine visible and is the
repo's flagship showcase. It is backed by `createGraphPredictor` (Spec B) through the
`defineSpeculativeUI` facade (Spec C). Three exhibits: the **Concept Lab** (surfaces cluster around
activity concepts; interacting lights a concept, activation spreads so sibling surfaces pre-warm
before they are touched, committing reveals a warmed surface instantly), a live
**concept-activation vector** readout (the visual star), a **warm-vs-cold race** (same intent
revealed warm and cold side by side with a timing delta), and a **hit-rate sparkline**. Dark,
editorial "signal lab" aesthetic. No source comments (R-001). No em dashes anywhere.

## Wiring facts (from the merged engine; use exactly)

Facade `defineSpeculativeUI(config)` config fields:
- `predict(context) => Prediction[]` (required), `learn?(from, to)`, `observe?(signal)`.
- `fetch(intent) => Promise<data> | data`, `render(intent, data, meta) => ReactNode` (`meta.warm`
  is true on a cache hit), `renderLoading?(intent) => ReactNode`.
Facade returns `{ Provider, Stage, useCommit, useTransitionalCommit, useSetContext, useObserve,
useTrajectory, useSpeculation, useEngine }`.

`createGraphPredictor(config)` config: `{ concepts?, nodes, edges, rules, intentFor, decay?,
learning?, clock? }`.
- Concept node ids ARE the concept strings (e.g. `"Reporting"`). Authored edges reference node ids.
  `StrengtheningRule.target` is a component node id.
- `observe(signal)` reads `signal` as `{ type: <action>, at: <clockTime>, data: <componentId
  string> }` (a plain component-id string in `data` is accepted).
- `conceptActivation(now)` returns one entry per concept in `defaultConcepts` order, decayed to
  `now`.
- INJECT a `performance.now`-based clock into `createGraphPredictor` (`clock: { now: () =>
  performance.now() }`) so `observe`, `predict`, and `conceptActivation` share one time base. Do NOT
  let it default to `Date.now()` (see `.wiki/gotchas.md`: clock-base mismatch decays activation to 0).

## Deliverables

1. **`packages/demo`** scaffold: `package.json` (`@sre/demo`, private, Vite scripts `dev`/`build`/
   `typecheck`), `vite.config.ts` (React plugin; alias `@sre/core` and `@sre/react` to their package
   `src` so no prebuild is needed), `tsconfig.json` (extends base, DOM libs, jsx react-jsx),
   `index.html`, `src/main.tsx`. Add `react`, `react-dom`, `vite`, `@vitejs/plugin-react`,
   `@sre/core` (workspace:*), `@sre/react` (workspace:*) as appropriate deps/devDeps.
2. **`src/conceptGraph.ts`**: the curated graph config for `createGraphPredictor`. Clusters and 2-3
   component surfaces each, drawn from `defaultConcepts`:
   - Analyzing: Insights, Query, Cohorts
   - Reporting: Dashboard, Export, Summary
   - Creating: New Draft, Compose
   - Designing: Layout, Theme
   - Exploring: Gallery, Samples
   Authored edges bond each concept to its component surfaces (so a lit concept warms the cluster);
   strengthening rules bond hover/open on each surface to its concept. `intentFor(componentId)`
   returns a stable keyed `Intent` (R-003).
3. **`src/ConceptLab.tsx`**: its OWN `defineSpeculativeUI` instance backed by `createGraphPredictor`
   (with the injected `performance.now` clock). Surfaces rendered as a cluster grid of cards. On
   hover -> `observe({type:'hover', target})` pumps the concept; on open (click) -> `observe` +
   `commit(intentFor(id))`. As a concept heats, its sibling surfaces visibly warm (per-card heat
   state read from `useSpeculation`/the engine) BEFORE they are clicked. Committing a warm surface
   reveals it instantly in the `Stage` honoring the View Transition aesthetic.
4. **`src/ConceptVector.tsx`**: the live concept-activation readout, rendering
   `conceptActivation(performance.now())` as labelled warm-intensity bars, updating as the user
   interacts; the dominant concept is legible at a glance. The visual star.
5. **`src/WarmColdRace.tsx`**: on trigger, reveal the same intent both warm (from the pre-warmed
   pool) and cold (forced fresh fetch, bypassing the warm cache for that run) side by side, each
   showing time-to-reveal (ms) plus the delta. Demo-layer timing may use `performance.now()` (R-002
   constrains engine paths, not demo UI). The cold side must genuinely bypass the warm cache; the
   warm side must be a true hit.
6. **`src/Sparkline.tsx`** + hit-rate wiring: a bounded rolling hit-rate sparkline fed by the
   engine metrics (`hitRateHistory()` if surfaced, else track commits warm/cold in the demo).
7. **`src/App.tsx` + `src/styles.css`**: compose the three exhibits into one dark "signal lab"
   console. Cohesive, polished, responsive. Reduced-motion friendly.

## Acceptance criteria

- [ ] `pnpm -C packages/demo typecheck` and `pnpm -C packages/demo build` green; `pnpm -r build` still green.
- [ ] Concept Lab: hovering/opening a surface lights its concept and visibly pre-warms sibling surfaces in the cluster before they are touched.
- [ ] Live concept-activation vector readout updates on interaction; dominant concept legible at a glance.
- [ ] Committing a warm surface reveals it instantly; reveals honor View Transitions and reduced-motion.
- [ ] Warm-vs-cold race shows both reveals with time-to-reveal and a visible warm advantage; cold genuinely bypasses the warm cache.
- [ ] Hit-rate sparkline present and updating.
- [ ] Graph predictor is given a `performance.now` clock (no clock-base decay bug).
- [ ] No source comments (R-001); intent keys stable/unique (R-003); no changes to `@sre/core` or `@sre/react`.
- [ ] `.wiki/specs/55fc96d4_concept-lab-demo.md` status flipped to `implemented` at close.

## Notes

- Do NOT modify `packages/core` or `packages/react`. If the demo reveals a real engine/facade gap,
  STOP and escalate (it changes a shared surface).
- The demo aesthetic is the repo's own dark showcase; a separate, site-native version of the Concept
  Lab will be built later in the personal-site repo. Aim for something screenshot-worthy.
