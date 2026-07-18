import type { Intent, LadderLevel } from "./types.js";

export interface PrefetchLevelOptions<T> {
  name?: string;
  dispose?: (prepared: T) => void;
}

export function createPrefetchLevel<T>(
  fetch: (intent: Intent) => Promise<T> | T,
  options: PrefetchLevelOptions<T> = {},
): LadderLevel<T> {
  const { name = "prefetch", dispose } = options;
  return {
    name,
    prepare(intent: Intent): Promise<T> | T {
      return fetch(intent);
    },
    evict(_intent: Intent, prepared: T): void {
      dispose?.(prepared);
    },
  };
}
