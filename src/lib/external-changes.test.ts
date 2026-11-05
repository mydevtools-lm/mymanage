import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchExternalChanges } from "./external-changes";

describe("watchExternalChanges", () => {
  const listeners = new Map<string, () => void>();
  let version: number;
  let busy: boolean;
  let reload: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let stop: () => void;

  const start = () => {
    stop = watchExternalChanges(
      { read: async () => version, reload, busy: () => busy },
      1000,
    );
  };
  const tick = () => vi.advanceTimersByTimeAsync(1000);

  beforeEach(() => {
    vi.useFakeTimers();
    listeners.clear();
    vi.stubGlobal("window", {
      addEventListener: (name: string, fn: () => void) =>
        listeners.set(name, fn),
      removeEventListener: (name: string) => listeners.delete(name),
    });
    version = 7;
    busy = false;
    reload = vi.fn(async () => {});
  });

  afterEach(() => {
    stop?.();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does nothing while nobody else writes", async () => {
    start();
    await tick();
    await tick();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once for each change from outside", async () => {
    start();
    await tick();
    version = 8;
    await tick();
    expect(reload).toHaveBeenCalledTimes(1);
    await tick();
    expect(reload).toHaveBeenCalledTimes(1);
    version = 9;
    await tick();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("waits for the app's own save, then reloads", async () => {
    start();
    await tick();
    version = 8;
    busy = true;
    await tick();
    expect(reload).not.toHaveBeenCalled();
    busy = false;
    await tick();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("looks at once when the window comes back", async () => {
    start();
    await tick();
    version = 8;
    listeners.get("focus")!();
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("survives a failed look", async () => {
    let failing = true;
    stop = watchExternalChanges(
      {
        read: async () => {
          if (failing) throw new Error("locked");
          return version;
        },
        reload,
        busy: () => false,
      },
      1000,
    );
    await tick();
    failing = false;
    await tick();
    version = 8;
    await tick();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("stops", async () => {
    start();
    await tick();
    stop();
    version = 8;
    await tick();
    expect(reload).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });
});
