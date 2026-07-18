# 0001 - Deterministic engine via injected clock and scheduler

Date: 2026-07-18
Status: accepted

## Context

The speculation lifecycle is inherently concurrent: promotion, eviction, abort, budget enforcement,
and commit all interleave with timing. Testing that against real timers and idle callbacks is flaky
and slow, and couples the engine to a browser environment.

## Decision

The engine takes its `Clock` and `IdleScheduler` by injection (`@sre/core/types`). Production uses
`systemClock` + `createIdleScheduler`; tests use a fake clock + `createManualScheduler`, driven
through `@sre/core/testing` (`createTestHarness` + `drain`). Engine paths never call `Date.now()` or
`requestIdleCallback` directly.

## Consequences

- The full concurrent lifecycle is unit-tested deterministically: no timers, no DOM, no flakiness.
- Engine code stays environment-agnostic.
- Encoded as R-002. Any new engine path that reaches for wall-clock time or real scheduling is a
  violation.
