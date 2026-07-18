export interface Intent {
  kind: string;
  key: string;
  payload?: unknown;
}

export interface Signal {
  type: string;
  at: number;
  data?: unknown;
}

export interface Prediction {
  intent: Intent;
  probability: number;
}

export interface PredictContext {
  current?: Intent;
  prior?: Intent;
  appContext?: unknown;
  trajectory?: Intent[];
}

export interface Predictor {
  predict(context: PredictContext): Prediction[];
  learn?(from: Intent | undefined, to: Intent): void;
  observe?(signal: Signal): void;
}

export interface Clock {
  now(): number;
}

export interface ManualClock extends Clock {
  advance(by: number): number;
  set(to: number): void;
}

export type ScheduledHandle = number;

export interface IdleScheduler {
  schedule(task: () => void): ScheduledHandle;
  cancel(handle: ScheduledHandle): void;
}

export interface ManualScheduler extends IdleScheduler {
  runNext(): boolean;
  runAll(): number;
  pending(): number;
}

export interface LadderContext {
  clock: Clock;
  appContext?: unknown;
}

export interface LadderLevel<T = unknown> {
  name: string;
  prepare(intent: Intent, context: LadderContext): Promise<T> | T;
  evict?(intent: Intent, prepared: T): void;
}

export type SpeculationStatus = "pending" | "preparing" | "ready" | "evicted";

export interface Speculation {
  intent: Intent;
  key: string;
  probability: number;
  targetLevel: number;
  currentLevel: number;
  levelName: string | null;
  status: SpeculationStatus;
  createdAt: number;
  updatedAt: number;
}

export interface BudgetSnapshot {
  kind: string;
  caps: number[];
  factor?: number;
}

export interface BudgetPolicy {
  capForLevel(level: number): number;
  snapshot(): BudgetSnapshot;
}

export interface HitRateSnapshot {
  commits: number;
  warm: number;
  cold: number;
  hitRate: number;
}

export interface MetricsCollectorOptions {
  historyCapacity?: number;
}

export interface MetricsCollector {
  recordCommit(warm: boolean): void;
  snapshot(): HitRateSnapshot;
  hitRateHistory(): number[];
  reset(): void;
}

export type TelemetryEventType =
  | "predict"
  | "promote"
  | "demote"
  | "evict"
  | "commit";

export interface TelemetryEvent {
  type: TelemetryEventType;
  at: number;
  intent?: Intent;
  level?: string;
  warm?: boolean;
  detail?: unknown;
}

export interface CommitResult<T = unknown> {
  intent: Intent;
  warm: boolean;
  prepared?: T;
  pending?: Promise<T>;
  level: string | null;
  meta: { warm: boolean };
}

export interface ReturnCandidate {
  intent: Intent;
  recency: number;
}
