"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MAIN_NAV, SETTINGS_NAV, isActive, type NavItem } from "./nav";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4" />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-6 pb-4">
        <div className="text-lg font-bold text-sidebar-primary">ניהול אישי</div>
        <div className="text-xs text-muted-foreground">Lior Management</div>
      </div>

      <nav aria-label="ניווט ראשי" className="flex flex-1 flex-col gap-1 px-3">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="grid gap-1 border-t border-sidebar-border p-3">
        <NavLink item={SETTINGS_NAV} pathname={pathname} />
        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
          <span className="dark:hidden">מצב כהה</span>
          <span className="hidden dark:inline">מצב בהיר</span>
        </Button>
      </div>
    </aside>
  );
}
