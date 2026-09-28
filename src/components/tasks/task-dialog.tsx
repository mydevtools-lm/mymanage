"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CategorySelect, Field, NONE, SimpleSelect } from "@/components/fields";
import { PRIORITY_LABELS } from "@/components/shared";
import { useAppStore } from "@/lib/store";
import type { Priority, Task } from "@/lib/types";

const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABELS) as Priority[]).map(
  (p) => ({ value: p, label: PRIORITY_LABELS[p] }),
);

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultDueDate?: string;
}

// The form lives in its own component so its state resets every time the
// dialog content mounts (base-ui unmounts the popup when closed).
export function TaskDialog(props: TaskDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <TaskForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({ onOpenChange, task, defaultDueDate }: TaskDialogProps) {
  const addTask = useAppStore((s) => s.addTask);
  const updateTask = useAppStore((s) => s.updateTask);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaultDueDate ?? "");
  const [dueTime, setDueTime] = useState(task?.dueTime ?? "");
  const [priority, setPriority] = useState<Priority>(
    task?.priority ?? "normal",
  );
  const [categoryId, setCategoryId] = useState(task?.categoryId ?? NONE);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("צריך כותרת למשימה");
      return;
    }
    const input = {
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate || undefined,
      // A time without a date has nowhere to be shown, so it is dropped.
      dueTime: (dueDate && dueTime) || undefined,
      priority,
      categoryId: categoryId === NONE ? undefined : categoryId,
    };
    if (task) {
      updateTask(task.id, input);
      toast.success("המשימה עודכנה");
    } else {
      addTask(input);
      toast.success("המשימה נוספה");
    }
    onOpenChange(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{task ? "עריכת משימה" : "משימה חדשה"}</DialogTitle>
      </DialogHeader>

      <Field label="כותרת" htmlFor="task-title">
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="מה צריך לעשות?"
          autoFocus
        />
      </Field>

      <Field label="תיאור" htmlFor="task-desc">
        <Textarea
          id="task-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="תאריך יעד" htmlFor="task-due">
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <Field label="שעה (רשות)" htmlFor="task-time">
          <Input
            id="task-time"
            type="time"
            value={dueTime}
            disabled={!dueDate}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="עדיפות">
          <SimpleSelect
            value={priority}
            onChange={(v) => setPriority(v as Priority)}
            options={PRIORITY_OPTIONS}
            label="עדיפות"
          />
        </Field>
        <Field label="קטגוריה">
          <CategorySelect
            kind="task"
            value={categoryId}
            onChange={setCategoryId}
          />
        </Field>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          ביטול
        </Button>
        <Button type="submit">{task ? "שמירה" : "הוספה"}</Button>
      </DialogFooter>
    </form>
  );
}
