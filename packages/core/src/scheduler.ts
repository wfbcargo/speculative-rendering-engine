import type { IdleScheduler, ManualScheduler, ScheduledHandle } from "./types.js";

interface IdleHost {
  requestIdleCallback?: (callback: () => void) => number;
  cancelIdleCallback?: (handle: number) => void;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (handle: number) => void;
}

export function createIdleScheduler(): IdleScheduler {
  const host = globalThis as unknown as IdleHost;
  const useIdle =
    typeof host.requestIdleCallback === "function" &&
    typeof host.cancelIdleCallback === "function";
  return {
    schedule(task: () => void): ScheduledHandle {
      if (useIdle) {
        return host.requestIdleCallback!(task);
      }
      return host.setTimeout(task, 0);
    },
    cancel(handle: ScheduledHandle): void {
      if (useIdle) {
        host.cancelIdleCallback!(handle);
        return;
      }
      host.clearTimeout(handle);
    },
  };
}

export function createManualScheduler(): ManualScheduler {
  let nextHandle = 1;
  const queue = new Map<number, () => void>();
  return {
    schedule(task: () => void): ScheduledHandle {
      const handle = nextHandle;
      nextHandle += 1;
      queue.set(handle, task);
      return handle;
    },
    cancel(handle: ScheduledHandle): void {
      queue.delete(handle);
    },
    runNext(): boolean {
      const entry = queue.entries().next();
      if (entry.done) {
        return false;
      }
      const [handle, task] = entry.value;
      queue.delete(handle);
      task();
      return true;
    },
    runAll(): number {
      let ran = 0;
      while (this.runNext()) {
        ran += 1;
      }
      return ran;
    },
    pending(): number {
      return queue.size;
    },
  };
}
