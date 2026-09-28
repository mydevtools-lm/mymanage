"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { NotebookPen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/fields";
import { EmptyState } from "@/components/shared";
import { RowActions } from "@/components/row-actions";
import { useAppStore } from "@/lib/store";
import { formatDate } from "@/lib/format";
import type { Note } from "@/lib/types";

export function NotesTab() {
  const notes = useAppStore((s) => s.notes);
  const addNote = useAppStore((s) => s.addNote);
  const updateNote = useAppStore((s) => s.updateNote);
  const deleteNote = useAppStore((s) => s.deleteNote);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      `${n.title} ${n.body}`.toLowerCase().includes(q),
    );
  }, [notes, query]);

  function openDialog(note: Note | null) {
    setEditing(note);
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() && !body.trim()) {
      toast.error("ההערה ריקה");
      return;
    }
    const input = { title: title.trim() || "ללא כותרת", body: body.trim() };
    if (editing) updateNote(editing.id, input);
    else addNote(input);
    setOpen(false);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-8"
            placeholder="חיפוש בהערות..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button className="ms-auto" onClick={() => openDialog(null)}>
          <Plus /> הערה חדשה
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="אין הערות"
          hint="רעיונות, רשימות, דברים לזכור"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <Card key={n.id} className="group">
              <CardContent className="grid gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{n.title}</h3>
                  <RowActions
                    actions={[
                      {
                        label: "עריכה",
                        icon: Pencil,
                        onSelect: () => openDialog(n),
                      },
                      {
                        label: "מחיקה",
                        icon: Trash2,
                        destructive: true,
                        onSelect: () => deleteNote(n.id),
                      },
                    ]}
                  />
                </div>
                <p className="line-clamp-5 text-sm whitespace-pre-wrap text-muted-foreground">
                  {n.body}
                </p>
                <div className="text-xs text-muted-foreground/70">
                  עודכן {formatDate(n.updatedAt.slice(0, 10))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{editing ? "עריכת הערה" : "הערה חדשה"}</DialogTitle>
            </DialogHeader>
            <Field label="כותרת" htmlFor="note-title">
              <Input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="תוכן" htmlFor="note-body">
              <Textarea
                id="note-body"
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
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
              <Button type="submit">{editing ? "שמירה" : "הוספה"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
