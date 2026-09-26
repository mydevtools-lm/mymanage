"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useAppStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // The screens render from an in-memory mirror; fill it from the database
    // once, on the client, so the server render stays data-free.
    void useAppStore.getState().load();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <DirectionProvider direction="rtl">
        <TooltipProvider>
          {children}
          <Toaster position="bottom-left" dir="rtl" />
        </TooltipProvider>
      </DirectionProvider>
    </ThemeProvider>
  );
}
