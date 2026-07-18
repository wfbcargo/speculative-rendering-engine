import type { ReactNode } from "react";
import type {
  BudgetPolicy,
  Clock,
  IdleScheduler,
  Intent,
  LadderLevel,
  PredictContext,
  Prediction,
  Signal,
  Speculation,
  SpeculationEngine,
  TelemetryEvent,
} from "@sre/core";

export interface RenderMeta {
  warm: boolean;
}

export interface SpeculativeUIConfig<TData = unknown> {
  predict(context: PredictContext): Prediction[];
  learn?(from: Intent | undefined, to: Intent): void;
  observe?(signal: Signal): void;
  fetch(intent: Intent): Promise<TData> | TData;
  render(intent: Intent, data: TData, meta: RenderMeta): ReactNode;
  renderLoading?(intent: Intent): ReactNode;
  budget?: BudgetPolicy;
  clock?: Clock;
  scheduler?: IdleScheduler;
  onTelemetry?(event: TelemetryEvent): void;
  targetLevelFor?(probability: number, ladderLength: number): number;
  initialView?: ReactNode;
}

export type StageStatus = "idle" | "loading" | "ready";

export interface StageState {
  intent?: Intent;
  node: ReactNode;
  meta: RenderMeta;
  status: StageStatus;
}

export interface VersionStore {
  get(): number;
  bump(): void;
  subscribe(listener: () => void): () => void;
}

export interface StageStore {
  get(): StageState;
  set(next: StageState): void;
  subscribe(listener: () => void): () => void;
}

export interface WarmEntry<TData> {
  data: TData;
  node: ReactNode;
}

export interface DataLookup<TData> {
  present: boolean;
  data: TData | undefined;
}

export interface ReactMaterializer<TData = unknown> {
  ladder: LadderLevel[];
  readWarm(key: string): WarmEntry<TData> | undefined;
  readData(key: string): DataLookup<TData>;
  clear(key: string): void;
}

export interface StageFlag {
  mounted: boolean;
}

export interface SpeculationRuntime<TData = unknown> {
  engine: SpeculationEngine;
  materializer: ReactMaterializer<TData>;
  stage: StageStore;
  version: VersionStore;
  config: SpeculativeUIConfig<TData>;
  stageFlag: StageFlag;
}

export interface SpeculationView {
  speculations: Speculation[];
  current: Intent | undefined;
  warm: boolean;
  status: StageStatus;
}

export interface ProviderProps {
  appContext?: unknown;
  children?: ReactNode;
}
