export type {
  Intent,
  Signal,
  Prediction,
  PredictContext,
  Predictor,
  Clock,
  ManualClock,
  ScheduledHandle,
  IdleScheduler,
  ManualScheduler,
  LadderContext,
  LadderLevel,
  Speculation,
  SpeculationStatus,
  BudgetPolicy,
  BudgetSnapshot,
  HitRateSnapshot,
  MetricsCollector,
  MetricsCollectorOptions,
  TelemetryEvent,
  TelemetryEventType,
  CommitResult,
  ReturnCandidate,
} from "./types.js";

export { systemClock, createManualClock } from "./clock.js";
export { createIdleScheduler, createManualScheduler } from "./scheduler.js";
export { createFixedBudget, createAdaptiveBudget } from "./budget.js";
export type { AdaptiveBudgetOptions } from "./budget.js";
export { createMetricsCollector } from "./metrics.js";
export { createDefaultPredictor } from "./predictor.js";
export { createEngine } from "./engine.js";
export type { EngineConfig, SpeculationEngine } from "./engine.js";
export {
  createTrajectory,
  computeReturnCandidates,
} from "./trajectory.js";
export type { Trajectory, ReturnCandidateOptions } from "./trajectory.js";
export { createPrefetchLevel } from "./prefetch.js";
export type { PrefetchLevelOptions } from "./prefetch.js";
