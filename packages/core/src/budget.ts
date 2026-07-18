import type { BudgetPolicy, BudgetSnapshot } from "./types.js";

export function createFixedBudget(caps: number | number[]): BudgetPolicy {
  const resolved = Array.isArray(caps) ? caps.slice() : [caps];
  const fallback = resolved.length > 0 ? resolved[resolved.length - 1]! : 0;
  const capForLevel = (level: number): number => {
    if (level < 0) {
      return 0;
    }
    const value = resolved[level];
    return value === undefined ? fallback : value;
  };
  return {
    capForLevel,
    snapshot(): BudgetSnapshot {
      return { kind: "fixed", caps: resolved.slice() };
    },
  };
}

export interface AdaptiveBudgetOptions {
  base: number[];
  hardwareConcurrency?: number;
  deviceMemory?: number;
  referenceConcurrency?: number;
  referenceMemory?: number;
  minFactor?: number;
  maxFactor?: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function createAdaptiveBudget(options: AdaptiveBudgetOptions): BudgetPolicy {
  const {
    base,
    hardwareConcurrency,
    deviceMemory,
    referenceConcurrency = 4,
    referenceMemory = 4,
    minFactor = 0.5,
    maxFactor = 2,
  } = options;

  const concurrencyRatio =
    hardwareConcurrency === undefined
      ? 1
      : hardwareConcurrency / referenceConcurrency;
  const memoryRatio =
    deviceMemory === undefined ? 1 : deviceMemory / referenceMemory;
  const factor = clamp((concurrencyRatio + memoryRatio) / 2, minFactor, maxFactor);

  const caps = base.map((value) => Math.max(1, Math.round(value * factor)));
  const fallback = caps.length > 0 ? caps[caps.length - 1]! : 0;

  return {
    capForLevel(level: number): number {
      if (level < 0) {
        return 0;
      }
      const value = caps[level];
      return value === undefined ? fallback : value;
    },
    snapshot(): BudgetSnapshot {
      return { kind: "adaptive", caps: caps.slice(), factor };
    },
  };
}
