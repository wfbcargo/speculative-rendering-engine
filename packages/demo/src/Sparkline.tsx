import { useEngine, useSpeculation } from "@sre/react";

const WIDTH = 240;
const HEIGHT = 56;
const PADDING = 4;

function buildPath(history: number[]): string {
  if (history.length === 0) {
    return "";
  }
  const span = WIDTH - PADDING * 2;
  const rise = HEIGHT - PADDING * 2;
  const step = history.length === 1 ? 0 : span / (history.length - 1);
  return history
    .map((value, index) => {
      const x = PADDING + step * index;
      const y = PADDING + rise * (1 - Math.max(0, Math.min(1, value)));
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function Sparkline() {
  useSpeculation();
  const engine = useEngine();
  const history = engine.metrics.hitRateHistory();
  const snapshot = engine.metrics.snapshot();
  const path = buildPath(history);
  const areaPath =
    path === ""
      ? ""
      : `${path} L${(WIDTH - PADDING).toFixed(1)} ${(HEIGHT - PADDING).toFixed(
          1,
        )} L${PADDING.toFixed(1)} ${(HEIGHT - PADDING).toFixed(1)} Z`;

  return (
    <section className="spark" aria-label="Hit rate">
      <div className="spark__head">
        <span className="mono-eyebrow">hit rate</span>
        <span className="spark__rate">
          {(snapshot.hitRate * 100).toFixed(0)}
          <span className="spark__pct">%</span>
        </span>
      </div>
      <svg
        className="spark__chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Warm commit rate ${(snapshot.hitRate * 100).toFixed(0)} percent`}
      >
        <line
          className="spark__mid"
          x1={PADDING}
          y1={HEIGHT / 2}
          x2={WIDTH - PADDING}
          y2={HEIGHT / 2}
        />
        {areaPath !== "" ? <path className="spark__area" d={areaPath} /> : null}
        {path !== "" ? <path className="spark__line" d={path} /> : null}
      </svg>
      <div className="spark__legend">
        <span>
          <b>{snapshot.warm}</b> warm
        </span>
        <span>
          <b>{snapshot.cold}</b> cold
        </span>
        <span>
          <b>{snapshot.commits}</b> commits
        </span>
      </div>
    </section>
  );
}
