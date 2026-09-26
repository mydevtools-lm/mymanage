"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useAppStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Persist is created with skipHydration so the server render never
    // touches localStorage; hydrate once on the client.
    useAppStore.persist.rehydrate();
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
