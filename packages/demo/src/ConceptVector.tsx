import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { prefersReducedMotion } from "@sre/react";
import { conceptPredictor } from "./ConceptLab";
import { perfClock } from "./conceptGraph";

const DOMINANT_FULL = 2.2;
const LIT_FLOOR = 0.04;
const FAST_TICK_MS = 90;
const CALM_TICK_MS = 320;

interface Bar {
  concept: string;
  level: number;
  intensity: number;
  dominant: boolean;
}

function readBars(): Bar[] {
  const activation = conceptPredictor.conceptActivation(perfClock.now());
  let peak = LIT_FLOOR;
  for (const entry of activation) {
    if (entry.level > peak) {
      peak = entry.level;
    }
  }
  return activation.map((entry) => ({
    concept: entry.concept,
    level: entry.level,
    intensity: Math.max(0, Math.min(1, entry.level / DOMINANT_FULL)),
    dominant: entry.level >= peak && entry.level > LIT_FLOOR,
  }));
}

export function ConceptVector() {
  const [bars, setBars] = useState<Bar[]>(() => readBars());

  useEffect(() => {
    const period = prefersReducedMotion() ? CALM_TICK_MS : FAST_TICK_MS;
    const handle = globalThis.setInterval(() => {
      setBars(readBars());
    }, period);
    return () => {
      globalThis.clearInterval(handle);
    };
  }, []);

  const dominant = bars.find((bar) => bar.dominant);

  return (
    <section className="vector" aria-label="Concept activation vector">
      <div className="vector__head">
        <span className="mono-eyebrow">concept activation</span>
        <span className="vector__dominant">
          {dominant ? dominant.concept : "at rest"}
        </span>
      </div>
      <ul className="vector__bars">
        {bars.map((bar) => (
          <li
            className="vector__row"
            key={bar.concept}
            data-dominant={String(bar.dominant)}
            data-lit={String(bar.level > LIT_FLOOR)}
          >
            <span className="vector__label">{bar.concept}</span>
            <span className="vector__track">
              <span
                className="vector__fill"
                style={{ "--fill": bar.intensity.toFixed(3) } as CSSProperties}
              />
            </span>
            <span className="vector__num">{bar.level.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
