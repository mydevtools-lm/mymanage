"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mainNav, isActive } from "./nav";
import { t } from "@/lib/i18n";

/** Phone navigation: the same five screens as the sidebar, at thumb reach. */
export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={t().common.nav.mainNavigation}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
    >
      <ul className="grid grid-cols-5">
        {mainNav().map(({ href, label, shortLabel, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-accent",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {shortLabel ?? label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
