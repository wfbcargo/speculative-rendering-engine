import { useCallback, useSyncExternalStore } from "react";
import type { Intent, Signal, SpeculationEngine } from "@sre/core";
import { useRuntime } from "./context";
import type { SpeculationRuntime, SpeculationView } from "./types";

function useVersion<TData>(runtime: SpeculationRuntime<TData>): number {
  return useSyncExternalStore(
    runtime.version.subscribe,
    runtime.version.get,
    runtime.version.get,
  );
}

export function useSpeculation(): SpeculationView {
  const runtime = useRuntime();
  useVersion(runtime);
  const stage = useSyncExternalStore(
    runtime.stage.subscribe,
    runtime.stage.get,
    runtime.stage.get,
  );
  return {
    speculations: runtime.engine.speculations(),
    current: runtime.engine.current(),
    warm: stage.meta.warm,
    status: stage.status,
  };
}

export function useTrajectory(): Intent[] {
  const runtime = useRuntime();
  useVersion(runtime);
  return runtime.engine.trajectory();
}

export function useObserve(): (signal: Signal) => void {
  const runtime = useRuntime();
  return useCallback(
    (signal: Signal) => {
      runtime.engine.observe(signal);
    },
    [runtime],
  );
}

export function useSetContext(): (appContext: unknown) => void {
  const runtime = useRuntime();
  return useCallback(
    (appContext: unknown) => {
      runtime.engine.setContext(appContext);
    },
    [runtime],
  );
}

export function useEngine(): SpeculationEngine {
  return useRuntime().engine;
}
