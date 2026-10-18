"use client";

import { useState } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckSquare,
  ListChecks,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, SimpleSelect } from "@/components/fields";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { useSmartAdd } from "@/components/smart-add";
import { EventDialog } from "@/components/calendar/event-dialog";
import { TransactionDialog } from "@/components/finance/transaction-dialog";
import { useAppStore } from "@/lib/store";
import { todayKey } from "@/lib/format";
import type { CalendarEvent, Routine, Task, Transaction } from "@/lib/types";
import { t } from "@/lib/i18n";

type Kind = "task" | "event" | "transaction" | "item";

/** An existing item to open in its dialog — from search, or from a link. */
export type EditTarget =
  | { kind: "task"; task: Task }
  | { kind: "routine"; routine: Routine }
  | { kind: "event"; event: CalendarEvent }
  | { kind: "transaction"; transaction: Transaction };

interface QuickAddState {
  kind: Kind | null;
  editing: EditTarget | null;
  open: (kind: Kind) => void;
  openEdit: (target: EditTarget) => void;
  close: () => void;
}

/** Which "new …" or "edit …" dialog is open, from anywhere in the app. */
export const useQuickAdd = create<QuickAddState>()((set) => ({
  kind: null,
  editing: null,
  open: (kind) => set({ kind, editing: null }),
  openEdit: (target) =>
    set({
      kind: target.kind === "routine" ? "task" : target.kind,
      editing: target,
    }),
  // The target stays while the dialog animates closed, so its text holds.
  close: () => set({ kind: null }),
}));

const NEW_LIST = "__new";

function ListItemForm({ onDone }: { onDone: () => void }) {
  const checklists = useAppStore((s) => s.checklists);
  const addChecklist = useAppStore((s) => s.addChecklist);
  const addChecklistItem = useAppStore((s) => s.addChecklistItem);
  const [listId, setListId] = useState(checklists[0]?.id ?? NEW_LIST);
  const [newTitle, setNewTitle] = useState(
    () => t().common.quickAdd.defaultListName,
  );
  const [text, setText] = useState("");
  const m = t().common.quickAdd;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const item = text.trim();
    if (!item) {
      toast.error(m.whatToAdd);
      return;
    }
    if (listId === NEW_LIST) {
      if (!newTitle.trim()) {
        toast.error(m.listNameRequired);
        return;
      }
      addChecklist(newTitle.trim(), [item]);
      toast.success(m.addedToNewList(newTitle.trim()));
    } else {
      addChecklistItem(listId, item);
      const title = checklists.find((l) => l.id === listId)?.title;
      toast.success(m.addedTo(title));
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{m.listItemTitle}</DialogTitle>
      </DialogHeader>
      <Field label={m.list}>
        <SimpleSelect
          value={listId}
          label={m.list}
          onChange={setListId}
          options={[
            ...checklists.map((l) => ({ value: l.id, label: l.title })),
            { value: NEW_LIST, label: m.newList },
          ]}
        />
      </Field>
      {listId === NEW_LIST && (
        <Field label={m.newListName} htmlFor="qa-list-title">
          <Input
            id="qa-list-title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
        </Field>
      )}
      <Field label={m.item} htmlFor="qa-item">
        <Input
          id="qa-item"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={m.itemPlaceholder}
          autoFocus
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t().common.cancel}
        </Button>
        <Button type="submit">{t().common.add}</Button>
      </DialogFooter>
    </form>
  );
}

/** Rendered once in the layout; every quick-add entry point opens these. */
export function GlobalQuickAdd() {
  const kind = useQuickAdd((s) => s.kind);
  const editing = useQuickAdd((s) => s.editing);
  const close = useQuickAdd((s) => s.close);
  const onOpenChange = (open: boolean) => !open && close();

  return (
    <>
      <TaskDialog
        open={kind === "task"}
        onOpenChange={onOpenChange}
        task={editing?.kind === "task" ? editing.task : null}
        routine={editing?.kind === "routine" ? editing.routine : null}
        defaultDueDate={todayKey()}
      />
      <EventDialog
        open={kind === "event"}
        onOpenChange={onOpenChange}
        event={editing?.kind === "event" ? editing.event : null}
      />
      <TransactionDialog
        open={kind === "transaction"}
        onOpenChange={onOpenChange}
        transaction={
          editing?.kind === "transaction" ? editing.transaction : null
        }
      />
      <Dialog open={kind === "item"} onOpenChange={onOpenChange}>
        <DialogContent>
          <ListItemForm onDone={close} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function options(): { kind: Kind; label: string; icon: typeof Plus }[] {
  const m = t().common.quickAdd;
  return [
    { kind: "task", label: m.task, icon: CheckSquare },
    { kind: "event", label: m.event, icon: CalendarDays },
    { kind: "transaction", label: m.transaction, icon: Wallet },
    { kind: "item", label: m.listItemTitle, icon: ListChecks },
  ];
}

/** Floating "+" on phones, above the bottom tab bar. */
export function QuickAddFab() {
  const open = useQuickAdd((s) => s.open);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t().common.quickAdd.quickAdd}
            className="fixed end-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg md:hidden print:hidden [&_svg:not([class*='size-'])]:size-6"
          />
        }
      >
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="min-w-48">
        {options().map(({ kind, label, icon: Icon }) => (
          <DropdownMenuItem
            key={kind}
            onClick={() => open(kind)}
            className="py-2.5 text-base"
          >
            <Icon />
            {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          onClick={() => useSmartAdd.getState().open()}
          className="py-2.5 text-base"
        >
          <Sparkles />
          {t().common.quickAdd.inASentence}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
