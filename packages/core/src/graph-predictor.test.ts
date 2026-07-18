import { describe, expect, it } from "vitest";
import { createManualClock } from "./clock.js";
import { createGraphPredictor, defaultConcepts } from "./graph-predictor.js";
import type {
  AuthoredEdge,
  GraphNode,
  GraphPredictorConfig,
  StrengtheningRule,
} from "./graph-predictor.js";
import type { Intent } from "./types.js";

function componentIntent(id: string): Intent {
  return { kind: "component", key: `component:${id}`, payload: { id } };
}

function build(
  partial: Partial<GraphPredictorConfig> & {
    nodes: GraphNode[];
    edges: AuthoredEdge[];
  },
) {
  const clock = createManualClock(0);
  const predictor = createGraphPredictor({
    nodes: partial.nodes,
    edges: partial.edges,
    rules: partial.rules ?? [],
    concepts: partial.concepts,
    intentFor: partial.intentFor ?? componentIntent,
    decay: partial.decay,
    learning: partial.learning,
    clock,
  });
  return { predictor, clock };
}

function conceptNode(id: string): GraphNode {
  return { id, kind: "concept" };
}

function componentNode(id: string): GraphNode {
  return { id, kind: "component" };
}

function probabilityFor(
  predictions: { intent: Intent; probability: number }[],
  id: string,
): number {
  return (
    predictions.find((p) => p.intent.key === `component:${id}`)?.probability ?? 0
  );
}

describe("createGraphPredictor", () => {
  it("spreads a seeded concept to every component in its cluster", () => {
    const { predictor } = build({
      nodes: [
        conceptNode("Reporting"),
        componentNode("report-table"),
        componentNode("report-chart"),
        componentNode("report-export"),
      ],
      edges: [
        { from: "Reporting", to: "report-table", weight: 1 },
        { from: "Reporting", to: "report-chart", weight: 1 },
        { from: "Reporting", to: "report-export", weight: 1 },
      ],
      rules: [
        { action: "use", target: "report-table", concept: "Reporting", gain: 1 },
      ],
    });

    predictor.observe({ type: "use", at: 0, data: "report-table" });
    const predictions = predictor.predict({});

    expect(probabilityFor(predictions, "report-table")).toBeGreaterThan(0);
    expect(probabilityFor(predictions, "report-chart")).toBeGreaterThan(0);
    expect(probabilityFor(predictions, "report-export")).toBeGreaterThan(0);
  });

  it("normalizes contributions by source out-degree (the fan effect)", () => {
    const nodes = [
      conceptNode("Hub"),
      conceptNode("Narrow"),
      componentNode("h1"),
      componentNode("h2"),
      componentNode("h3"),
      componentNode("h4"),
      componentNode("n1"),
    ];
    const edges: AuthoredEdge[] = [
      { from: "Hub", to: "h1", weight: 1 },
      { from: "Hub", to: "h2", weight: 1 },
      { from: "Hub", to: "h3", weight: 1 },
      { from: "Hub", to: "h4", weight: 1 },
      { from: "Narrow", to: "n1", weight: 1 },
    ];
    const rules: StrengtheningRule[] = [
      { action: "seed", target: "hub", concept: "Hub", gain: 1 },
      { action: "seed", target: "narrow", concept: "Narrow", gain: 1 },
    ];

    const withFanOut = build({ nodes, edges, rules, decay: { fanOut: true } });
    withFanOut.predictor.observe({ type: "seed", at: 0, data: "hub" });
    withFanOut.predictor.observe({ type: "seed", at: 0, data: "narrow" });
    const fan = withFanOut.predictor.predict({});
    expect(probabilityFor(fan, "n1")).toBeCloseTo(
      4 * probabilityFor(fan, "h1"),
      10,
    );

    const withoutFanOut = build({ nodes, edges, rules, decay: { fanOut: false } });
    withoutFanOut.predictor.observe({ type: "seed", at: 0, data: "hub" });
    withoutFanOut.predictor.observe({ type: "seed", at: 0, data: "narrow" });
    const flat = withoutFanOut.predictor.predict({});
    expect(probabilityFor(flat, "n1")).toBeCloseTo(
      probabilityFor(flat, "h1"),
      10,
    );
  });

  it("applies geometric per-hop decay along a chain", () => {
    const { predictor } = build({
      nodes: [
        componentNode("a"),
        componentNode("b"),
        componentNode("c"),
        componentNode("d"),
      ],
      edges: [
        { from: "a", to: "b", weight: 1 },
        { from: "b", to: "c", weight: 1 },
        { from: "c", to: "d", weight: 1 },
      ],
      decay: { hopFactor: 0.25, threshold: 0, maxHops: 3 },
    });

    const predictions = predictor.predict({ current: componentIntent("a") });
    const pb = probabilityFor(predictions, "b");
    const pc = probabilityFor(predictions, "c");
    const pd = probabilityFor(predictions, "d");

    expect(pb / pc).toBeCloseTo(4, 10);
    expect(pc / pd).toBeCloseTo(4, 10);
  });

  it("gates propagation below the firing threshold", () => {
    const nodes = [
      conceptNode("K"),
      componentNode("c1"),
      componentNode("c2"),
    ];
    const edges: AuthoredEdge[] = [
      { from: "K", to: "c1", weight: 0.1 },
      { from: "c1", to: "c2", weight: 1 },
    ];
    const rules: StrengtheningRule[] = [
      { action: "seed", target: "k", concept: "K", gain: 1 },
    ];

    const gated = build({
      nodes,
      edges,
      rules,
      decay: { hopFactor: 0.25, threshold: 0.05, maxHops: 3, fanOut: false },
    });
    gated.predictor.observe({ type: "seed", at: 0, data: "k" });
    const gatedPredictions = gated.predictor.predict({});
    expect(probabilityFor(gatedPredictions, "c2")).toBe(0);

    const open = build({
      nodes,
      edges,
      rules,
      decay: { hopFactor: 0.25, threshold: 0.001, maxHops: 3, fanOut: false },
    });
    open.predictor.observe({ type: "seed", at: 0, data: "k" });
    const openPredictions = open.predictor.predict({});
    expect(probabilityFor(openPredictions, "c1")).toBeGreaterThan(0);
    expect(probabilityFor(openPredictions, "c2")).toBeGreaterThan(0);
  });

  it("bounds propagation by the hop cap regardless of decay", () => {
    const nodes = [
      componentNode("a"),
      componentNode("b"),
      componentNode("c"),
      componentNode("d"),
    ];
    const edges: AuthoredEdge[] = [
      { from: "a", to: "b", weight: 1 },
      { from: "b", to: "c", weight: 1 },
      { from: "c", to: "d", weight: 1 },
    ];

    const capped = build({
      nodes,
      edges,
      decay: { hopFactor: 1, threshold: 0, maxHops: 2, fanOut: false },
    });
    const cappedPredictions = capped.predictor.predict({
      current: componentIntent("a"),
    });
    expect(probabilityFor(cappedPredictions, "b")).toBeGreaterThan(0);
    expect(probabilityFor(cappedPredictions, "c")).toBeGreaterThan(0);
    expect(probabilityFor(cappedPredictions, "d")).toBe(0);

    const deeper = build({
      nodes,
      edges,
      decay: { hopFactor: 1, threshold: 0, maxHops: 3, fanOut: false },
    });
    const deeperPredictions = deeper.predictor.predict({
      current: componentIntent("a"),
    });
    expect(probabilityFor(deeperPredictions, "d")).toBeGreaterThan(0);
  });

  it("cools concept base-level activation by a power law over time", () => {
    const { predictor } = build({
      nodes: [conceptNode("Reporting")],
      edges: [],
      rules: [
        { action: "use", target: "report", concept: "Reporting", gain: 1 },
      ],
      decay: { temporalHalfLife: 100 },
    });

    predictor.observe({ type: "use", at: 0, data: "report" });

    const level = (now: number): number =>
      predictor.conceptActivation(now).find((c) => c.concept === "Reporting")
        ?.level ?? 0;

    expect(level(0)).toBeCloseTo(1, 10);
    expect(level(100)).toBeCloseTo(0.5, 10);
    expect(level(200)).toBeCloseTo(1 / 3, 10);
    expect(level(200)).not.toBeCloseTo(0.25, 3);
  });

  it("decays concept activation by elapsed time regardless of predict cadence", () => {
    const { predictor, clock } = build({
      nodes: [conceptNode("Reporting")],
      edges: [],
      rules: [
        { action: "use", target: "report", concept: "Reporting", gain: 1 },
      ],
      decay: { temporalHalfLife: 100 },
    });

    predictor.observe({ type: "use", at: 0, data: "report" });

    clock.set(100);
    predictor.predict({});
    clock.set(150);
    predictor.predict({});
    clock.set(200);
    predictor.predict({});

    const level =
      predictor.conceptActivation(200).find((c) => c.concept === "Reporting")
        ?.level ?? 0;
    expect(level).toBeCloseTo(1 / 3, 10);
    expect(level).not.toBeCloseTo(0.25, 3);
  });

  it("creates a learned edge only after the support threshold", () => {
    const config = {
      nodes: [componentNode("a"), componentNode("b")],
      edges: [] as AuthoredEdge[],
      learning: { supportThreshold: 3, initialWeight: 0.5, forgetHalfLife: 1e9 },
      decay: { hopFactor: 0.25, threshold: 0.001, maxHops: 2, fanOut: false },
    };
    const { predictor } = build(config);

    const A = componentIntent("a");
    const B = componentIntent("b");

    predictor.learn(A, B);
    predictor.learn(A, B);
    expect(predictor.predict({ current: A })).toEqual([]);

    predictor.learn(A, B);
    const predictions = predictor.predict({ current: A });
    expect(predictions.map((p) => p.intent.key)).toEqual([B.key]);
  });

  it("keeps learned edges directional", () => {
    const { predictor } = build({
      nodes: [componentNode("a"), componentNode("b")],
      edges: [],
      learning: { supportThreshold: 1, initialWeight: 0.5, forgetHalfLife: 1e9 },
      decay: { hopFactor: 0.25, threshold: 0.001, maxHops: 2, fanOut: false },
    });

    const A = componentIntent("a");
    const B = componentIntent("b");
    predictor.learn(A, B);

    expect(predictor.predict({ current: A }).map((p) => p.intent.key)).toEqual([
      B.key,
    ]);
    expect(predictor.predict({ current: B })).toEqual([]);
  });

  it("forgets learned edges through temporal decay", () => {
    const clock = createManualClock(0);
    const predictor = createGraphPredictor({
      nodes: [componentNode("a"), componentNode("b")],
      edges: [],
      rules: [],
      intentFor: componentIntent,
      learning: { supportThreshold: 1, initialWeight: 0.5, forgetHalfLife: 100 },
      decay: { hopFactor: 0.25, threshold: 0.02, maxHops: 2, fanOut: false },
      clock,
    });

    const A = componentIntent("a");
    const B = componentIntent("b");
    predictor.learn(A, B);

    expect(
      predictor.predict({ current: A }).map((p) => p.intent.key),
    ).toEqual([B.key]);

    clock.advance(100000);
    expect(predictor.predict({ current: A })).toEqual([]);
  });

  it("returns ranked, normalized predictions that exclude the current intent", () => {
    const { predictor } = build({
      nodes: [
        conceptNode("Reporting"),
        componentNode("report-table"),
        componentNode("report-chart"),
      ],
      edges: [
        { from: "Reporting", to: "report-table", weight: 2 },
        { from: "Reporting", to: "report-chart", weight: 1 },
      ],
      rules: [
        { action: "use", target: "report-table", concept: "Reporting", gain: 1 },
      ],
      decay: { fanOut: false },
    });

    predictor.observe({ type: "use", at: 0, data: "report-table" });
    const predictions = predictor.predict({
      current: componentIntent("report-table"),
    });

    expect(
      predictions.some((p) => p.intent.key === "component:report-table"),
    ).toBe(false);
    const sum = predictions.reduce((acc, p) => acc + p.probability, 0);
    expect(sum).toBeCloseTo(1, 10);
    for (let i = 1; i < predictions.length; i += 1) {
      expect(predictions[i - 1]!.probability).toBeGreaterThanOrEqual(
        predictions[i]!.probability,
      );
    }
  });

  it("exposes the decayed concept vector over the full vocabulary", () => {
    const { predictor } = build({
      nodes: [conceptNode("Reporting")],
      edges: [],
      rules: [
        { action: "use", target: "report", concept: "Reporting", gain: 1 },
      ],
    });

    predictor.observe({ type: "use", at: 0, data: "report" });
    const vector = predictor.conceptActivation(0);

    expect(vector).toHaveLength(defaultConcepts.length);
    expect(vector.map((c) => c.concept)).toEqual(defaultConcepts);
    const reporting = vector.find((c) => c.concept === "Reporting");
    expect(reporting?.level).toBeGreaterThan(0);
    for (const entry of vector) {
      if (entry.concept !== "Reporting") {
        expect(entry.level).toBe(0);
      }
    }
  });
});
