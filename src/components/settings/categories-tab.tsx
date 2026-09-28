"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ColorSelect, Field } from "@/components/fields";
import { ColorDot } from "@/components/shared";
import { RowActions } from "@/components/row-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAppStore } from "@/lib/store";
import type { Category, CategoryKind, ColorKey } from "@/lib/types";

const KIND_LABELS: Record<
  CategoryKind,
  { title: string; description: string }
> = {
  task: { title: "קטגוריות משימות", description: "תחומים לסיווג משימות" },
  finance: { title: "קטגוריות כספים", description: "לסיווג הכנסות והוצאות" },
};

function CategoryGroup({ kind }: { kind: CategoryKind }) {
  const categories = useAppStore((s) => s.categories).filter(
    (c) => c.kind === kind,
  );
  const addCategory = useAppStore((s) => s.addCategory);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const deleteCategory = useAppStore((s) => s.deleteCategory);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<ColorKey>("teal");
  const [deleting, setDeleting] = useState<Category | null>(null);
  const usage = useAppStore((s) =>
    deleting
      ? s.tasks.filter((t) => t.categoryId === deleting.id).length +
        s.transactions.filter((t) => t.categoryId === deleting.id).length
      : 0,
  );

  function openDialog(category: Category | null) {
    setEditing(category);
    setName(category?.name ?? "");
    setColor(category?.color ?? "teal");
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("צריך שם לקטגוריה");
      return;
    }
    if (editing) updateCategory(editing.id, { name: name.trim(), color });
    else addCategory({ name: name.trim(), color, kind });
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{KIND_LABELS[kind].title}</CardTitle>
            <CardDescription>{KIND_LABELS[kind].description}</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => openDialog(null)}>
            <Plus /> הוספה
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-1">
        {categories.length === 0 && (
          <p className="text-sm text-muted-foreground">אין קטגוריות.</p>
        )}
        {categories.map((c) => (
          <div
            key={c.id}
            className="group flex items-center gap-3 rounded-md px-2 py-1.5 can-hover:hover:bg-accent/40"
          >
            <ColorDot color={c.color} className="size-3" />
            <span className="flex-1 text-sm">{c.name}</span>
            <RowActions
              actions={[
                { label: "עריכה", icon: Pencil, onSelect: () => openDialog(c) },
                {
                  label: "מחיקה",
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => setDeleting(c),
                },
              ]}
            />
          </div>
        ))}
      </CardContent>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`למחוק את הקטגוריה ״${deleting?.name ?? ""}״?`}
        description={
          usage > 0
            ? `${usage} פריטים משויכים אליה. הם יישארו, בלי קטגוריה.`
            : "אין פריטים משויכים לקטגוריה הזו."
        }
        onConfirm={() => {
          if (!deleting) return;
          deleteCategory(deleting.id);
          toast.success("הקטגוריה נמחקה");
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>
                {editing ? "עריכת קטגוריה" : "קטגוריה חדשה"}
              </DialogTitle>
            </DialogHeader>
            <Field label="שם" htmlFor="cat-name">
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="צבע">
              <ColorSelect value={color} onChange={setColor} />
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
    </Card>
  );
}

export function CategoriesTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CategoryGroup kind="task" />
      <CategoryGroup kind="finance" />
    </div>
  );
}
