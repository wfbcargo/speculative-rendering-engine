import { describe, expect, it } from "vitest";
import { createMetricsCollector } from "./metrics.js";
import { createTestHarness, drain } from "./testing.js";
import type { Intent, PredictContext, Prediction, Predictor } from "./types.js";

function intent(key: string): Intent {
  return { kind: "page", key: `page:${key}`, payload: { id: key } };
}

const A = intent("a");

function predictA(): Predictor {
  return {
    predict(context: PredictContext): Prediction[] {
      return context.appContext === "arm" ? [{ intent: A, probability: 0.95 }] : [];
    },
  };
}

describe("metrics collector", () => {
  it("bounds the rolling hit-rate history to its capacity", () => {
    const metrics = createMetricsCollector({ historyCapacity: 3 });
    metrics.recordCommit(true);
    metrics.recordCommit(false);
    metrics.recordCommit(true);
    metrics.recordCommit(true);
    metrics.recordCommit(false);
    const history = metrics.hitRateHistory();
    expect(history).toHaveLength(3);
    expect(metrics.snapshot()).toEqual({
      commits: 5,
      warm: 3,
      cold: 2,
      hitRate: 3 / 5,
    });
  });

  it("tracks warm and cold commits through the engine", async () => {
    const harness = createTestHarness({ predictor: predictA() });

    harness.engine.setContext("arm");
    await drain(harness);
    const warm = harness.engine.commit(A);
    expect(warm.warm).toBe(true);

    const cold = harness.engine.commit(intent("z"));
    expect(cold.warm).toBe(false);
    await cold.pending;

    const snapshot = harness.engine.metrics.snapshot();
    expect(snapshot.commits).toBe(2);
    expect(snapshot.warm).toBe(1);
    expect(snapshot.cold).toBe(1);
    expect(snapshot.hitRate).toBeCloseTo(0.5, 10);
    expect(harness.engine.metrics.hitRateHistory()).toHaveLength(2);
  });
});
