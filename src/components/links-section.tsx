"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  Link2,
  ListChecks,
  NotebookPen,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOpenItem } from "@/components/open-item";
import { useAppStore } from "@/lib/store";
import { searchAll } from "@/lib/search";
import { todayKey } from "@/lib/format";
import type { LinkKind } from "@/lib/types";
import { t } from "@/lib/i18n";

const ICONS: Record<LinkKind, LucideIcon> = {
  task: CheckSquare,
  event: CalendarDays,
  transaction: Wallet,
  note: NotebookPen,
  list: ListChecks,
};

function useTitleOf() {
  const tasks = useAppStore((s) => s.tasks);
  const events = useAppStore((s) => s.events);
  const transactions = useAppStore((s) => s.transactions);
  const notes = useAppStore((s) => s.notes);
  const checklists = useAppStore((s) => s.checklists);
  return (kind: LinkKind, id: string): string | undefined => {
    switch (kind) {
      case "task":
        return tasks.find((t) => t.id === id)?.title;
      case "event":
        return events.find((e) => e.id === id)?.title;
      case "transaction":
        return transactions.find((t) => t.id === id)?.description;
      case "note": {
        const n = notes.find((x) => x.id === id);
        return n
          ? n.title || n.body.slice(0, 30) || t().common.links.note
          : undefined;
      }
      case "list":
        return checklists.find((l) => l.id === id)?.title;
    }
  };
}

/**
 * What this item is tied to — the payment for a bill, the task that
 * prepares a meeting — with a search to tie on more. Clicking a link opens
 * that item; `onLeave` closes the current dialog first.
 */
export function LinksSection({
  kind,
  id,
  onLeave,
}: {
  kind: LinkKind;
  id: string;
  onLeave: () => void;
}) {
  const links = useAppStore((s) => s.links);
  const addLink = useAppStore((s) => s.addLink);
  const removeLink = useAppStore((s) => s.removeLink);
  const openItem = useOpenItem();
  const titleOf = useTitleOf();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const m = t().common.links;

  const tasks = useAppStore((s) => s.tasks);
  const events = useAppStore((s) => s.events);
  const transactions = useAppStore((s) => s.transactions);
  const notes = useAppStore((s) => s.notes);
  const checklists = useAppStore((s) => s.checklists);

  const linked = links
    .filter((l) => l.aId === id || l.bId === id)
    .map((l) => {
      const other =
        l.aId === id
          ? { kind: l.bKind, id: l.bId }
          : { kind: l.aKind, id: l.aId };
      return { link: l, ...other, title: titleOf(other.kind, other.id) };
    })
    // An item deleted since: its link just stops showing.
    .filter((x) => x.title !== undefined);

  const candidates = useMemo(() => {
    if (!query.trim()) return [];
    const taken = new Set([id, ...linked.map((l) => l.id)]);
    return searchAll(
      query,
      { tasks, events, transactions, notes, checklists },
      todayKey(),
      8,
    ).filter((r) => r.kind !== "routine" && !taken.has(r.id));
  }, [query, id, linked, tasks, events, transactions, notes, checklists]);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{m.title}</span>
        {!picking && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPicking(true)}
          >
            <Link2 />
            {m.linkItem}
          </Button>
        )}
      </div>

      {linked.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {linked.map(({ link, kind: k, id: otherId, title }) => {
            const Icon = ICONS[k];
            return (
              <li
                key={link.id}
                className="flex items-center gap-1 rounded-full border bg-muted/50 ps-2.5 text-sm"
              >
                <button
                  type="button"
                  className="flex items-center gap-1.5 py-0.5 underline-offset-4 hover:underline"
                  onClick={() => {
                    onLeave();
                    openItem(k, otherId);
                  }}
                >
                  <Icon className="size-3.5 text-muted-foreground" />
                  {title}
                </button>
                <button
                  type="button"
                  aria-label={m.unlink(title ?? "")}
                  className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => removeLink(link.id)}
                >
                  <X className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {picking && (
        <div className="grid gap-1 rounded-lg border p-2">
          <Input
            autoFocus
            value={query}
            aria-label={m.searchLabel}
            placeholder={m.searchPlaceholder}
            className="h-8"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter picks the first match instead of saving the dialog.
              if (e.key === "Enter") {
                e.preventDefault();
                const first = candidates[0];
                if (first && first.kind !== "routine") {
                  addLink({ kind, id }, { kind: first.kind, id: first.id });
                  setQuery("");
                }
              }
              if (e.key === "Escape") {
                e.stopPropagation();
                setPicking(false);
              }
            }}
          />
          {candidates.map((r) => {
            if (r.kind === "routine") return null;
            const Icon = ICONS[r.kind];
            return (
              <button
                key={`${r.kind}-${r.id}`}
                type="button"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm can-hover:hover:bg-accent"
                onClick={() => {
                  addLink({ kind, id }, { kind: r.kind as LinkKind, id: r.id });
                  setQuery("");
                }}
              >
                <Icon className="size-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">{r.title}</span>
                {r.detail && (
                  <span className="text-xs text-muted-foreground">
                    {r.detail}
                  </span>
                )}
              </button>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-end"
            onClick={() => {
              setPicking(false);
              setQuery("");
            }}
          >
            {m.done}
          </Button>
        </div>
      )}
    </div>
  );
}
