import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import type { Intent } from "@sre/core";
import {
  defineSpeculativeUI,
  useEngine,
  useSetContext,
  useTransitionalCommit,
} from "@sre/react";
import type { SpeculationStageProps } from "@sre/react";
import { perfClock } from "./conceptGraph";

const RACE_FETCH_MS = 260;
const POLL_MS = 40;
const RACE_INTENT: Intent = { kind: "surface", key: "race:analysis-report" };
const ARM_CONTEXT = "arm";

interface RaceData {
  title: string;
  lines: string[];
}

const RACE_PAYLOAD: RaceData = {
  title: "Q3 Analysis Report",
  lines: [
    "Revenue +12.4% quarter over quarter",
    "Expansion cohort outpacing new logos",
    "One enterprise account flagged at-risk",
  ],
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function RacePanel({ warm }: { warm: boolean }) {
  return (
    <article className="race-panel" data-warm={String(warm)}>
      <span className="race-panel__flag">{warm ? "served warm" : "served cold"}</span>
      <h4 className="race-panel__title">{RACE_PAYLOAD.title}</h4>
      <ul className="race-panel__lines">
        {RACE_PAYLOAD.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </article>
  );
}

function createRaceLane(prewarms: boolean) {
  return defineSpeculativeUI<RaceData>({
    predict(context) {
      if (prewarms && context.appContext === ARM_CONTEXT) {
        return [{ intent: RACE_INTENT, probability: 0.99 }];
      }
      return [];
    },
    clock: perfClock,
    async fetch() {
      await delay(RACE_FETCH_MS);
      return RACE_PAYLOAD;
    },
    render(_intent, _data, meta) {
      return <RacePanel warm={meta.warm} />;
    },
    renderLoading() {
      return (
        <div className="race-panel race-panel--loading" aria-hidden="true">
          <span className="race-panel__spin" />
          fetching
        </div>
      );
    },
  });
}

const warmLane = createRaceLane(true);
const coldLane = createRaceLane(false);

type LaneMode = "warm" | "cold";

interface RaceLaneProps {
  Stage: ComponentType<SpeculationStageProps>;
  mode: LaneMode;
  armNonce: number;
  runNonce: number;
  ms: number | null;
  onArmed: () => void;
  onResult: (mode: LaneMode, ms: number) => void;
}

function RaceLane({
  Stage,
  mode,
  armNonce,
  runNonce,
  ms,
  onArmed,
  onResult,
}: RaceLaneProps) {
  const engine = useEngine();
  const setContext = useSetContext();
  const commit = useTransitionalCommit<RaceData>();

  useEffect(() => {
    if (mode !== "warm") {
      return;
    }
    let cancelled = false;
    setContext(ARM_CONTEXT);
    const poll = () => {
      if (cancelled) {
        return;
      }
      const ready = engine
        .speculations()
        .some(
          (spec) => spec.key === RACE_INTENT.key && spec.status === "ready",
        );
      if (ready) {
        onArmed();
        return;
      }
      globalThis.setTimeout(poll, POLL_MS);
    };
    const handle = globalThis.setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(handle);
    };
  }, [mode, armNonce, engine, setContext, onArmed]);

  useEffect(() => {
    if (runNonce === 0) {
      return;
    }
    let cancelled = false;
    const started = perfClock.now();
    Promise.resolve(commit(RACE_INTENT)).then(() => {
      if (cancelled) {
        return;
      }
      onResult(mode, perfClock.now() - started);
    });
    return () => {
      cancelled = true;
    };
  }, [runNonce]);

  return (
    <div className="lane" data-mode={mode}>
      <div className="lane__head">
        <span className="tag">{mode}</span>
        <span className="lane__ms">
          {ms === null ? "--" : `${ms.toFixed(1)} ms`}
        </span>
      </div>
      <Stage className="lane__stage" fallback={<div className="lane__idle">standby</div>} />
    </div>
  );
}

export function WarmColdRace() {
  const [armNonce, setArmNonce] = useState(1);
  const [runNonce, setRunNonce] = useState(0);
  const [warmArmed, setWarmArmed] = useState(false);
  const [warmMs, setWarmMs] = useState<number | null>(null);
  const [coldMs, setColdMs] = useState<number | null>(null);

  const onResult = (mode: LaneMode, value: number) => {
    if (mode === "warm") {
      setWarmMs(value);
    } else {
      setColdMs(value);
    }
  };

  useEffect(() => {
    if (warmMs !== null && coldMs !== null) {
      setArmNonce((value) => value + 1);
    }
  }, [warmMs, coldMs]);

  const run = () => {
    setWarmMs(null);
    setColdMs(null);
    setWarmArmed(false);
    setRunNonce((value) => value + 1);
  };

  const delta =
    warmMs !== null && coldMs !== null ? coldMs - warmMs : null;

  return (
    <section className="race" aria-label="Warm versus cold race">
      <div className="race__head">
        <div>
          <span className="mono-eyebrow">warm vs cold</span>
          <p className="race__caption">
            The same intent, revealed from the pre-warmed pool and from a cold
            fetch.
          </p>
        </div>
        <button
          type="button"
          className="race__run"
          onClick={run}
          disabled={!warmArmed}
        >
          {warmArmed ? "Run race" : "Warming target"}
        </button>
      </div>
      <div className="race__lanes">
        <warmLane.Provider>
          <RaceLane
            Stage={warmLane.Stage}
            mode="warm"
            armNonce={armNonce}
            runNonce={runNonce}
            ms={warmMs}
            onArmed={() => setWarmArmed(true)}
            onResult={onResult}
          />
        </warmLane.Provider>
        <coldLane.Provider>
          <RaceLane
            Stage={coldLane.Stage}
            mode="cold"
            armNonce={armNonce}
            runNonce={runNonce}
            ms={coldMs}
            onArmed={() => undefined}
            onResult={onResult}
          />
        </coldLane.Provider>
      </div>
      <div className="race__delta" data-active={String(delta !== null)}>
        {delta !== null
          ? `warm reveal ${delta.toFixed(0)} ms ahead`
          : "run the race to measure the gap"}
      </div>
    </section>
  );
}
