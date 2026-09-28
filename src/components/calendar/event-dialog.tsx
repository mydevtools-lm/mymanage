"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ColorSelect, Field } from "@/components/fields";
import { RepeatField } from "@/components/tasks/repeat-field";
import { LinksSection } from "@/components/links-section";
import { useEventActions } from "@/components/calendar/event-actions";
import { todayKey } from "@/lib/format";
import type { CalendarEvent, ColorKey, Repeat } from "@/lib/types";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: string;
  /** Pre-filled when a free slot in the week view is clicked. */
  defaultStartTime?: string;
  defaultEndTime?: string;
}

// The form lives in its own component so its state resets every time the
// dialog content mounts (base-ui unmounts the popup when closed).
export function EventDialog(props: EventDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <EventForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  onOpenChange,
  event,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
}: EventDialogProps) {
  const { save, remove } = useEventActions();

  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? defaultDate ?? todayKey());
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startTime, setStartTime] = useState(
    event?.startTime ?? defaultStartTime ?? "",
  );
  const [endTime, setEndTime] = useState(
    event?.endTime ?? defaultEndTime ?? "",
  );
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [color, setColor] = useState<ColorKey>(event?.color ?? "teal");
  const [repeat, setRepeat] = useState<Repeat | null>(event?.repeat ?? null);
  const [until, setUntil] = useState(event?.until ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("צריך כותרת לאירוע");
      return;
    }
    if (!date) {
      toast.error("צריך תאריך");
      return;
    }
    const input = {
      title: title.trim(),
      date,
      allDay,
      startTime: allDay ? undefined : startTime || undefined,
      endTime: allDay ? undefined : endTime || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      color,
      repeat: repeat ?? undefined,
      until: (repeat && until) || undefined,
    };
    // A recurring event asks how far the change reaches; stay open until
    // that is answered, and keep the edits if the question is dismissed.
    setBusy(true);
    const saved = await save(event ?? null, input);
    setBusy(false);
    if (saved) onOpenChange(false);
  }

  async function onDelete() {
    if (!event) return;
    setBusy(true);
    const deleted = await remove(event);
    setBusy(false);
    if (deleted) onOpenChange(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{event ? "עריכת אירוע" : "אירוע חדש"}</DialogTitle>
      </DialogHeader>

      <Field label="כותרת" htmlFor="ev-title">
        <Input
          id="ev-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="תאריך" htmlFor="ev-date">
          <Input
            id="ev-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <div className="flex items-end gap-2 pb-2">
          <Switch id="ev-allday" checked={allDay} onCheckedChange={setAllDay} />
          <Label htmlFor="ev-allday">כל היום</Label>
        </div>
      </div>

      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="שעת התחלה" htmlFor="ev-start">
            <Input
              id="ev-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </Field>
          <Field label="שעת סיום" htmlFor="ev-end">
            <Input
              id="ev-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </Field>
        </div>
      )}

      <Field label="חזרה">
        <RepeatField value={repeat} onChange={setRepeat} startDate={date} />
      </Field>
      {repeat && (
        <Field label="עד תאריך (רשות)" htmlFor="ev-until">
          <Input
            id="ev-until"
            type="date"
            min={date}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </Field>
      )}

      <Field label="מיקום" htmlFor="ev-loc">
        <Input
          id="ev-loc"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </Field>

      <Field label="הערות" htmlFor="ev-notes">
        <Textarea
          id="ev-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      <Field label="צבע">
        <ColorSelect value={color} onChange={setColor} />
      </Field>

      {event && (
        <LinksSection
          kind="event"
          id={event.seriesId ?? event.id}
          onLeave={() => onOpenChange(false)}
        />
      )}

      <DialogFooter>
        {event && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive sm:me-auto"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 />
            מחיקה
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          ביטול
        </Button>
        <Button type="submit" disabled={busy}>
          {event ? "שמירה" : "הוספה"}
        </Button>
      </DialogFooter>
    </form>
  );
}
