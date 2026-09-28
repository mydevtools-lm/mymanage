import {
  CalendarDays,
  CheckSquare,
  NotebookPen,
  Settings2,
  Sun,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** Fits under an icon in the phone tab bar. */
  shortLabel?: string;
  icon: LucideIcon;
}

/**
 * The five main screens. Kept to five on purpose: this same list becomes the
 * bottom tab bar on phones, which has room for five and no more.
 */
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "היום", icon: Sun },
  { href: "/tasks", label: "משימות", icon: CheckSquare },
  { href: "/calendar", label: "יומן", icon: CalendarDays },
  { href: "/finance", label: "כספים", icon: Wallet },
  {
    href: "/notes",
    label: "הערות ורשימות",
    shortLabel: "רשימות",
    icon: NotebookPen,
  },
];

export const SETTINGS_NAV: NavItem = {
  href: "/settings",
  label: "הגדרות",
  icon: Settings2,
};

/** localStorage key for the collapsed desktop sidebar. */
export const SIDEBAR_KEY = "sidebar-collapsed";

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
