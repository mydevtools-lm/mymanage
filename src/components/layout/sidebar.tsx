"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, PanelRightClose, PanelRightOpen, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  MAIN_NAV,
  SETTINGS_NAV,
  SIDEBAR_KEY,
  isActive,
  type NavItem,
} from "./nav";

// Collapsed state is a data attribute on <html>, set by an inline script in
// the layout before hydration. Styling keys off it with the
// `sidebar-collapsed:` variant, so there is no flash and no React state.
function toggleCollapsed() {
  const root = document.documentElement;
  const collapsed = root.dataset.sidebar !== "collapsed";
  if (collapsed) root.dataset.sidebar = "collapsed";
  else delete root.dataset.sidebar;
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  } catch {
    // Private mode or blocked storage: the toggle still works for this visit.
  }
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors sidebar-collapsed:justify-center sidebar-collapsed:px-0",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="sidebar-collapsed:sr-only">{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex sidebar-collapsed:w-16">
      <div className="px-5 pt-6 pb-4 sidebar-collapsed:px-0 sidebar-collapsed:text-center">
        <div className="text-lg font-bold text-sidebar-primary sidebar-collapsed:hidden">
          ניהול אישי
        </div>
        <div className="text-xs text-muted-foreground sidebar-collapsed:hidden">
          Lior Management
        </div>
        <div className="hidden text-lg font-bold text-sidebar-primary sidebar-collapsed:block">
          נ
        </div>
      </div>

      <nav
        aria-label="ניווט ראשי"
        className="flex flex-1 flex-col gap-1 px-3 sidebar-collapsed:px-2"
      >
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="grid gap-1 border-t border-sidebar-border p-3 sidebar-collapsed:p-2">
        <NavLink item={SETTINGS_NAV} pathname={pathname} />
        <Button
          variant="ghost"
          title={resolvedTheme === "dark" ? "מצב בהיר" : "מצב כהה"}
          className="w-full justify-start gap-3 sidebar-collapsed:justify-center"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
          <span className="sidebar-collapsed:sr-only">
            <span className="dark:hidden">מצב כהה</span>
            <span className="hidden dark:inline">מצב בהיר</span>
          </span>
        </Button>
        <Button
          variant="ghost"
          title="כיווץ והרחבה של הסרגל"
          className="w-full justify-start gap-3 text-muted-foreground sidebar-collapsed:justify-center"
          onClick={toggleCollapsed}
        >
          <PanelRightClose className="size-4 sidebar-collapsed:hidden" />
          <PanelRightOpen className="hidden size-4 sidebar-collapsed:block" />
          <span className="sidebar-collapsed:sr-only">
            <span className="sidebar-collapsed:hidden">כיווץ הסרגל</span>
            <span className="hidden sidebar-collapsed:inline">הרחבת הסרגל</span>
          </span>
        </Button>
      </div>
    </aside>
  );
}
