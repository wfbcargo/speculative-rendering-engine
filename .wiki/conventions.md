# Conventions

## Source

- **No comments in any source file** (`.ts`/`.tsx`/`.css`/`.json`). Self-documenting names only.
  Markdown docs are fine. (See R-001.)
- TypeScript `strict`. Prefer `import type` for type-only imports.
- ESM only; `module: ESNext`, `moduleResolution: Bundler`, target `ES2022`.
- Descriptive names over abbreviations; break complex logic into small named functions rather than
  explaining it.
- Never use em dashes in source, comments-that-do-not-exist, or docs. Use a colon, comma,
  parentheses, or a period.

## Determinism

- Engine paths never call `Date.now()`, `requestIdleCallback`, or real timers directly. `clock` and
  `scheduler` are injected (`systemClock` / `createIdleScheduler` in production, manual variants in
  tests). (See R-002, [decisions/0001](./decisions/0001-deterministic-engine-via-injection.md).)

## Intents & keys

- Intent keys must be **stable and unique**: same intent -> same key across renders; distinct
  intents never collide. Build keys from payload, e.g. `` `page:${id}` ``. (See R-003.)

## Naming

- Factory functions: `create*` (`createEngine`, `createFixedBudget`, `createMetricsCollector`,
  `createGraphPredictor`).
- React hooks: `use*`. Facade members: `Provider`, `Stage`, `useCommit`, `useSetContext`,
  `useObserve`, `useTrajectory`, `useSpeculation`.
- Package module names: `@sre/<pkg>`.

## Testing

- Use `@sre/core/testing` (`createTestHarness` + `drain`) for deterministic engine tests: no real
  timers, no DOM, no flakiness. The graph predictor's activation math (spreading, fan-out, dual
  decay, threshold, hop cap) is unit tested with a fake clock; a subtly-wrong activation function is
  worse than none.

## Tooling commands

```bash
pnpm -r build                     # build order: core -> react -> demo
pnpm -C packages/<pkg> test       # core | react
pnpm -C packages/<pkg> typecheck  # core | react | demo
pnpm -C packages/<pkg> build      # core | react | demo
pnpm -C packages/demo dev
```

Authoritative gate order: `pnpm -r build` -> `pnpm -r typecheck` -> `pnpm -r test` (libraries must
build before a workspace typecheck resolves cross-package imports; see gotchas).
