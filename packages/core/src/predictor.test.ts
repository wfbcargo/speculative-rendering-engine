import { describe, expect, it } from "vitest";
import { createDefaultPredictor } from "./predictor.js";
import { createTestHarness } from "./testing.js";
import type { Intent } from "./types.js";

function intent(key: string): Intent {
  return { kind: "page", key: `page:${key}`, payload: { id: key } };
}

const A = intent("a");
const B = intent("b");
const C = intent("c");

describe("default Markov predictor", () => {
  it("biases toward the most-travelled transition as history accumulates", () => {
    const harness = createTestHarness({ predictor: createDefaultPredictor() });
    const sequence = [A, B, A, B, A, B, A, C];
    for (const step of sequence) {
      harness.engine.commit(step);
    }

    const predictions = harness.predictor.predict({ current: A });
    expect(predictions[0]?.intent.key).toBe(B.key);
    const probB = predictions.find((p) => p.intent.key === B.key)?.probability ?? 0;
    const probC = predictions.find((p) => p.intent.key === C.key)?.probability ?? 0;
    expect(probB).toBeGreaterThan(probC);
    expect(probB + probC).toBeCloseTo(1, 10);
  });

  it("excludes the current intent and returns nothing for an unseen anchor", () => {
    const predictor = createDefaultPredictor();
    predictor.learn?.(A, A);
    predictor.learn?.(A, B);
    const fromA = predictor.predict({ current: A });
    expect(fromA.map((p) => p.intent.key)).toEqual([B.key]);
    expect(predictor.predict({ current: C })).toEqual([]);
  });
});
