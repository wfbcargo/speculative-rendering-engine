import type { Clock, ManualClock } from "./types.js";

interface MonotonicSource {
  now(): number;
}

function resolveMonotonicSource(): MonotonicSource {
  const host = globalThis as { performance?: MonotonicSource };
  if (host.performance && typeof host.performance.now === "function") {
    return host.performance;
  }
  return { now: () => Date.now() };
}

const monotonic = resolveMonotonicSource();

export const systemClock: Clock = {
  now() {
    return monotonic.now();
  },
};

export function createManualClock(start = 0): ManualClock {
  let current = start;
  return {
    now() {
      return current;
    },
    advance(by: number) {
      current += by;
      return current;
    },
    set(to: number) {
      current = to;
    },
  };
}
