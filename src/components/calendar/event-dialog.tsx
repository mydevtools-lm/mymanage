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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ColorSelect, Field } from "@/components/fields";
import { useAppStore } from "@/lib/store";
import { todayKey } from "@/lib/format";
import type { CalendarEvent, ColorKey } from "@/lib/types";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: string;
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

function EventForm({ onOpenChange, event, defaultDate }: EventDialogProps) {
  const addEvent = useAppStore((s) => s.addEvent);
  const updateEvent = useAppStore((s) => s.updateEvent);

  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? defaultDate ?? todayKey());
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startTime, setStartTime] = useState(event?.startTime ?? "");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [color, setColor] = useState<ColorKey>(event?.color ?? "teal");

  function submit(e: React.FormEvent) {
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
    };
    if (event) {
      updateEvent(event.id, input);
      toast.success("האירוע עודכן");
    } else {
      addEvent(input);
      toast.success("האירוע נוסף");
    }
    onOpenChange(false);
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

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          ביטול
        </Button>
        <Button type="submit">{event ? "שמירה" : "הוספה"}</Button>
      </DialogFooter>
    </form>
  );
}
