"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuickAdd } from "@/components/quick-add";

// What "N" creates depends on where you are.
const NEW_BY_ROUTE: Record<string, "task" | "event" | "transaction" | "item"> =
  {
    "/": "task",
    "/tasks": "task",
    "/calendar": "event",
    "/finance": "transaction",
    "/notes": "item",
  };

const SHORTCUTS = [
  { keys: "Ctrl K", what: "חיפוש בכל המערכת, והוספה במשפט" },
  { keys: "N", what: "חדש — משימה, אירוע, תנועה או פריט, לפי המסך" },
  { keys: "/", what: "מעבר לחיפוש במסך" },
  { keys: "T", what: "מעבר למסך ״היום״" },
  { keys: "?", what: "הרשימה הזו" },
  { keys: "Esc", what: "סגירת חלון" },
];

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) ||
    el.getAttribute("role") === "combobox"
  );
}

/**
 * Desktop keyboard shortcuts. Keys are matched by physical position
 * (event.code), so they work the same with the Hebrew layout active —
 * where the N key types "מ".
 */
export function Shortcuts() {
  const pathname = usePathname();
  const router = useRouter();
  const openQuickAdd = useQuickAdd((s) => s.open);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target)) return;
      // Leave the keyboard to an open dialog or menu.
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;

      if (e.code === "Slash" && e.shiftKey) {
        e.preventDefault();
        setHelp(true);
      } else if (e.code === "Slash") {
        const search = [
          ...document.querySelectorAll<HTMLInputElement>("[data-search]"),
        ].find((el) => el.offsetParent !== null);
        if (search) {
          e.preventDefault();
          search.focus();
          search.select();
        }
      } else if (e.code === "KeyN" && !e.shiftKey) {
        const kind = NEW_BY_ROUTE[pathname];
        if (kind) {
          e.preventDefault();
          openQuickAdd(kind);
        }
      } else if (e.code === "KeyT" && !e.shiftKey) {
        e.preventDefault();
        router.push("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router, openQuickAdd]);

  return (
    <Dialog open={help} onOpenChange={setHelp}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>קיצורי מקלדת</DialogTitle>
          <DialogDescription>
            עובדים גם כשהמקלדת בעברית. לא פעילים בזמן הקלדה בשדה.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2">
          {SHORTCUTS.map(({ keys, what }) => (
            <div key={keys} className="flex items-center gap-3">
              <dt>
                <kbd className="inline-flex min-w-8 justify-center rounded-md border bg-muted px-2 py-0.5 font-mono text-sm">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-sm">{what}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
