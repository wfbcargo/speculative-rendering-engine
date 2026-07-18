import { describe, expect, it } from "vitest";
import { createFixedBudget } from "./budget.js";
import { createTestHarness, drain } from "./testing.js";
import type {
  Intent,
  PredictContext,
  Prediction,
  Predictor,
  TelemetryEvent,
} from "./types.js";

function intent(key: string): Intent {
  return { kind: "page", key: `page:${key}`, payload: { id: key } };
}

function fixedPredictor(map: Record<string, Prediction[]>): Predictor {
  return {
    predict(context: PredictContext): Prediction[] {
      const tag = typeof context.appContext === "string" ? context.appContext : "";
      return map[tag] ?? [];
    },
  };
}

const A = intent("a");
const B = intent("b");
const C = intent("c");

describe("engine lifecycle", () => {
  it("predicts, promotes to the target rung, and serves a warm commit", async () => {
    const harness = createTestHarness({
      predictor: fixedPredictor({ home: [{ intent: A, probability: 0.95 }] }),
    });
    harness.engine.setContext("home");
    await drain(harness);

    const speculation = harness.engine
      .speculations()
      .find((entry) => entry.key === A.key);
    expect(speculation?.currentLevel).toBe(2);
    expect(speculation?.status).toBe("ready");
    expect(speculation?.levelName).toBe("materialize");

    const result = harness.engine.commit(A);
    expect(result.warm).toBe(true);
    expect(result.meta.warm).toBe(true);
    expect(result.level).toBe("materialize");
    expect(result.prepared).toEqual({ intent: A, rung: "materialize" });
  });

  it("evicts wrong bets and serves an unpredicted commit cold", async () => {
    const harness = createTestHarness({
      predictor: fixedPredictor({
        home: [
          { intent: A, probability: 0.95 },
          { intent: B, probability: 0.6 },
        ],
      }),
    });
    harness.engine.setContext("home");
    await drain(harness);
    expect(harness.engine.speculations()).toHaveLength(2);

    const result = harness.engine.commit(C);
    expect(result.warm).toBe(false);
    expect(result.meta.warm).toBe(false);
    expect(result.pending).toBeDefined();
    await result.pending;

    expect(harness.engine.speculations()).toHaveLength(0);
  });

  it("enforces per-rung budget caps", async () => {
    const harness = createTestHarness({
      predictor: fixedPredictor({
        home: [
          { intent: A, probability: 0.98 },
          { intent: B, probability: 0.9 },
        ],
      }),
      budget: createFixedBudget([16, 8, 1]),
    });
    harness.engine.setContext("home");
    await drain(harness);

    const specA = harness.engine.speculations().find((s) => s.key === A.key);
    const specB = harness.engine.speculations().find((s) => s.key === B.key);
    expect(specA?.currentLevel).toBe(2);
    expect(specB?.currentLevel).toBe(1);
    expect(specB?.levelName).toBe("prefetch");
  });

  it("emits telemetry across the promote/commit path with no real timers", async () => {
    const events: TelemetryEvent[] = [];
    const harness = createTestHarness({
      predictor: fixedPredictor({ home: [{ intent: A, probability: 0.95 }] }),
      onTelemetry: (event) => events.push(event),
    });
    harness.engine.setContext("home");
    await drain(harness);
    harness.engine.commit(A);

    const types = events.map((event) => event.type);
    expect(types).toContain("predict");
    expect(types).toContain("promote");
    expect(types).toContain("commit");
  });

  it("demotes speculations when their probability falls", async () => {
    const harness = createTestHarness({
      predictor: fixedPredictor({
        high: [{ intent: A, probability: 0.95 }],
        low: [{ intent: A, probability: 0.1 }],
      }),
    });
    harness.engine.setContext("high");
    await drain(harness);
    expect(
      harness.engine.speculations().find((s) => s.key === A.key)?.currentLevel,
    ).toBe(2);

    harness.engine.setContext("low");
    await drain(harness);
    expect(
      harness.engine.speculations().find((s) => s.key === A.key)?.currentLevel,
    ).toBe(0);
  });
});
