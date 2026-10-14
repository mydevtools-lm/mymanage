"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isTauri } from "@/lib/platform";
import { useAppStore } from "@/lib/store";
import {
  checkForUpdate,
  installUpdateNow,
  installUpdateOnExit,
  type FoundUpdate,
} from "@/lib/desktop-updates";

// A while after opening, then once a day (DESKTOP.md 6.3).
const FIRST_CHECK_MS = 20_000;
const CHECK_EVERY_MS = 24 * 60 * 60_000;

interface UpdateState {
  found: FoundUpdate | null;
  /** Answered for this run: "later" or "on exit". */
  answered: string | null;
  check: () => Promise<FoundUpdate | null>;
}

export const useUpdate = create<UpdateState>()((set) => ({
  found: null,
  answered: null,
  check: async () => {
    const found = await checkForUpdate();
    set({ found });
    return found;
  },
}));

/** Looks for a new version and asks — never updates without asking. */
export function UpdatePrompt() {
  const hydrated = useAppStore((s) => s.hydrated);
  const found = useUpdate((s) => s.found);
  const answered = useUpdate((s) => s.answered);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    const check = () =>
      void useUpdate
        .getState()
        .check()
        .catch(() => {});
    const first = setTimeout(check, FIRST_CHECK_MS);
    const daily = setInterval(check, CHECK_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(daily);
    };
  }, [hydrated]);

  const open = !!found && answered !== found.version;
  const answer = () => useUpdate.setState({ answered: found?.version ?? null });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && answer()}>
      <DialogContent className="sm:max-w-md">
        {found && (
          <>
            <DialogHeader>
              <DialogTitle>יש גרסה חדשה — {found.version}</DialogTitle>
              <DialogDescription>
                לפני העדכון נשמר גיבוי של הנתונים. האפליקציה תיסגר ותיפתח מחדש.
              </DialogDescription>
            </DialogHeader>
            {found.notes && (
              <p className="max-h-48 overflow-y-auto whitespace-pre-line text-sm text-muted-foreground">
                {found.notes}
              </p>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={answer}>
                לא עכשיו
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  installUpdateOnExit().then(() => {
                    answer();
                    toast.success("העדכון יותקן ביציאה מהמגש");
                  })
                }
              >
                ביציאה
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  installUpdateNow().catch((error) => {
                    setBusy(false);
                    toast.error(
                      typeof error === "string" ? error : "העדכון נכשל",
                    );
                  });
                }}
              >
                {busy ? "מעדכן…" : "לעדכן עכשיו"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
