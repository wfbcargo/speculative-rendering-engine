import { createFixedBudget } from "./budget.js";
import { createManualClock } from "./clock.js";
import { createEngine } from "./engine.js";
import { createMetricsCollector } from "./metrics.js";
import { createDefaultPredictor } from "./predictor.js";
import { createManualScheduler } from "./scheduler.js";
import type { SpeculationEngine } from "./engine.js";
import type {
  BudgetPolicy,
  LadderLevel,
  ManualClock,
  ManualScheduler,
  MetricsCollector,
  Predictor,
  TelemetryEvent,
} from "./types.js";

export interface TestHarnessConfig {
  predictor?: Predictor;
  ladder?: LadderLevel[];
  budget?: BudgetPolicy;
  metrics?: MetricsCollector;
  onTelemetry?: (event: TelemetryEvent) => void;
  clockStart?: number;
  targetLevelFor?: (probability: number, ladderLength: number) => number;
}

export interface TestHarness {
  engine: SpeculationEngine;
  clock: ManualClock;
  scheduler: ManualScheduler;
  predictor: Predictor;
  metrics: MetricsCollector;
  ladder: LadderLevel[];
}

function identityLadder(): LadderLevel[] {
  return [
    { name: "compose", prepare: (intent) => ({ intent, rung: "compose" }) },
    { name: "prefetch", prepare: (intent) => ({ intent, rung: "prefetch" }) },
    { name: "materialize", prepare: (intent) => ({ intent, rung: "materialize" }) },
  ];
}

export function createTestHarness(config: TestHarnessConfig = {}): TestHarness {
  const clock = createManualClock(config.clockStart ?? 0);
  const scheduler = createManualScheduler();
  const predictor = config.predictor ?? createDefaultPredictor();
  const ladder = config.ladder ?? identityLadder();
  const budget = config.budget ?? createFixedBudget([16, 8, 4]);
  const metrics = config.metrics ?? createMetricsCollector();

  const engine = createEngine({
    predictor,
    ladder,
    budget,
    clock,
    scheduler,
    metrics,
    onTelemetry: config.onTelemetry,
    targetLevelFor: config.targetLevelFor,
  });

  return { engine, clock, scheduler, predictor, metrics, ladder };
}

export async function drain(
  harness: TestHarness,
  maxRounds = 10000,
): Promise<void> {
  for (let round = 0; round < maxRounds; round += 1) {
    if (harness.scheduler.pending() > 0) {
      harness.scheduler.runAll();
    }
    await Promise.resolve();
    await Promise.resolve();
    if (
      harness.scheduler.pending() === 0 &&
      harness.engine.pendingPrepares() === 0
    ) {
      return;
    }
  }
  throw new Error("drain: engine did not reach quiescence");
}
