"use client";

import { useState } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckSquare,
  ListChecks,
  Plus,
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
import { EventDialog } from "@/components/calendar/event-dialog";
import { TransactionDialog } from "@/components/finance/transaction-dialog";
import { useAppStore } from "@/lib/store";
import { todayKey } from "@/lib/format";

type Kind = "task" | "event" | "transaction" | "item";

interface QuickAddState {
  kind: Kind | null;
  open: (kind: Kind) => void;
  close: () => void;
}

/** Which "new …" dialog is open, from anywhere in the app. */
export const useQuickAdd = create<QuickAddState>()((set) => ({
  kind: null,
  open: (kind) => set({ kind }),
  close: () => set({ kind: null }),
}));

const NEW_LIST = "__new";

function ListItemForm({ onDone }: { onDone: () => void }) {
  const checklists = useAppStore((s) => s.checklists);
  const addChecklist = useAppStore((s) => s.addChecklist);
  const addChecklistItem = useAppStore((s) => s.addChecklistItem);
  const [listId, setListId] = useState(checklists[0]?.id ?? NEW_LIST);
  const [newTitle, setNewTitle] = useState("קניות");
  const [text, setText] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const item = text.trim();
    if (!item) {
      toast.error("מה להוסיף?");
      return;
    }
    if (listId === NEW_LIST) {
      if (!newTitle.trim()) {
        toast.error("צריך שם לרשימה");
        return;
      }
      addChecklist(newTitle.trim(), [item]);
      toast.success(`נוסף לרשימה ״${newTitle.trim()}״`);
    } else {
      addChecklistItem(listId, item);
      const title = checklists.find((l) => l.id === listId)?.title;
      toast.success(`נוסף ל״${title}״`);
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>פריט לרשימה</DialogTitle>
      </DialogHeader>
      <Field label="רשימה">
        <SimpleSelect
          value={listId}
          onChange={setListId}
          options={[
            ...checklists.map((l) => ({ value: l.id, label: l.title })),
            { value: NEW_LIST, label: "+ רשימה חדשה" },
          ]}
        />
      </Field>
      {listId === NEW_LIST && (
        <Field label="שם הרשימה החדשה" htmlFor="qa-list-title">
          <Input
            id="qa-list-title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
        </Field>
      )}
      <Field label="פריט" htmlFor="qa-item">
        <Input
          id="qa-item"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="למשל: חלב"
          autoFocus
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          ביטול
        </Button>
        <Button type="submit">הוספה</Button>
      </DialogFooter>
    </form>
  );
}

/** Rendered once in the layout; every quick-add entry point opens these. */
export function GlobalQuickAdd() {
  const kind = useQuickAdd((s) => s.kind);
  const close = useQuickAdd((s) => s.close);
  const onOpenChange = (open: boolean) => !open && close();

  return (
    <>
      <TaskDialog
        open={kind === "task"}
        onOpenChange={onOpenChange}
        defaultDueDate={todayKey()}
      />
      <EventDialog open={kind === "event"} onOpenChange={onOpenChange} />
      <TransactionDialog
        open={kind === "transaction"}
        onOpenChange={onOpenChange}
      />
      <Dialog open={kind === "item"} onOpenChange={onOpenChange}>
        <DialogContent>
          <ListItemForm onDone={close} />
        </DialogContent>
      </Dialog>
    </>
  );
}

const OPTIONS: { kind: Kind; label: string; icon: typeof Plus }[] = [
  { kind: "task", label: "משימה", icon: CheckSquare },
  { kind: "event", label: "אירוע", icon: CalendarDays },
  { kind: "transaction", label: "תנועה כספית", icon: Wallet },
  { kind: "item", label: "פריט לרשימה", icon: ListChecks },
];

/** Floating "+" on phones, above the bottom tab bar. */
export function QuickAddFab() {
  const open = useQuickAdd((s) => s.open);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="הוספה מהירה"
            className="fixed end-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg md:hidden [&_svg:not([class*='size-'])]:size-6"
          />
        }
      >
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="min-w-48">
        {OPTIONS.map(({ kind, label, icon: Icon }) => (
          <DropdownMenuItem
            key={kind}
            onClick={() => open(kind)}
            className="py-2.5 text-base"
          >
            <Icon />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
