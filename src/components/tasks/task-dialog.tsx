"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Repeat as RepeatIcon, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CategorySelect, Field, NONE, SimpleSelect } from "@/components/fields";
import { PRIORITY_LABELS } from "@/components/shared";
import { RepeatField } from "@/components/tasks/repeat-field";
import { LinksSection } from "@/components/links-section";
import { ReminderField } from "@/components/reminder-field";
import { useAppStore } from "@/lib/store";
import { describeRepeat } from "@/lib/routines";
import { todayKey } from "@/lib/format";
import type { Priority, Repeat, Routine, Subtask, Task } from "@/lib/types";

const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABELS) as Priority[]).map(
  (p) => ({ value: p, label: PRIORITY_LABELS[p] }),
);

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  /** Edit a routine instead of a single task. */
  routine?: Routine | null;
  defaultDueDate?: string;
  /** Start a new task as a routine. */
  defaultRepeat?: Repeat;
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

/** Steps inside a task; ticking them doesn't finish the task by itself. */
function SubtaskEditor({
  value,
  onChange,
}: {
  value: Subtask[];
  onChange: (value: Subtask[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const text = draft.trim();
    if (!text) return;
    onChange([...value, { id: crypto.randomUUID(), text, done: false }]);
    setDraft("");
  }

  return (
    <div className="grid gap-1.5">
      {value.map((st) => (
        <div key={st.id} className="flex items-center gap-2">
          <Checkbox
            checked={st.done}
            aria-label={`סימון ${st.text}`}
            onCheckedChange={() =>
              onChange(
                value.map((s) =>
                  s.id === st.id ? { ...s, done: !s.done } : s,
                ),
              )
            }
          />
          <Input
            value={st.text}
            aria-label="תת־משימה"
            className="h-8"
            onChange={(e) =>
              onChange(
                value.map((s) =>
                  s.id === st.id ? { ...s, text: e.target.value } : s,
                ),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`הסרת ${st.text}`}
            onClick={() => onChange(value.filter((s) => s.id !== st.id))}
          >
            <X />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="הוספת תת־משימה"
          aria-label="תת־משימה חדשה"
          className="h-8"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds a step here instead of saving the whole task.
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="הוספת תת־משימה"
          onClick={add}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function TaskForm({
  onOpenChange,
  task,
  routine,
  defaultDueDate,
  defaultRepeat,
}: TaskDialogProps) {
  const addTask = useAppStore((s) => s.addTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const addRoutine = useAppStore((s) => s.addRoutine);
  const updateRoutine = useAppStore((s) => s.updateRoutine);
  const parentRoutine = useAppStore((s) =>
    task?.routineId ? s.routines.find((r) => r.id === task.routineId) : null,
  );

  const source = routine ?? task;
  const [title, setTitle] = useState(source?.title ?? "");
  const [description, setDescription] = useState(source?.description ?? "");
  const [dueDate, setDueDate] = useState(
    routine?.startDate ??
      task?.dueDate ??
      defaultDueDate ??
      (defaultRepeat ? todayKey() : ""),
  );
  const [dueTime, setDueTime] = useState(source?.dueTime ?? "");
  const [priority, setPriority] = useState<Priority>(
    source?.priority ?? "normal",
  );
  const [categoryId, setCategoryId] = useState(source?.categoryId ?? NONE);
  const [repeat, setRepeat] = useState<Repeat | null>(
    routine?.repeat ?? defaultRepeat ?? null,
  );
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? []);
  const [reminder, setReminder] = useState(task?.reminder);

  // Only a new task can become a routine; a routine is edited as one.
  const canRepeat = !task;
  const repeating = !!repeat;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("צריך כותרת למשימה");
      return;
    }
    const common = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      categoryId: categoryId === NONE ? undefined : categoryId,
    };

    if (repeat) {
      const fields = {
        ...common,
        dueTime: dueTime || undefined,
        repeat,
        startDate: dueDate || todayKey(),
      };
      if (routine) {
        updateRoutine(routine.id, fields);
        toast.success("המשימה הקבועה עודכנה");
      } else {
        addRoutine(fields);
        toast.success(`נוספה משימה קבועה — ${describeRepeat(repeat)}`);
      }
      onOpenChange(false);
      return;
    }

    const input = {
      ...common,
      dueDate: dueDate || undefined,
      // A time without a date has nowhere to be shown, so it is dropped.
      dueTime: (dueDate && dueTime) || undefined,
      subtasks: subtasks
        .map((s) => ({ ...s, text: s.text.trim() }))
        .filter((s) => s.text),
      // A reminder needs a moment to count back from.
      reminder: dueDate && dueTime ? reminder : undefined,
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
        <DialogTitle>
          {routine ? "עריכת משימה קבועה" : task ? "עריכת משימה" : "משימה חדשה"}
        </DialogTitle>
      </DialogHeader>

      {parentRoutine && (
        <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <RepeatIcon className="size-4 shrink-0" />
          העותק של היום מתוך משימה קבועה ({describeRepeat(parentRoutine.repeat)}
          ). שינוי כאן חל רק עליו.
        </p>
      )}

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
          rows={2}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={repeating ? "החל מתאריך" : "תאריך יעד"}
          htmlFor="task-due"
        >
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
            disabled={!dueDate && !repeating}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </Field>
      </div>

      {!repeating && dueDate && dueTime && (
        <Field label="תזכורת">
          <ReminderField value={reminder} onChange={setReminder} />
        </Field>
      )}

      {(canRepeat || routine) && (
        <Field label="חזרה">
          <RepeatField
            value={repeat}
            onChange={(next) => {
              setRepeat(next);
              // A routine needs a first day; today unless told otherwise.
              if (next && !dueDate) setDueDate(todayKey());
            }}
            startDate={dueDate || todayKey()}
            allowNever={!routine}
          />
        </Field>
      )}

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

      {!repeating && (
        <Field label="תת־משימות">
          <SubtaskEditor value={subtasks} onChange={setSubtasks} />
        </Field>
      )}

      {task && (
        <LinksSection
          kind="task"
          id={task.id}
          onLeave={() => onOpenChange(false)}
        />
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          ביטול
        </Button>
        <Button type="submit">{source ? "שמירה" : "הוספה"}</Button>
      </DialogFooter>
    </form>
  );
}
