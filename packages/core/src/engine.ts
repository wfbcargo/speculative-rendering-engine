import { createMetricsCollector } from "./metrics.js";
import type {
  BudgetPolicy,
  Clock,
  CommitResult,
  IdleScheduler,
  Intent,
  LadderContext,
  LadderLevel,
  MetricsCollector,
  PredictContext,
  Prediction,
  Predictor,
  Signal,
  Speculation,
  TelemetryEvent,
} from "./types.js";

export interface EngineConfig {
  predictor: Predictor;
  ladder: LadderLevel[];
  budget: BudgetPolicy;
  clock: Clock;
  scheduler: IdleScheduler;
  metrics?: MetricsCollector;
  onTelemetry?: (event: TelemetryEvent) => void;
  targetLevelFor?: (probability: number, ladderLength: number) => number;
}

export interface SpeculationEngine {
  observe(signal: Signal): void;
  setContext(appContext: unknown): void;
  predict(): Prediction[];
  commit<T = unknown>(intent: Intent): CommitResult<T>;
  speculations(): Speculation[];
  trajectory(): Intent[];
  current(): Intent | undefined;
  pendingPrepares(): number;
  readonly metrics: MetricsCollector;
}

interface SpeculationRecord extends Speculation {
  desiredLevel: number;
  prepared: Map<number, unknown>;
}

function defaultTargetLevel(probability: number, ladderLength: number): number {
  if (ladderLength === 0) {
    return -1;
  }
  const raw = Math.floor(probability * ladderLength);
  return Math.min(ladderLength - 1, Math.max(0, raw));
}

export function createEngine(config: EngineConfig): SpeculationEngine {
  const {
    predictor,
    ladder,
    budget,
    clock,
    scheduler,
    onTelemetry,
    targetLevelFor = defaultTargetLevel,
  } = config;
  const metrics = config.metrics ?? createMetricsCollector();

  const pool = new Map<string, SpeculationRecord>();
  const path: Intent[] = [];
  let appContext: unknown = undefined;
  let currentIntent: Intent | undefined = undefined;
  let priorIntent: Intent | undefined = undefined;
  let inFlight = 0;
  let promotionScheduled = false;

  const emit = (event: TelemetryEvent): void => {
    onTelemetry?.(event);
  };

  const ladderContext = (): LadderContext => ({ clock, appContext });

  const levelName = (level: number): string | null => {
    const rung = ladder[level];
    return rung === undefined ? null : rung.name;
  };

  const evictRecord = (record: SpeculationRecord): void => {
    for (const [level, prepared] of record.prepared) {
      ladder[level]?.evict?.(record.intent, prepared);
    }
    record.prepared.clear();
    record.status = "evicted";
    record.currentLevel = -1;
    record.levelName = null;
    pool.delete(record.key);
    emit({ type: "evict", at: clock.now(), intent: record.intent });
  };

  const demoteAboveTarget = (record: SpeculationRecord): void => {
    for (let level = record.currentLevel; level > record.targetLevel; level -= 1) {
      const prepared = record.prepared.get(level);
      if (prepared !== undefined) {
        ladder[level]?.evict?.(record.intent, prepared);
      }
      record.prepared.delete(level);
    }
    record.currentLevel = record.targetLevel;
    record.levelName = levelName(record.currentLevel);
    record.status = "pending";
    record.updatedAt = clock.now();
    emit({
      type: "demote",
      at: record.updatedAt,
      intent: record.intent,
      level: record.levelName ?? undefined,
    });
  };

  const schedulePromotion = (): void => {
    if (promotionScheduled) {
      return;
    }
    promotionScheduled = true;
    scheduler.schedule(runPromotionPass);
  };

  const promoteOneRung = (record: SpeculationRecord): void => {
    const nextLevel = record.currentLevel + 1;
    const rung = ladder[nextLevel];
    if (rung === undefined) {
      return;
    }
    record.status = "preparing";
    inFlight += 1;
    Promise.resolve(rung.prepare(record.intent, ladderContext()))
      .then((value) => {
        if (record.status === "evicted" || pool.get(record.key) !== record) {
          rung.evict?.(record.intent, value);
          return;
        }
        record.prepared.set(nextLevel, value);
        record.currentLevel = nextLevel;
        record.levelName = rung.name;
        record.updatedAt = clock.now();
        record.status =
          record.currentLevel >= record.targetLevel ? "ready" : "pending";
        emit({
          type: "promote",
          at: record.updatedAt,
          intent: record.intent,
          level: rung.name,
        });
        if (record.currentLevel < record.targetLevel) {
          schedulePromotion();
        }
      })
      .finally(() => {
        inFlight -= 1;
      });
  };

  function runPromotionPass(): void {
    promotionScheduled = false;
    for (const record of pool.values()) {
      if (record.status === "evicted" || record.status === "preparing") {
        continue;
      }
      if (record.currentLevel > record.targetLevel) {
        demoteAboveTarget(record);
      } else if (record.currentLevel < record.targetLevel) {
        promoteOneRung(record);
      }
    }
  }

  const applyBudget = (): void => {
    const remaining = ladder.map((_, level) => budget.capForLevel(level));
    const ordered = [...pool.values()].sort(
      (a, b) => b.probability - a.probability,
    );
    for (const record of ordered) {
      let allowed = -1;
      for (let level = 0; level <= record.desiredLevel; level += 1) {
        const capLeft = remaining[level];
        if (capLeft !== undefined && capLeft > 0) {
          remaining[level] = capLeft - 1;
          allowed = level;
        } else {
          break;
        }
      }
      if (allowed < 0) {
        evictRecord(record);
      } else {
        record.targetLevel = allowed;
      }
    }
  };

  const reconcile = (predictions: Prediction[]): void => {
    const predicted = new Set<string>();
    for (const prediction of predictions) {
      const key = prediction.intent.key;
      predicted.add(key);
      const desired = targetLevelFor(prediction.probability, ladder.length);
      const existing = pool.get(key);
      if (existing === undefined) {
        pool.set(key, {
          intent: prediction.intent,
          key,
          probability: prediction.probability,
          desiredLevel: desired,
          targetLevel: desired,
          currentLevel: -1,
          levelName: null,
          status: "pending",
          createdAt: clock.now(),
          updatedAt: clock.now(),
          prepared: new Map<number, unknown>(),
        });
      } else {
        existing.intent = prediction.intent;
        existing.probability = prediction.probability;
        existing.desiredLevel = desired;
        existing.targetLevel = desired;
        existing.updatedAt = clock.now();
      }
    }
    for (const record of [...pool.values()]) {
      if (!predicted.has(record.key)) {
        evictRecord(record);
      }
    }
    applyBudget();
    for (const record of pool.values()) {
      if (record.currentLevel !== record.targetLevel) {
        schedulePromotion();
        break;
      }
    }
  };

  const buildContext = (): PredictContext => ({
    current: currentIntent,
    prior: priorIntent,
    appContext,
    trajectory: path.slice(),
  });

  const runPrediction = (): Prediction[] => {
    const predictions = predictor.predict(buildContext());
    emit({ type: "predict", at: clock.now(), detail: predictions.length });
    reconcile(predictions);
    return predictions;
  };

  const prepareCold = <T>(intent: Intent): Promise<T> => {
    inFlight += 1;
    let chain: Promise<unknown> = Promise.resolve(undefined);
    for (const rung of ladder) {
      chain = chain.then(() =>
        Promise.resolve(rung.prepare(intent, ladderContext())),
      );
    }
    return chain.finally(() => {
      inFlight -= 1;
    }) as Promise<T>;
  };

  const flushWrongBets = (committedKey: string): void => {
    for (const record of [...pool.values()]) {
      if (record.key !== committedKey) {
        evictRecord(record);
      }
    }
  };

  return {
    observe(signal: Signal): void {
      predictor.observe?.(signal);
    },
    setContext(next: unknown): void {
      appContext = next;
      runPrediction();
    },
    predict(): Prediction[] {
      return runPrediction();
    },
    commit<T = unknown>(intent: Intent): CommitResult<T> {
      const record = pool.get(intent.key);
      const warm = record !== undefined && record.status === "ready";
      let prepared: T | undefined;
      let pending: Promise<T> | undefined;
      let level: string | null = null;

      if (warm && record !== undefined) {
        prepared = record.prepared.get(record.currentLevel) as T | undefined;
        level = record.levelName;
      }

      flushWrongBets(intent.key);
      pool.delete(intent.key);

      if (!warm) {
        pending = prepareCold<T>(intent);
        level = ladder.length > 0 ? ladder[ladder.length - 1]!.name : null;
      }

      predictor.learn?.(currentIntent, intent);
      metrics.recordCommit(warm);

      priorIntent = currentIntent;
      currentIntent = intent;
      path.push(intent);

      emit({ type: "commit", at: clock.now(), intent, warm, level: level ?? undefined });

      return { intent, warm, prepared, pending, level, meta: { warm } };
    },
    speculations(): Speculation[] {
      return [...pool.values()].map((record) => ({
        intent: record.intent,
        key: record.key,
        probability: record.probability,
        targetLevel: record.targetLevel,
        currentLevel: record.currentLevel,
        levelName: record.levelName,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));
    },
    trajectory(): Intent[] {
      return path.slice();
    },
    current(): Intent | undefined {
      return currentIntent;
    },
    pendingPrepares(): number {
      return inFlight;
    },
    metrics,
  };
}
