import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createDefaultPredictor } from "@sre/core";
import type { Intent } from "@sre/core";
import { defineSpeculativeUI } from "../src/index";

interface PageData {
  title: string;
}

const intentA: Intent = {
  kind: "page",
  key: "page:a",
  payload: { label: "Alpha" },
};

const intentB: Intent = {
  kind: "page",
  key: "page:b",
  payload: { label: "Beta" },
};

function fetchPage(intent: Intent): Promise<PageData> {
  const label = (intent.payload as { label: string }).label;
  return new Promise((resolve) => {
    setTimeout(() => resolve({ title: label }), 5);
  });
}

function renderPage(_intent: Intent, data: PageData, meta: { warm: boolean }) {
  return (
    <span data-testid="page" data-warm={String(meta.warm)}>
      {data ? data.title : "?"}
    </span>
  );
}

function renderLoadingPage() {
  return <span data-testid="loading">loading...</span>;
}

afterEach(() => {
  cleanup();
});

describe("defineSpeculativeUI", () => {
  it("cold commit shows renderLoading then render with meta.warm false", async () => {
    const ui = defineSpeculativeUI<PageData>({
      predict: () => [],
      fetch: fetchPage,
      render: renderPage,
      renderLoading: renderLoadingPage,
    });

    function Consumer() {
      const commit = ui.useCommit<PageData>();
      const spec = ui.useSpeculation();
      return (
        <div>
          <button
            onClick={() => {
              void commit(intentA);
            }}
          >
            go
          </button>
          <ui.Stage />
          <span data-testid="warm">{String(spec.warm)}</span>
        </div>
      );
    }

    render(
      <ui.Provider>
        <Consumer />
      </ui.Provider>,
    );

    fireEvent.click(screen.getByText("go"));
    expect(screen.getByTestId("loading")).toBeTruthy();

    await waitFor(() =>
      expect(screen.getByTestId("page").textContent).toBe("Alpha"),
    );
    expect(screen.getByTestId("page").getAttribute("data-warm")).toBe("false");
    expect(screen.getByTestId("warm").textContent).toBe("false");
  });

  it("warm commit renders instantly with meta.warm true", async () => {
    const ui = defineSpeculativeUI<PageData>({
      predict: () => [{ intent: intentA, probability: 1 }],
      fetch: fetchPage,
      render: renderPage,
      renderLoading: renderLoadingPage,
    });

    function Consumer() {
      const commit = ui.useCommit<PageData>();
      const spec = ui.useSpeculation();
      return (
        <div>
          <button
            onClick={() => {
              void commit(intentA);
            }}
          >
            go
          </button>
          <ui.Stage />
          <span data-testid="warm">{String(spec.warm)}</span>
          <span data-testid="pool">
            {spec.speculations.map((s) => s.key + ":" + s.status).join(",")}
          </span>
        </div>
      );
    }

    render(
      <ui.Provider appContext={{ ready: true }}>
        <Consumer />
      </ui.Provider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("pool").textContent).toContain("page:a:ready"),
    );

    fireEvent.click(screen.getByText("go"));

    await waitFor(() =>
      expect(screen.getByTestId("page").textContent).toBe("Alpha"),
    );
    expect(screen.getByTestId("page").getAttribute("data-warm")).toBe("true");
    expect(screen.getByTestId("warm").textContent).toBe("true");
  });

  it("mounts Provider + Stage and reveals the committed intent", async () => {
    const ui = defineSpeculativeUI<PageData>({
      predict: () => [],
      fetch: fetchPage,
      render: renderPage,
      renderLoading: renderLoadingPage,
    });

    function Consumer() {
      const commit = ui.useCommit<PageData>();
      return (
        <div>
          <button
            onClick={() => {
              void commit(intentB);
            }}
          >
            go
          </button>
          <ui.Stage viewTransitionName={null} />
        </div>
      );
    }

    const { container } = render(
      <ui.Provider>
        <Consumer />
      </ui.Provider>,
    );

    expect(
      container.querySelector('[data-sre-status="idle"]'),
    ).not.toBeNull();

    fireEvent.click(screen.getByText("go"));
    await waitFor(() =>
      expect(screen.getByTestId("page").textContent).toBe("Beta"),
    );
    expect(
      container.querySelector('[data-sre-status="ready"]'),
    ).not.toBeNull();
  });

  it("forwards learn and observe to a stateful predictor", async () => {
    const model = createDefaultPredictor();
    const learnSpy = vi.fn((from: Intent | undefined, to: Intent) => {
      model.learn?.(from, to);
    });
    const observeSpy = vi.fn();

    const ui = defineSpeculativeUI<PageData>({
      predict: (context) => model.predict(context),
      learn: learnSpy,
      observe: observeSpy,
      fetch: fetchPage,
      render: renderPage,
      renderLoading: renderLoadingPage,
    });

    function Consumer() {
      const commit = ui.useCommit<PageData>();
      const observe = ui.useObserve();
      return (
        <div>
          <button
            onClick={() => {
              void commit(intentA);
            }}
          >
            commit
          </button>
          <button
            onClick={() => observe({ type: "hover", at: 1, data: intentB })}
          >
            observe
          </button>
          <ui.Stage />
        </div>
      );
    }

    render(
      <ui.Provider>
        <Consumer />
      </ui.Provider>,
    );

    fireEvent.click(screen.getByText("commit"));
    fireEvent.click(screen.getByText("observe"));

    await waitFor(() =>
      expect(screen.getByTestId("page").textContent).toBe("Alpha"),
    );

    expect(learnSpy).toHaveBeenCalledWith(undefined, intentA);
    expect(observeSpy).toHaveBeenCalledWith({
      type: "hover",
      at: 1,
      data: intentB,
    });
    expect(model.predict({}).map((p) => p.intent.key)).toContain("page:a");
  });
});
