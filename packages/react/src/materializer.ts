import type { LadderLevel } from "@sre/core";
import type { ReactNode } from "react";
import { isDev } from "./dev";
import type {
  DataLookup,
  ReactMaterializer,
  RenderMeta,
  SpeculativeUIConfig,
  StageFlag,
  WarmEntry,
} from "./types";

const WARM_META: RenderMeta = { warm: true };

export function createReactMaterializer<TData>(
  config: SpeculativeUIConfig<TData>,
  stageFlag: StageFlag,
): ReactMaterializer<TData> {
  const dataCache = new Map<string, TData>();
  const nodeCache = new Map<string, ReactNode>();

  const compose: LadderLevel = {
    name: "compose",
    prepare(intent) {
      return { intent };
    },
  };

  const prefetch: LadderLevel = {
    name: "prefetch",
    async prepare(intent) {
      const data = await config.fetch(intent);
      dataCache.set(intent.key, data);
      return data;
    },
    evict(intent) {
      dataCache.delete(intent.key);
      nodeCache.delete(intent.key);
    },
  };

  const materialize: LadderLevel = {
    name: "materialize",
    prepare(intent) {
      if (!stageFlag.mounted && isDev()) {
        console.warn(
          "[sre] materialize rung reached with no <Stage> mounted for intent " +
            intent.key,
        );
      }
      const data = dataCache.get(intent.key) as TData;
      const node = config.render(intent, data, WARM_META);
      nodeCache.set(intent.key, node);
      return { data, node };
    },
    evict(intent) {
      nodeCache.delete(intent.key);
    },
  };

  return {
    ladder: [compose, prefetch, materialize],
    readWarm(key: string): WarmEntry<TData> | undefined {
      if (!nodeCache.has(key) || !dataCache.has(key)) {
        return undefined;
      }
      return {
        data: dataCache.get(key) as TData,
        node: nodeCache.get(key) as ReactNode,
      };
    },
    readData(key: string): DataLookup<TData> {
      return { present: dataCache.has(key), data: dataCache.get(key) };
    },
    clear(key: string): void {
      dataCache.delete(key);
      nodeCache.delete(key);
    },
  };
}
