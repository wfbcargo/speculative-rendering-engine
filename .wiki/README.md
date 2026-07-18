# SRE Project Wiki

Durable, committed memory for the Speculative Rendering Engine (SRE) monorepo. Read for context;
extend when you discover knowledge worth keeping past a branch. Default is omit: keep it small and
true.

## Index

- [architecture.md](./architecture.md) — package layout, module boundaries, data flow.
- [conventions.md](./conventions.md) — coding conventions, naming, formatting.
- [rules.md](./rules.md) — active project rules read by every sub-agent at spawn.
- [gotchas.md](./gotchas.md) — non-obvious pitfalls.
- [glossary.md](./glossary.md) — domain terms.
- [decisions/](./decisions/) — architectural decision records (ADR-style).
- [specs/](./specs/) — per-spec notes that outlive their branch.

## Orientation (not wiki content, but where to start)

- `README.md` (repo root) — what SRE is and the core concepts.
- `AGENTS.md` (repo root) — the usage contract: the golden path and the facade config.
- `HANDOFF.md` (repo root) — bootstrap context for a fresh session.
- `packages/react/src/defineSpeculativeUI.tsx` — the facade, the primary entry point (once built).

## Scope (v0.1, fresh start)

The pure engine plus one flagship visualization. Two predictors in `@sre/core`:
`createDefaultPredictor` (first-order Markov) and `createGraphPredictor` (graph activation, the
star). The `@sre/react` facade wires engine + prefetch cache + materializer + View Transitions.
`@sre/demo` ships the **Concept Lab** (surfaces clustering around activity concepts, with a live
concept-activation readout), a **warm-vs-cold race**, and a **hit-rate sparkline**.

This repo deliberately excludes the application/product tier that a prior iteration grew (an
ad-platform that hid the engine). The engine here is the visible star, not invisible plumbing.
