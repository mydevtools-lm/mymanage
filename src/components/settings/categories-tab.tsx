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
import { t } from "@/lib/i18n";

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
  // Kept apart from the open flag so the confirm keeps its text while closing.
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const m = t().settings.categories;
  const common = t().common;
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
      toast.error(m.nameRequired);
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
            <CardTitle>{m.kinds[kind].title}</CardTitle>
            <CardDescription>{m.kinds[kind].description}</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => openDialog(null)}>
            <Plus /> {common.add}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-1">
        {categories.length === 0 && (
          <p className="text-sm text-muted-foreground">{m.empty}</p>
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
                {
                  label: common.edit,
                  icon: Pencil,
                  onSelect: () => openDialog(c),
                },
                {
                  label: common.delete,
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => {
                    setDeleting(c);
                    setConfirmOpen(true);
                  },
                },
              ]}
            />
          </div>
        ))}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={m.deleteTitle(deleting?.name ?? "")}
        description={usage > 0 ? m.deleteInUse(usage) : m.deleteUnused}
        onConfirm={() => {
          if (!deleting) return;
          deleteCategory(deleting.id);
          toast.success(m.deleted);
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{editing ? m.editTitle : m.newTitle}</DialogTitle>
            </DialogHeader>
            <Field label={m.name} htmlFor="cat-name">
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label={m.color}>
              <ColorSelect value={color} onChange={setColor} />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {common.cancel}
              </Button>
              <Button type="submit">
                {editing ? common.save : common.add}
              </Button>
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
