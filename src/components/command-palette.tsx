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
import { t } from "@/lib/i18n";

interface PaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const usePalette = create<PaletteState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

function kindMeta(): Record<ResultKind, { label: string; icon: LucideIcon }> {
  const kinds = t().common.palette.kinds;
  return {
    task: { label: kinds.task, icon: CheckSquare },
    routine: { label: kinds.routine, icon: Repeat },
    event: { label: kinds.event, icon: CalendarDays },
    transaction: { label: kinds.transaction, icon: Wallet },
    note: { label: kinds.note, icon: NotebookPen },
    list: { label: kinds.list, icon: ListChecks },
  };
}

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
        <DialogTitle className="sr-only">
          {t().common.palette.title}
        </DialogTitle>
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

  const m = t().common.palette;
  const nav = t().common.nav;

  const entries = useMemo(() => {
    const go = (fn: () => void) => () => {
      onDone();
      fn();
    };
    const actions: Entry[] = [
      {
        key: "new-task",
        group: m.groupNew,
        icon: Plus,
        title: m.newTask,
        run: go(() => openNew("task")),
      },
      {
        key: "new-event",
        group: m.groupNew,
        icon: Plus,
        title: m.newEvent,
        run: go(() => openNew("event")),
      },
      {
        key: "new-tx",
        group: m.groupNew,
        icon: Plus,
        title: m.newTransaction,
        run: go(() => openNew("transaction")),
      },
      {
        key: "new-item",
        group: m.groupNew,
        icon: Plus,
        title: m.listItem,
        run: go(() => openNew("item")),
      },
      {
        key: "smart",
        group: m.groupNew,
        icon: Sparkles,
        title: m.smart,
        run: go(() => openSmart()),
      },
      {
        key: "go-today",
        group: m.groupGo,
        icon: Sun,
        title: nav.today,
        run: go(() => router.push("/")),
      },
      {
        key: "go-tasks",
        group: m.groupGo,
        icon: CheckSquare,
        title: nav.tasks,
        run: go(() => router.push("/tasks")),
      },
      {
        key: "go-cal",
        group: m.groupGo,
        icon: CalendarDays,
        title: nav.calendar,
        run: go(() => router.push("/calendar")),
      },
      {
        key: "go-fin",
        group: m.groupGo,
        icon: Wallet,
        title: nav.finance,
        run: go(() => router.push("/finance")),
      },
      {
        key: "go-notes",
        group: m.groupGo,
        icon: NotebookPen,
        title: nav.notes,
        run: go(() => router.push("/notes")),
      },
      {
        key: "go-settings",
        group: m.groupGo,
        icon: Settings,
        title: nav.settings,
        run: go(() => router.push("/settings")),
      },
    ];
    if (!query.trim()) return actions;

    const kinds = kindMeta();
    const found: Entry[] = searchAll(
      query,
      { tasks, routines, events, transactions, notes, checklists },
      todayKey(),
    ).map((r) => ({
      key: `${r.kind}-${r.id}`,
      group: kinds[r.kind].label,
      icon: kinds[r.kind].icon,
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
              group: m.groupAdd,
              icon: Sparkles,
              title: m.addQuery(query.trim()),
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
    m,
    nav,
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
          aria-label={m.title}
          placeholder={m.placeholder}
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
        aria-label={m.results}
        ref={listRef}
        className="max-h-[60dvh] overflow-y-auto p-1.5"
      >
        {entries.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {m.nothing}
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
