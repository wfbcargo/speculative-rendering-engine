# 0002 - Framework-agnostic core, React as the first adapter

Date: 2026-07-18
Status: accepted

## Context

SRE speculates over futures. UI rendering is one kind of future, but the same machinery (predict /
prepare / commit / evict) applies to data, computation, or any preparable work. Baking React or the
DOM into the engine would foreclose those uses and make the runtime hard to test.

## Decision

`@sre/core` is framework-agnostic with zero DOM and zero React. What a speculation *prepares* and
how it is *committed* are consumer-supplied callbacks (`LadderLevel.prepare`/`evict`). UI
materialization lives entirely in `@sre/react` as the first adapter, surfaced through the
`defineSpeculativeUI` facade. Consumers build through the facade; they drop to `@sre/core` only for
a non-React host.

## Consequences

- Dependency direction is strict: `core <- react <- demo`. The core must not import the adapter.
- The default UI ladder (`compose -> prefetch -> materialize`) is an adapter concern, not an engine
  primitive.
- Encoded as R-004.
