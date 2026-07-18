import { describe, expect, it } from "vitest";
import { createAdaptiveBudget, createFixedBudget } from "./budget.js";

describe("budget policies", () => {
  it("resolves fixed per-rung caps and reuses the last for deeper rungs", () => {
    const budget = createFixedBudget([10, 5, 2]);
    expect(budget.capForLevel(0)).toBe(10);
    expect(budget.capForLevel(1)).toBe(5);
    expect(budget.capForLevel(2)).toBe(2);
    expect(budget.capForLevel(3)).toBe(2);
    expect(budget.capForLevel(-1)).toBe(0);
    expect(budget.snapshot()).toEqual({ kind: "fixed", caps: [10, 5, 2] });
  });

  it("scales adaptive caps down on constrained hardware", () => {
    const budget = createAdaptiveBudget({
      base: [16, 8, 4],
      hardwareConcurrency: 2,
      deviceMemory: 2,
    });
    const snapshot = budget.snapshot();
    expect(snapshot.factor).toBeCloseTo(0.5, 10);
    expect(snapshot.caps).toEqual([8, 4, 2]);
    expect(budget.capForLevel(0)).toBe(8);
  });

  it("scales adaptive caps up on capable hardware within the max factor", () => {
    const budget = createAdaptiveBudget({
      base: [10, 5, 2],
      hardwareConcurrency: 16,
      deviceMemory: 16,
    });
    expect(budget.snapshot().factor).toBeCloseTo(2, 10);
    expect(budget.snapshot().caps).toEqual([20, 10, 4]);
  });
});
