import { useEffect, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRuntime } from "./context";

export interface SpeculationStageProps {
  viewTransitionName?: string | null;
  className?: string;
  style?: CSSProperties;
  fallback?: ReactNode;
}

export function SpeculationStage({
  viewTransitionName = "sre-current",
  className,
  style,
  fallback,
}: SpeculationStageProps) {
  const runtime = useRuntime();

  useEffect(() => {
    runtime.stageFlag.mounted = true;
    return () => {
      runtime.stageFlag.mounted = false;
    };
  }, [runtime]);

  const state = useSyncExternalStore(
    runtime.stage.subscribe,
    runtime.stage.get,
    runtime.stage.get,
  );

  const transitionStyle =
    viewTransitionName === null || viewTransitionName === undefined
      ? undefined
      : ({ viewTransitionName } as unknown as CSSProperties);

  const content =
    state.status === "idle" ? (fallback ?? state.node) : state.node;

  return (
    <div
      className={className}
      data-sre-status={state.status}
      data-sre-warm={String(state.meta.warm)}
      style={{ ...transitionStyle, ...style }}
    >
      {content}
    </div>
  );
}
