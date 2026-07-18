export interface ViewTransitionHandle {
  finished: Promise<void>;
  skipped: boolean;
}

export interface ViewTransitionOptions {
  disabled?: boolean;
}

interface ViewTransitionDocument {
  startViewTransition?(callback: () => void | Promise<void>): {
    finished: Promise<void>;
  };
}

interface MediaQueryHost {
  matchMedia?(query: string): { matches: boolean };
}

export function prefersReducedMotion(): boolean {
  const host = globalThis as MediaQueryHost;
  if (typeof host.matchMedia !== "function") {
    return false;
  }
  return host.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function withViewTransition(
  update: () => void,
  options: ViewTransitionOptions = {},
): ViewTransitionHandle {
  const doc = (globalThis as { document?: ViewTransitionDocument }).document;
  const supported =
    doc !== undefined && typeof doc.startViewTransition === "function";
  if (!supported || options.disabled === true || prefersReducedMotion()) {
    update();
    return { finished: Promise.resolve(), skipped: true };
  }
  let ran = false;
  try {
    const transition = doc!.startViewTransition!(() => {
      ran = true;
      update();
    });
    return {
      finished: transition.finished.then(() => undefined).catch(() => undefined),
      skipped: false,
    };
  } catch {
    if (!ran) {
      update();
    }
    return { finished: Promise.resolve(), skipped: true };
  }
}
