import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import type {
  SpeculationRuntime,
  StageState,
  StageStore,
  VersionStore,
} from "./types";

const RuntimeContext = createContext<SpeculationRuntime | null>(null);

export function useRuntime<TData = unknown>(): SpeculationRuntime<TData> {
  const runtime = useContext(RuntimeContext);
  if (runtime === null) {
    throw new Error("[sre] speculative UI hook used outside <Provider>");
  }
  return runtime as SpeculationRuntime<TData>;
}

export function createVersionStore(): VersionStore {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    get() {
      return value;
    },
    bump() {
      value += 1;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function createStageStore(initial: ReactNode): StageStore {
  let state: StageState = {
    node: initial,
    meta: { warm: false },
    status: "idle",
  };
  const listeners = new Set<() => void>();
  return {
    get() {
      return state;
    },
    set(next) {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export interface SpeculationProviderProps {
  runtime: SpeculationRuntime;
  appContext?: unknown;
  children?: ReactNode;
}

export function SpeculationProvider({
  runtime,
  appContext,
  children,
}: SpeculationProviderProps) {
  useEffect(() => {
    if (appContext !== undefined) {
      runtime.engine.setContext(appContext);
    }
  }, [runtime, appContext]);
  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}
