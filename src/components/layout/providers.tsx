"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useAppStore } from "@/lib/store";
import { todayKey } from "@/lib/format";

export function Providers({ children }: { children: React.ReactNode }) {
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
      <DirectionProvider direction="rtl">
        <TooltipProvider>
          {children}
          {/* On phones, sit above the bottom tab bar and the "+" button. */}
          <Toaster
            position="bottom-left"
            dir="rtl"
            mobileOffset={{
              bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
            }}
          />
        </TooltipProvider>
      </DirectionProvider>
    </ThemeProvider>
  );
}
