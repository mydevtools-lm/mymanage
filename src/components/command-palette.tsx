"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckSquare,
  ListChecks,
  NotebookPen,
  Plus,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Sun,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useQuickAdd } from "@/components/quick-add";
import { useSmartAdd } from "@/components/smart-add";
import { useOpenItem } from "@/components/open-item";
import { useAppStore } from "@/lib/store";
import { matchScore, searchAll, type ResultKind } from "@/lib/search";
import { formatDate, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const usePalette = create<PaletteState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

const KIND_META: Record<ResultKind, { label: string; icon: LucideIcon }> = {
  task: { label: "משימות", icon: CheckSquare },
  routine: { label: "משימות קבועות", icon: Repeat },
  event: { label: "אירועים", icon: CalendarDays },
  transaction: { label: "כספים", icon: Wallet },
  note: { label: "הערות", icon: NotebookPen },
  list: { label: "רשימות", icon: ListChecks },
};

interface Entry {
  key: string;
  group: string;
  icon: LucideIcon;
  title: string;
  detail?: string;
  run: () => void;
}

/**
 * Ctrl+K from anywhere: find any task, event, payment, note or list item;
 * start something new; go to a screen; or add a whole sentence at once.
 */
export function CommandPalette() {
  const open = usePalette((s) => s.open);
  const setOpen = usePalette((s) => s.setOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // By key position, so it works with the Hebrew layout too.
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") {
        e.preventDefault();
        setOpen(!usePalette.getState().open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[12%] translate-y-0 gap-0 p-0 sm:max-w-xl max-sm:top-0">
        <DialogTitle className="sr-only">חיפוש ופעולות</DialogTitle>
        {open && <Palette onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Palette({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const openNew = useQuickAdd((s) => s.open);
  const openSmart = useSmartAdd((s) => s.open);
  const openItem = useOpenItem();
  const tasks = useAppStore((s) => s.tasks);
  const routines = useAppStore((s) => s.routines);
  const events = useAppStore((s) => s.events);
  const transactions = useAppStore((s) => s.transactions);
  const notes = useAppStore((s) => s.notes);
  const checklists = useAppStore((s) => s.checklists);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => {
    const go = (fn: () => void) => () => {
      onDone();
      fn();
    };
    const actions: Entry[] = [
      {
        key: "new-task",
        group: "חדש",
        icon: Plus,
        title: "משימה חדשה",
        run: go(() => openNew("task")),
      },
      {
        key: "new-event",
        group: "חדש",
        icon: Plus,
        title: "אירוע חדש",
        run: go(() => openNew("event")),
      },
      {
        key: "new-tx",
        group: "חדש",
        icon: Plus,
        title: "תנועה חדשה",
        run: go(() => openNew("transaction")),
      },
      {
        key: "new-item",
        group: "חדש",
        icon: Plus,
        title: "פריט לרשימה",
        run: go(() => openNew("item")),
      },
      {
        key: "smart",
        group: "חדש",
        icon: Sparkles,
        title: "הוספה במשפט",
        run: go(() => openSmart()),
      },
      {
        key: "go-today",
        group: "מעבר",
        icon: Sun,
        title: "היום",
        run: go(() => router.push("/")),
      },
      {
        key: "go-tasks",
        group: "מעבר",
        icon: CheckSquare,
        title: "משימות",
        run: go(() => router.push("/tasks")),
      },
      {
        key: "go-cal",
        group: "מעבר",
        icon: CalendarDays,
        title: "יומן",
        run: go(() => router.push("/calendar")),
      },
      {
        key: "go-fin",
        group: "מעבר",
        icon: Wallet,
        title: "כספים",
        run: go(() => router.push("/finance")),
      },
      {
        key: "go-notes",
        group: "מעבר",
        icon: NotebookPen,
        title: "הערות ורשימות",
        run: go(() => router.push("/notes")),
      },
      {
        key: "go-settings",
        group: "מעבר",
        icon: Settings,
        title: "הגדרות",
        run: go(() => router.push("/settings")),
      },
    ];
    if (!query.trim()) return actions;

    const found: Entry[] = searchAll(
      query,
      { tasks, routines, events, transactions, notes, checklists },
      todayKey(),
    ).map((r) => ({
      key: `${r.kind}-${r.id}`,
      group: KIND_META[r.kind].label,
      icon: KIND_META[r.kind].icon,
      title: r.title,
      detail:
        r.detail && /^\d{4}-\d{2}-\d{2}$/.test(r.detail)
          ? formatDate(r.detail)
          : r.detail,
      run: go(() => openItem(r.kind, r.id)),
    }));
    const smart: Entry[] =
      query.trim().length >= 3
        ? [
            {
              key: "smart-query",
              group: "הוספה",
              icon: Sparkles,
              title: `להוסיף: ״${query.trim()}״`,
              run: go(() => openSmart(query.trim())),
            },
          ]
        : [];
    const matching = actions.filter((a) => matchScore(query, a.title) > 0);
    return [...found, ...matching, ...smart];
  }, [
    query,
    tasks,
    routines,
    events,
    transactions,
    notes,
    checklists,
    onDone,
    openNew,
    openSmart,
    openItem,
    router,
  ]);

  const current = Math.min(active, Math.max(0, entries.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current]);

  let lastGroup = "";
  return (
    <div className="grid">
      <div className="flex items-center gap-2 border-b ps-3 pe-11">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-activedescendant={
            entries[current] ? `palette-${current}` : undefined
          }
          aria-label="חיפוש ופעולות"
          placeholder="חיפוש בכל המערכת, או מה להוסיף…"
          className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          value={query}
          autoFocus
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive(Math.min(current + 1, entries.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive(Math.max(current - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              entries[current]?.run();
            }
          }}
        />
      </div>
      <div
        id="palette-list"
        role="listbox"
        aria-label="תוצאות"
        ref={listRef}
        className="max-h-[60dvh] overflow-y-auto p-1.5"
      >
        {entries.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            לא נמצא כלום.
          </p>
        )}
        {entries.map((entry, index) => {
          const header = entry.group !== lastGroup ? entry.group : null;
          lastGroup = entry.group;
          const Icon = entry.icon;
          return (
            <div key={entry.key} role="presentation">
              {header && (
                <div
                  role="presentation"
                  className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground"
                >
                  {header}
                </div>
              )}
              <div
                id={`palette-${index}`}
                data-index={index}
                role="option"
                aria-selected={index === current}
                onMouseMove={() => setActive(index)}
                onClick={entry.run}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm",
                  index === current && "bg-accent text-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                {entry.detail && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {entry.detail}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
