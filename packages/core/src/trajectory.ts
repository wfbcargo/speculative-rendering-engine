import type { Intent, ReturnCandidate } from "./types.js";

export interface Trajectory {
  push(intent: Intent): void;
  entries(): Intent[];
  current(): Intent | undefined;
  prior(): Intent | undefined;
}

export function createTrajectory(initial: Intent[] = []): Trajectory {
  const path: Intent[] = initial.slice();
  return {
    push(intent: Intent): void {
      path.push(intent);
    },
    entries(): Intent[] {
      return path.slice();
    },
    current(): Intent | undefined {
      return path[path.length - 1];
    },
    prior(): Intent | undefined {
      return path[path.length - 2];
    },
  };
}

export interface ReturnCandidateOptions {
  max?: number;
  decay?: number;
}

export function computeReturnCandidates(
  trajectory: Intent[],
  options: ReturnCandidateOptions = {},
): ReturnCandidate[] {
  const { max = Number.POSITIVE_INFINITY, decay = 0.5 } = options;
  const departed = trajectory.slice(0, -1).reverse();
  const limit = Math.min(departed.length, max);
  const candidates: ReturnCandidate[] = [];
  for (let index = 0; index < limit; index += 1) {
    const intent = departed[index]!;
    candidates.push({ intent, recency: Math.pow(decay, index) });
  }
  return candidates;
}
