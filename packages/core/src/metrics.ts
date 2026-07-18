import type {
  HitRateSnapshot,
  MetricsCollector,
  MetricsCollectorOptions,
} from "./types.js";

const DEFAULT_HISTORY_CAPACITY = 60;

export function createMetricsCollector(
  options: MetricsCollectorOptions = {},
): MetricsCollector {
  const capacity = Math.max(1, options.historyCapacity ?? DEFAULT_HISTORY_CAPACITY);
  let commits = 0;
  let warm = 0;
  const history: number[] = [];

  const currentHitRate = (): number => (commits === 0 ? 0 : warm / commits);

  return {
    recordCommit(isWarm: boolean): void {
      commits += 1;
      if (isWarm) {
        warm += 1;
      }
      history.push(currentHitRate());
      if (history.length > capacity) {
        history.shift();
      }
    },
    snapshot(): HitRateSnapshot {
      return {
        commits,
        warm,
        cold: commits - warm,
        hitRate: currentHitRate(),
      };
    },
    hitRateHistory(): number[] {
      return history.slice();
    },
    reset(): void {
      commits = 0;
      warm = 0;
      history.length = 0;
    },
  };
}
