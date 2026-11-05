/**
 * The screens render from an in-memory mirror, so a write from outside the app
 * (a chat through the MCP server) would not show until the next start. This
 * asks the database every few seconds whether someone else has written, and
 * reloads the mirror when so. Asking costs one small query and changes nothing.
 *
 * It keeps asking while the window is hidden: the app lives in the tray, and
 * its reminders read the mirror too.
 */

const EVERY_MS = 3000;

export interface ExternalChangeWatch {
  /** The database's data version (repo.dataVersion). */
  read: () => Promise<number>;
  /** Reloads the mirror. */
  reload: () => Promise<void>;
  /** A save of the app's own is on its way: a reload now could put the old
   *  value back on screen, so wait for the next look. */
  busy: () => boolean;
}

export function watchExternalChanges(
  { read, reload, busy }: ExternalChangeWatch,
  every = EVERY_MS,
) {
  let known: number | null = null;
  let looking = false;

  const look = async () => {
    if (looking) return;
    looking = true;
    try {
      const version = await read();
      if (known === null) {
        known = version;
      } else if (version !== known && !busy()) {
        known = version;
        await reload();
      }
    } catch {
      // Not worth troubling anyone: the next look tries again.
    } finally {
      looking = false;
    }
  };

  void look();
  const timer = setInterval(() => void look(), every);
  // Coming back to the window is when a stale screen would be noticed.
  const onFocus = () => void look();
  window.addEventListener("focus", onFocus);
  return () => {
    clearInterval(timer);
    window.removeEventListener("focus", onFocus);
  };
}
