"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eraser, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Checklist } from "@/lib/types";

function ListCard({ list }: { list: Checklist }) {
  const addItem = useAppStore((s) => s.addChecklistItem);
  const toggleItem = useAppStore((s) => s.toggleChecklistItem);
  const deleteItem = useAppStore((s) => s.deleteChecklistItem);
  const deleteList = useAppStore((s) => s.deleteChecklist);
  const renameList = useAppStore((s) => s.renameChecklist);
  const clearDone = useAppStore((s) => s.clearDoneItems);

  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(list.title);

  const done = list.items.filter((i) => i.done).length;

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
    <Card className="group/card">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{list.title}</h3>
            <p className="text-xs text-muted-foreground">
              {list.items.length === 0
                ? "רשימה ריקה"
                : `${done} מתוך ${list.items.length} סומנו`}
            </p>
          </div>
          <div className="flex shrink-0 opacity-0 transition-opacity group-hover/card:opacity-100">
            {done > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="ניקוי מסומנים"
                title="הסר את מה שסומן"
                onClick={() => clearDone(list.id)}
              >
                <Eraser />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="שינוי שם"
              onClick={() => {
                setTitle(list.title);
                setRenaming(true);
              }}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              aria-label="מחיקת רשימה"
              onClick={() => deleteList(list.id)}
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        {list.items.length > 0 && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(done / list.items.length) * 100}%` }}
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="grid gap-1">
        {list.items.map((item) => (
          <div
            key={item.id}
            className="group/item flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-accent/40"
          >
            <Checkbox
              checked={item.done}
              onCheckedChange={() => toggleItem(list.id, item.id)}
              aria-label={item.text}
            />
            <span
              className={cn(
                "flex-1 text-sm",
                item.done && "text-muted-foreground line-through",
              )}
            >
              {item.text}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="הסרת פריט"
              className="opacity-0 transition-opacity group-hover/item:opacity-100"
              onClick={() => deleteItem(list.id, item.id)}
            >
              <X />
            </Button>
          </div>
        ))}

        <form onSubmit={submitItem} className="mt-1 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="הוסף פריט ואנטר"
            className="h-8"
          />
          <Button
            type="submit"
            size="icon-sm"
            variant="secondary"
            aria-label="הוספת פריט"
            disabled={!draft.trim()}
          >
            <Plus />
          </Button>
        </form>
      </CardContent>

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

export function ListsTab() {
  const checklists = useAppStore((s) => s.checklists);
  const addChecklist = useAppStore((s) => s.addChecklist);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("צריך שם לרשימה");
      return;
    }
    // One item per line, so a whole list can be pasted in at once.
    const parsed = items
      .split("\n")
      .map((line) => line.trim())
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
          hint="לחץ על ״רשימה חדשה״ כדי להתחיל"
        />
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {checklists.map((list) => (
            <ListCard key={list.id} list={list} />
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
              label="פריטים (שורה לכל פריט, אפשר גם אחר כך)"
              htmlFor="list-items"
            >
              <textarea
                id="list-items"
                rows={5}
                value={items}
                onChange={(e) => setItems(e.target.value)}
                placeholder={"שמן בישול\nאקונומיקה"}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
