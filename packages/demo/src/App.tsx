import { ConceptLab, lab } from "./ConceptLab";
import { ConceptVector } from "./ConceptVector";
import { Sparkline } from "./Sparkline";
import { WarmColdRace } from "./WarmColdRace";

export function App() {
  return (
    <div className="console">
      <header className="console__head">
        <div className="console__brand">
          <span className="console__mark" aria-hidden="true" />
          <div>
            <h1 className="console__title">Signal Lab</h1>
            <p className="console__sub">
              speculative rendering engine, live. Activity concepts light up,
              activation spreads, surfaces pre-warm before you touch them.
            </p>
          </div>
        </div>
        <span className="console__tag mono-eyebrow">graph-activation predictor</span>
      </header>

      <lab.Provider>
        <main className="console__grid">
          <ConceptLab />
          <aside className="console__rail">
            <ConceptVector />
            <Sparkline />
          </aside>
        </main>
      </lab.Provider>

      <WarmColdRace />

      <footer className="console__foot">
        <span>predict / pre-warm / reveal</span>
        <span className="mono-eyebrow">@sre/core + @sre/react</span>
      </footer>
    </div>
  );
}
