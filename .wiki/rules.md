# Active Project Rules

## R-001 — No comments in any source file
Added: 2026-07-18 | Source: conventions.md
Source files (`.ts`/`.tsx`/`.css`/`.json`) carry zero comments. Code is self-documenting through
clear naming and small focused functions. If code seems to need a comment, refactor it instead.
Markdown docs are exempt.

## R-002 — Engine paths are deterministic via injection
Added: 2026-07-18 | Source: decisions/0001-deterministic-engine-via-injection.md
Never call `Date.now()`, `requestIdleCallback`, or real timers in engine paths. Take `clock` and
`scheduler` by injection so the full concurrent lifecycle (promotion, eviction, abort, budget,
commit) is unit-tested with a fake clock and manual scheduler via `@sre/core/testing`.

## R-003 — Intent keys are stable and unique
Added: 2026-07-18 | Source: conventions.md
The same intent must produce the same key across renders; two distinct intents must never collide.
Build keys from payload (e.g. `page:${id}`). Duplicate keys from `predict` trigger a dev warning.

## R-004 — Build via the facade; the core stays framework-agnostic
Added: 2026-07-18 | Source: decisions/0002-core-react-split.md
Consumers build UIs through `defineSpeculativeUI` (`@sre/react`). `@sre/core` stays free of DOM and
React: drop to it only for a non-React host. Do not leak React/DOM concerns into `core`.
