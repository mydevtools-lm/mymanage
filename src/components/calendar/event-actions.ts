"use client";

import { toast } from "sonner";
import { useSeriesPrompt } from "@/components/series-prompt";
import { useAppStore } from "@/lib/store";
import type { EventFields } from "@/lib/event-series";
import type { CalendarEvent } from "@/lib/types";
import { t } from "@/lib/i18n";

/**
 * Save and delete for an event as it appears on screen. A one-off event is
 * changed directly; an occurrence of a recurring one asks first how far the
 * change reaches. Every screen that edits events goes through here.
 */
export function useEventActions() {
  const ask = useSeriesPrompt((s) => s.ask);

  const isRecurring = (event: CalendarEvent) =>
    !!event.seriesId ||
    !!useAppStore.getState().events.find((e) => e.id === event.id)?.repeat;

  async function save(event: CalendarEvent | null, fields: EventFields) {
    const store = useAppStore.getState();
    if (!event) {
      store.addEvent(fields as Parameters<typeof store.addEvent>[0]);
      toast.success(t().calendar.toast.added);
      return true;
    }
    if (!isRecurring(event)) {
      store.updateEvent(event.id, fields);
      toast.success(t().calendar.toast.updated);
      return true;
    }
    const scope = await ask({
      action: "edit",
      title: event.title,
      date: event.occurrenceDate ?? event.date,
    });
    if (!scope) return false;
    store.editEventInSeries(event, scope, fields);
    toast.success(t().calendar.toast.updated);
    return true;
  }

  async function remove(event: CalendarEvent) {
    const store = useAppStore.getState();
    if (!isRecurring(event)) {
      store.deleteEvent(event.id);
      return true;
    }
    const scope = await ask({
      action: "delete",
      title: event.title,
      date: event.occurrenceDate ?? event.date,
    });
    if (!scope) return false;
    store.deleteEventInSeries(event, scope);
    return true;
  }

  return { save, remove };
}
