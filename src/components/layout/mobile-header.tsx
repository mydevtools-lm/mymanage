"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Search, Settings2, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePalette } from "@/components/command-palette";
import { APP_NAME } from "@/lib/app-info";

/** Phone top bar. Settings live here because the tab bar holds five only. */
export function MobileHeader() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden print:hidden">
      <Link href="/" className="font-bold text-primary">
        {APP_NAME}
      </Link>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="חיפוש"
          onClick={() => usePalette.getState().setOpen(true)}
        >
          <Search />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={resolvedTheme === "dark" ? "מצב בהיר" : "מצב כהה"}
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="הגדרות"
          nativeButton={false}
          render={<Link href="/settings" />}
        >
          <Settings2 />
        </Button>
      </div>
    </header>
  );
}
