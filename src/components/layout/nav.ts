import {
  CalendarDays,
  CheckSquare,
  NotebookPen,
  Settings2,
  Sun,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { t } from "@/lib/i18n";

export interface NavItem {
  href: string;
  label: string;
  /** Fits under an icon in the phone tab bar. */
  shortLabel?: string;
  icon: LucideIcon;
}

/**
 * The five main screens. Kept to five on purpose: this same list becomes the
 * bottom tab bar on phones, which has room for five and no more. Functions,
 * not constants, so the labels are in the current language.
 */
export function mainNav(): NavItem[] {
  const nav = t().common.nav;
  return [
    { href: "/", label: nav.today, icon: Sun },
    { href: "/tasks", label: nav.tasks, icon: CheckSquare },
    { href: "/calendar", label: nav.calendar, icon: CalendarDays },
    { href: "/finance", label: nav.finance, icon: Wallet },
    {
      href: "/notes",
      label: nav.notes,
      shortLabel: nav.notesShort,
      icon: NotebookPen,
    },
  ];
}

export function settingsNav(): NavItem {
  return { href: "/settings", label: t().common.nav.settings, icon: Settings2 };
}

/** localStorage key for the collapsed desktop sidebar. */
export const SIDEBAR_KEY = "sidebar-collapsed";

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
