import { describe, expect, it } from "vitest";
import {
  computeReturnCandidates,
  createTrajectory,
} from "./trajectory.js";
import type { Intent } from "./types.js";

function intent(key: string): Intent {
  return { kind: "page", key: `page:${key}`, payload: { id: key } };
}

const A = intent("a");
const B = intent("b");
const C = intent("c");
const D = intent("d");

describe("trajectory", () => {
  it("tracks current and prior along the committed path", () => {
    const trajectory = createTrajectory();
    trajectory.push(A);
    trajectory.push(B);
    trajectory.push(C);
    expect(trajectory.current()).toEqual(C);
    expect(trajectory.prior()).toEqual(B);
    expect(trajectory.entries()).toEqual([A, B, C]);
  });

  it("grades departed states by recency, excluding the current one", () => {
    const candidates = computeReturnCandidates([A, B, C, D]);
    expect(candidates.map((entry) => entry.intent.key)).toEqual([
      C.key,
      B.key,
      A.key,
    ]);
    expect(candidates[0]?.recency).toBeCloseTo(1, 10);
    expect(candidates[1]?.recency).toBeCloseTo(0.5, 10);
    expect(candidates[2]?.recency).toBeCloseTo(0.25, 10);
  });

  it("caps the number of return candidates", () => {
    const candidates = computeReturnCandidates([A, B, C, D], { max: 2 });
    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.intent.key).toBe(C.key);
  });
});
