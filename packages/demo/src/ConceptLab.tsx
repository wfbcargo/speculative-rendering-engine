import { useCallback, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import type { Intent, Speculation } from "@sre/core";
import { createGraphPredictor } from "@sre/core";
import {
  defineSpeculativeUI,
  prefersReducedMotion,
  useEngine,
  useSpeculation,
  useTransitionalCommit,
} from "@sre/react";
import {
  ACTION_OPEN,
  clusters,
  graphConfig,
  intentFor,
  perfClock,
  surfaceById,
} from "./conceptGraph";
import type { SurfaceMeta } from "./conceptGraph";

const FETCH_LATENCY_MS = 220;
const COOL_TICK_MS = 1200;

export const conceptPredictor = createGraphPredictor(graphConfig);

interface SurfaceData {
  meta: SurfaceMeta;
  fetchedAt: number;
}

function idFromKey(key: string): string {
  const separator = key.indexOf(":");
  return separator === -1 ? key : key.slice(separator + 1);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function targetLevelFor(probability: number, ladderLength: number): number {
  if (ladderLength === 0) {
    return -1;
  }
  if (probability >= 0.18) {
    return ladderLength - 1;
  }
  if (probability >= 0.06) {
    return 1;
  }
  return 0;
}

export const lab = defineSpeculativeUI<SurfaceData>({
  predict: conceptPredictor.predict,
  observe: conceptPredictor.observe,
  learn: conceptPredictor.learn,
  clock: perfClock,
  targetLevelFor,
  async fetch(intent) {
    const meta = surfaceById.get(idFromKey(intent.key));
    await delay(FETCH_LATENCY_MS);
    return {
      meta: meta ?? fallbackMeta(intent),
      fetchedAt: perfClock.now(),
    };
  },
  render(_intent, data, meta) {
    return <SurfacePanel data={data} warm={meta.warm} />;
  },
  renderLoading() {
    return <SurfaceLoading />;
  },
});

function fallbackMeta(intent: Intent): SurfaceMeta {
  return {
    id: idFromKey(intent.key),
    concept: "Exploring",
    title: "Surface",
    kicker: "unmapped",
    lead: "No fixture bound to this surface.",
    rows: [],
    metric: { label: "n/a", value: "0" },
  };
}

function heatValue(spec: Speculation | undefined): number {
  if (spec === undefined) {
    return 0;
  }
  const levelPart = (spec.currentLevel + 1) / 3;
  const readiness = spec.status === "ready" ? 1 : 0.62;
  const blended = levelPart * readiness + spec.probability * 0.45;
  return Math.max(0, Math.min(1, blended));
}

function heatLabel(heat: number): string {
  if (heat <= 0.001) {
    return "cold";
  }
  if (heat < 0.5) {
    return "warming";
  }
  if (heat < 0.85) {
    return "warm";
  }
  return "primed";
}

function SurfacePanel({ data, warm }: { data: SurfaceData; warm: boolean }) {
  const { meta } = data;
  return (
    <article className="surface-panel" data-warm={String(warm)}>
      <header className="surface-panel__head">
        <span className="tag">{meta.concept}</span>
        <span className="surface-panel__flag">{warm ? "warm hit" : "cold fetch"}</span>
      </header>
      <h3 className="surface-panel__title">{meta.title}</h3>
      <p className="surface-panel__lead">{meta.lead}</p>
      <ul className="surface-panel__rows">
        {meta.rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
      <footer className="surface-panel__foot">
        <span className="metric-value">{meta.metric.value}</span>
        <span className="metric-label">{meta.metric.label}</span>
      </footer>
    </article>
  );
}

function SurfaceLoading() {
  return (
    <div className="surface-loading" aria-hidden="true">
      <span className="surface-loading__bar" />
      <span className="surface-loading__bar surface-loading__bar--wide" />
      <span className="surface-loading__bar surface-loading__bar--short" />
    </div>
  );
}

function StageIdle() {
  return (
    <div className="stage-idle">
      <span className="stage-idle__dot" />
      <p>Open a surface. Warm ones reveal instantly.</p>
    </div>
  );
}

function SurfaceCard({
  surface,
  heat,
  onHover,
  onOpen,
  active,
}: {
  surface: SurfaceMeta;
  heat: number;
  onHover: (id: string) => void;
  onOpen: (id: string) => void;
  active: boolean;
}) {
  const label = heatLabel(heat);
  return (
    <button
      type="button"
      className="surface-card"
      data-heat={label}
      data-active={String(active)}
      style={{ "--heat": heat.toFixed(3) } as CSSProperties}
      onPointerEnter={() => onHover(surface.id)}
      onFocus={() => onHover(surface.id)}
      onClick={() => onOpen(surface.id)}
    >
      <span className="surface-card__heat" aria-hidden="true" />
      <span className="surface-card__title">{surface.title}</span>
      <span className="surface-card__kicker">{surface.kicker}</span>
      <span className="surface-card__state">{label}</span>
    </button>
  );
}

export function ConceptLab() {
  const engine = useEngine();
  const commit = useTransitionalCommit<SurfaceData>();
  const view = useSpeculation();

  const heatByKey = useMemo(() => {
    const map = new Map<string, Speculation>();
    for (const spec of view.speculations) {
      map.set(spec.key, spec);
    }
    return map;
  }, [view.speculations]);

  const activeKey = view.current?.key;

  const onHover = useCallback(
    (id: string) => {
      engine.observe({ type: "hover", at: perfClock.now(), data: id });
      engine.predict();
    },
    [engine],
  );

  const onOpen = useCallback(
    (id: string) => {
      commit(intentFor(id));
      engine.observe({ type: ACTION_OPEN, at: perfClock.now(), data: id });
      engine.predict();
    },
    [engine, commit],
  );

  useEffect(() => {
    const period = prefersReducedMotion() ? COOL_TICK_MS * 2 : COOL_TICK_MS;
    const handle = globalThis.setInterval(() => {
      engine.predict();
    }, period);
    return () => {
      globalThis.clearInterval(handle);
    };
  }, [engine]);

  return (
    <section className="lab" aria-label="Concept Lab">
      <div className="lab__clusters">
        {clusters.map((cluster) => (
          <div className="cluster" key={cluster.concept}>
            <div className="cluster__head">
              <span className="tag">{cluster.concept}</span>
              <span className="cluster__blurb">{cluster.blurb}</span>
            </div>
            <div className="cluster__cards">
              {cluster.surfaces.map((surface) => {
                const key = intentFor(surface.id).key;
                return (
                  <SurfaceCard
                    key={surface.id}
                    surface={surface}
                    heat={heatValue(heatByKey.get(key))}
                    active={key === activeKey}
                    onHover={onHover}
                    onOpen={onOpen}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="lab__stage">
        <div className="lab__stage-label">
          <span className="mono-eyebrow">reveal</span>
          <span data-warm={String(view.warm)} className="lab__stage-warm">
            {view.status === "ready" ? (view.warm ? "instant" : "fetched") : "idle"}
          </span>
        </div>
        <lab.Stage className="stage" fallback={<StageIdle />} />
      </div>
    </section>
  );
}
