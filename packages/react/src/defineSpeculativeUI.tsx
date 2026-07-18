import { useRef } from "react";
import type { ReactElement } from "react";
import {
  createEngine,
  createFixedBudget,
  createIdleScheduler,
  systemClock,
} from "@sre/core";
import type { PredictContext, Prediction, Predictor } from "@sre/core";
import {
  SpeculationProvider,
  createStageStore,
  createVersionStore,
} from "./context";
import { createReactMaterializer } from "./materializer";
import { isDev } from "./dev";
import { SpeculationStage } from "./Stage";
import type { SpeculationStageProps } from "./Stage";
import { useCommit, useTransitionalCommit } from "./commit";
import {
  useEngine,
  useObserve,
  useSetContext,
  useSpeculation,
  useTrajectory,
} from "./hooks";
import type {
  ProviderProps,
  SpeculationRuntime,
  SpeculativeUIConfig,
  StageFlag,
} from "./types";

function guardPredict(
  predict: (context: PredictContext) => Prediction[],
): (context: PredictContext) => Prediction[] {
  return (context: PredictContext) => {
    const predictions = predict(context);
    if (isDev()) {
      const seen = new Set<string>();
      for (const prediction of predictions) {
        if (seen.has(prediction.intent.key)) {
          console.warn(
            "[sre] duplicate intent key in predictions: " +
              prediction.intent.key,
          );
        }
        seen.add(prediction.intent.key);
      }
    }
    return predictions;
  };
}

function createRuntime<TData>(
  config: SpeculativeUIConfig<TData>,
): SpeculationRuntime<TData> {
  const stageFlag: StageFlag = { mounted: false };
  const materializer = createReactMaterializer(config, stageFlag);
  const version = createVersionStore();
  const stage = createStageStore(config.initialView ?? null);
  const predictor: Predictor = {
    predict: guardPredict(config.predict),
    learn: config.learn,
    observe: config.observe,
  };
  const engine = createEngine({
    predictor,
    ladder: materializer.ladder,
    budget: config.budget ?? createFixedBudget([16, 8, 4]),
    clock: config.clock ?? systemClock,
    scheduler: config.scheduler ?? createIdleScheduler(),
    onTelemetry(event) {
      version.bump();
      config.onTelemetry?.(event);
    },
    targetLevelFor: config.targetLevelFor,
  });
  return { engine, materializer, stage, version, config, stageFlag };
}

export interface SpeculativeUI<TData = unknown> {
  Provider(props: ProviderProps): ReactElement;
  Stage(props: SpeculationStageProps): ReactElement;
  useCommit: typeof useCommit;
  useTransitionalCommit: typeof useTransitionalCommit;
  useSetContext: typeof useSetContext;
  useObserve: typeof useObserve;
  useTrajectory: typeof useTrajectory;
  useSpeculation: typeof useSpeculation;
  useEngine: typeof useEngine;
}

export function defineSpeculativeUI<TData = unknown>(
  config: SpeculativeUIConfig<TData>,
): SpeculativeUI<TData> {
  function Provider({ appContext, children }: ProviderProps): ReactElement {
    const ref = useRef<SpeculationRuntime<TData> | null>(null);
    if (ref.current === null) {
      ref.current = createRuntime(config);
    }
    return (
      <SpeculationProvider runtime={ref.current} appContext={appContext}>
        {children}
      </SpeculationProvider>
    );
  }

  return {
    Provider,
    Stage: SpeculationStage,
    useCommit,
    useTransitionalCommit,
    useSetContext,
    useObserve,
    useTrajectory,
    useSpeculation,
    useEngine,
  };
}
