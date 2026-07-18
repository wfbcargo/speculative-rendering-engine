import { useCallback } from "react";
import type { ReactNode } from "react";
import type { CommitResult, Intent } from "@sre/core";
import { useRuntime } from "./context";
import { withViewTransition } from "./transition";
import type { RenderMeta, SpeculationRuntime } from "./types";

function reveal<TData>(
  runtime: SpeculationRuntime<TData>,
  intent: Intent,
  node: ReactNode,
  meta: RenderMeta,
  transition: boolean,
): void {
  const apply = () => {
    runtime.stage.set({ intent, node, meta, status: "ready" });
  };
  if (transition) {
    withViewTransition(apply);
  } else {
    apply();
  }
}

function performCommit<TData>(
  runtime: SpeculationRuntime<TData>,
  intent: Intent,
  transition: boolean,
): Promise<CommitResult> {
  const result = runtime.engine.commit(intent);

  if (result.warm) {
    const warm = runtime.materializer.readWarm(intent.key);
    const data = warm ? warm.data : (result.prepared as TData);
    const node = warm
      ? warm.node
      : runtime.config.render(intent, data, { warm: true });
    reveal(runtime, intent, node, { warm: true }, transition);
    return Promise.resolve(result);
  }

  const loadingNode = runtime.config.renderLoading
    ? runtime.config.renderLoading(intent)
    : null;
  runtime.stage.set({
    intent,
    node: loadingNode,
    meta: { warm: false },
    status: "loading",
  });

  const pending = result.pending ?? Promise.resolve(undefined);
  return pending.then((prepared) => {
    const cached = runtime.materializer.readData(intent.key);
    const fallback = (prepared as { data?: TData } | undefined)?.data;
    const data = cached.present ? (cached.data as TData) : (fallback as TData);
    const node = runtime.config.render(intent, data, { warm: false });
    reveal(runtime, intent, node, { warm: false }, transition);
    return result;
  });
}

export function useCommit<TData = unknown>() {
  const runtime = useRuntime<TData>();
  return useCallback(
    (intent: Intent) => performCommit(runtime, intent, false),
    [runtime],
  );
}

export function useTransitionalCommit<TData = unknown>() {
  const runtime = useRuntime<TData>();
  return useCallback(
    (intent: Intent) => performCommit(runtime, intent, true),
    [runtime],
  );
}
