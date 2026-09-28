"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ClipboardCopy,
  Eraser,
  ListChecks,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/fields";
import { EmptyState } from "@/components/shared";
import { RowActions, type RowAction } from "@/components/row-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SortableList } from "@/components/sortable-list";
import { useFocusTarget } from "./use-focus-target";
import { useAppStore } from "@/lib/store";
import { listMatches, listToText, sortLists } from "@/lib/list-text";
import { cn } from "@/lib/utils";
import type { Checklist, ChecklistItem } from "@/lib/types";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, or a page without clipboard permission.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

const canShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

function ItemRow({
  listId,
  item,
  handle,
}: {
  listId: string;
  item: ChecklistItem;
  handle?: React.ReactNode;
}) {
  const toggleItem = useAppStore((s) => s.toggleChecklistItem);
  const deleteItem = useAppStore((s) => s.deleteChecklistItem);

  return (
    <div className="group/item flex items-center gap-2 rounded-md px-1 py-1.5 sm:py-1 can-hover:hover:bg-accent/40">
      {handle ?? <span className="size-7 shrink-0" aria-hidden />}
      <Checkbox
        checked={item.done}
        onCheckedChange={() => toggleItem(listId, item.id)}
        aria-label={item.text}
        className="size-5 sm:size-4"
      />
      <span
        onClick={() => toggleItem(listId, item.id)}
        className={cn(
          "flex-1 cursor-pointer text-sm select-none",
          item.done && "text-muted-foreground line-through",
        )}
      >
        {item.text}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`הסרת ${item.text}`}
        className="text-muted-foreground transition-opacity can-hover:opacity-0 can-hover:group-hover/item:opacity-100 can-hover:group-focus-within/item:opacity-100"
        onClick={() => deleteItem(listId, item.id)}
      >
        <X />
      </Button>
    </div>
  );
}

function ListCard({ list }: { list: Checklist }) {
  const addItem = useAppStore((s) => s.addChecklistItem);
  const deleteList = useAppStore((s) => s.deleteChecklist);
  const renameList = useAppStore((s) => s.renameChecklist);
  const clearDone = useAppStore((s) => s.clearDoneItems);
  const resetList = useAppStore((s) => s.resetChecklist);
  const togglePin = useAppStore((s) => s.toggleChecklistPin);
  const reorder = useAppStore((s) => s.reorderChecklistItems);

  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // When the clipboard is blocked, show the text to copy by hand.
  const [manualCopy, setManualCopy] = useState<string | null>(null);

  const open = list.items.filter((i) => !i.done);
  const done = list.items.filter((i) => i.done);

  const share = async () => {
    const text = listToText(list);
    if (canShare()) {
      try {
        await navigator.share({ title: list.title, text });
        return;
      } catch {
        // Cancelled, or sharing failed — fall through to copying.
      }
    }
    if (await copyText(text)) toast.success("הרשימה הועתקה — אפשר להדביק");
    else setManualCopy(text);
  };

  const cardActions: RowAction[] = [
    {
      label: list.pinned ? "ביטול נעיצה" : "נעיצה למעלה",
      icon: list.pinned ? PinOff : Pin,
      onSelect: () => togglePin(list.id),
    },
    {
      label: canShare() ? "שיתוף" : "העתקה כטקסט",
      icon: canShare() ? Share2 : ClipboardCopy,
      onSelect: share,
    },
    ...(done.length > 0
      ? [
          {
            label: "איפוס — ביטול כל הסימונים",
            icon: RotateCcw,
            onSelect: () => resetList(list.id),
          },
          {
            label: "הסרת המסומנים",
            icon: Eraser,
            onSelect: () => clearDone(list.id),
          },
        ]
      : []),
    {
      label: "שינוי שם",
      icon: Pencil,
      onSelect: () => {
        setTitle(list.title);
        setRenaming(true);
      },
    },
    {
      label: "מחיקת הרשימה",
      icon: Trash2,
      destructive: true,
      onSelect: () => setConfirmDelete(true),
    },
  ];

  function submitItem(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    addItem(list.id, text);
    setDraft("");
  }

  function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("צריך שם לרשימה");
      return;
    }
    renameList(list.id, title.trim());
    setRenaming(false);
  }

  return (
    <Card className={cn("group/card", list.pinned && "ring-1 ring-primary/40")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 truncate font-semibold">
              {list.pinned && (
                <Pin
                  className="size-3.5 shrink-0 text-primary"
                  aria-label="נעוצה"
                />
              )}
              {list.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              {list.items.length === 0
                ? "רשימה ריקה"
                : `${done.length} מתוך ${list.items.length} סומנו`}
            </p>
          </div>
          <RowActions actions={cardActions} group="card" />
        </div>

        {list.items.length > 0 && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(done.length / list.items.length) * 100}%` }}
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="grid gap-1">
        {/* Open items can be dragged into shopping order. */}
        <SortableList
          items={open}
          onReorder={(ids) =>
            // Keep ticked items after the open ones in the stored order.
            reorder(list.id, [...ids, ...done.map((i) => i.id)])
          }
          renderItem={(item, handle) => (
            <ItemRow listId={list.id} item={item} handle={handle} />
          )}
        />

        <form onSubmit={submitItem} className="mt-1 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="הוסף פריט ואנטר"
            enterKeyHint="done"
            className="h-9"
          />
          <Button
            type="submit"
            size="icon"
            variant="secondary"
            aria-label="הוספת פריט"
            disabled={!draft.trim()}
          >
            <Plus />
          </Button>
        </form>

        {/* Ticked items sink below, out of the way while shopping. */}
        {done.length > 0 && (
          <div className="mt-3 grid gap-0.5 border-t pt-2">
            <span className="px-1 text-xs text-muted-foreground">
              סומנו ({done.length})
            </span>
            {done.map((item) => (
              <ItemRow key={item.id} listId={list.id} item={item} />
            ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={manualCopy !== null}
        onOpenChange={(o) => !o && setManualCopy(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>העתקת הרשימה</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            הדפדפן חסם העתקה אוטומטית. הטקסט מסומן — העתק אותו ידנית.
          </p>
          <textarea
            readOnly
            autoFocus
            value={manualCopy ?? ""}
            onFocus={(e) => e.currentTarget.select()}
            rows={Math.min(12, (manualCopy ?? "").split("\n").length + 1)}
            className="w-full rounded-lg border bg-muted/40 px-3 py-2 text-base md:text-sm"
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`למחוק את ״${list.title}״?`}
        description={`הרשימה ו־${list.items.length} הפריטים שבה יימחקו.`}
        onConfirm={() => deleteList(list.id)}
      />

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <form onSubmit={submitRename} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>שינוי שם הרשימה</DialogTitle>
            </DialogHeader>
            <Field label="שם" htmlFor={`rename-${list.id}`}>
              <Input
                id={`rename-${list.id}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenaming(false)}
              >
                ביטול
              </Button>
              <Button type="submit">שמירה</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function ListsTab({ query = "" }: { query?: string }) {
  useFocusTarget(true);
  const checklists = useAppStore((s) => s.checklists);
  const addChecklist = useAppStore((s) => s.addChecklist);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState("");

  const shown = sortLists(checklists).filter((l) => listMatches(l, query));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("צריך שם לרשימה");
      return;
    }
    // One item per line, so a whole list can be pasted in at once — boxes
    // and bullets from a pasted WhatsApp list are stripped.
    const parsed = items
      .split("\n")
      .map((line) => line.replace(/^[☐☑\-*•]\s*/, "").trim())
      .filter(Boolean);
    addChecklist(title.trim(), parsed);
    setTitle("");
    setItems("");
    setOpen(false);
    toast.success("הרשימה נוצרה");
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {checklists.length === 0
            ? "רשימות לסימון — קניות, אריזה, כל דבר חוזר"
            : query
              ? `${shown.length} מתוך ${checklists.length} רשימות`
              : `${checklists.length} רשימות`}
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus /> רשימה חדשה
        </Button>
      </div>

      {checklists.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="אין רשימות"
          hint="קניות, אריזה, כל דבר שחוזר על עצמו"
          action={{ label: "רשימה חדשה", onClick: () => setOpen(true) }}
        />
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          אין רשימה שמתאימה לחיפוש.
        </p>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((list) => (
            <div
              key={list.id}
              id={`item-${list.id}`}
              className="scroll-mt-20 rounded-xl transition-shadow data-focused:ring-2 data-focused:ring-primary"
            >
              <ListCard list={list} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>רשימה חדשה</DialogTitle>
            </DialogHeader>
            <Field label="שם הרשימה" htmlFor="list-title">
              <Input
                id="list-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="למשל: קניות לשבוע"
                autoFocus
              />
            </Field>
            <Field
              label="פריטים (שורה לכל פריט — אפשר גם להדביק רשימה)"
              htmlFor="list-items"
            >
              <textarea
                id="list-items"
                rows={5}
                value={items}
                onChange={(e) => setItems(e.target.value)}
                placeholder={"שמן בישול\nאקונומיקה"}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                ביטול
              </Button>
              <Button type="submit">יצירה</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
