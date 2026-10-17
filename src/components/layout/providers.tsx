"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useAppStore } from "@/lib/store";
import { todayKey } from "@/lib/format";
import { dirOf, useLocale } from "@/lib/i18n";

const never = () => () => {};

/**
 * The app renders on the client only (there is nothing to show before the
 * data loads anyway), so every text can come from `t()` in the current
 * language without a server copy to match. Keyed by the language: switching
 * renders every screen again.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const mounted = useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
  const dir = dirOf(locale);

  useEffect(() => {
    // The screens render from an in-memory mirror; fill it from the database
    // once, on the client, so the server render stays data-free.
    void useAppStore.getState().load();

    // Coming back to the app on a new day: load again, which is also when
    // the server makes that day's copies of routines.
    let loadedOn = todayKey();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (todayKey() === loadedOn) return;
      loadedOn = todayKey();
      void useAppStore.getState().load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <DirectionProvider direction={dir}>
        <TooltipProvider key={locale}>
          {mounted ? children : null}
          {/* On phones, sit above the bottom tab bar and the "+" button. At
              the end of the line: left in Hebrew, right in English. */}
          <Toaster
            position={dir === "rtl" ? "bottom-left" : "bottom-right"}
            dir={dir}
            mobileOffset={{
              bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
            }}
          />
        </TooltipProvider>
      </DirectionProvider>
    </ThemeProvider>
  );
}
