"use client";

import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Lock, MapPin, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RowActions } from "@/components/row-actions";
import { TaskRow } from "@/components/tasks/task-row";
import { TimeRange } from "@/components/time-range";
import { useEventActions } from "./event-actions";
import { COLOR_STYLES } from "@/lib/colors";
import { useIsDesktop } from "@/lib/use-media";
import { cn } from "@/lib/utils";
import type { CalendarEvent, Task } from "@/lib/types";
import type { DayData } from "./use-calendar-data";
import { googleTint } from "./chips";

/**
 * Everything on one day. A side panel on desktop; on a phone it rises from
 * the bottom, where the thumb already is.
 */
export function DayPanel({
  dayKey,
  data,
  onClose,
  onNewEvent,
  onEditEvent,
  onNewTask,
  onEditTask,
}: {
  dayKey: string | null;
  data: DayData;
  onClose: () => void;
  onNewEvent: () => void;
  onEditEvent: (event: CalendarEvent) => void;
  onNewTask: () => void;
  onEditTask: (task: Task) => void;
}) {
  const { remove: removeEvent } = useEventActions();
  const isDesktop = useIsDesktop();
  const { events, google, tasks } = data;

  return (
    <Sheet open={!!dayKey} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isDesktop ? "left" : "bottom"}
        className={cn(
          isDesktop
            ? "w-full sm:max-w-md"
            : "max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
        )}
      >
        {dayKey && (
          <>
            <SheetHeader>
              {!isDesktop && (
                <div
                  aria-hidden
                  className="mx-auto mb-1 h-1 w-10 rounded-full bg-muted-foreground/30"
                />
              )}
              <SheetTitle>
                {format(new Date(dayKey + "T00:00"), "EEEE, d בMMMM yyyy", {
                  locale: he,
                })}
              </SheetTitle>
              <SheetDescription>
                {events.length} אירועים
                {google.length > 0 && ` · ${google.length} מגוגל`} ·{" "}
                {tasks.length} משימות
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
              <section className="grid gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">אירועים</h3>
                  <Button size="sm" variant="outline" onClick={onNewEvent}>
                    <Plus /> אירוע
                  </Button>
                </div>
                {events.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    אין אירועים ביום זה.
                  </p>
                )}
                {events.map((e) => (
                  <div
                    key={e.id}
                    className={cn(
                      "group flex items-start gap-3 rounded-lg border p-3",
                      COLOR_STYLES[e.color].soft,
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        {e.title}
                        {e.repeat && (
                          <Repeat
                            className="size-3.5 text-muted-foreground"
                            aria-label="אירוע חוזר"
                          />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {e.allDay || !e.startTime ? (
                          "כל היום"
                        ) : (
                          <TimeRange start={e.startTime} end={e.endTime} />
                        )}
                      </div>
                      {e.location && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" /> {e.location}
                        </div>
                      )}
                      {e.notes && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {e.notes}
                        </div>
                      )}
                    </div>
                    <RowActions
                      actions={[
                        {
                          label: "עריכה",
                          icon: Pencil,
                          onSelect: () => onEditEvent(e),
                        },
                        {
                          label: "מחיקה",
                          icon: Trash2,
                          destructive: true,
                          onSelect: () => void removeEvent(e),
                        },
                      ]}
                    />
                  </div>
                ))}
              </section>

              {google.length > 0 && (
                <section className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">גוגל יומן</h3>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="size-3" /> קריאה בלבד
                    </span>
                  </div>
                  {google.map((e) => (
                    <div
                      key={e.id}
                      className={cn(
                        "rounded-lg border border-s-2 p-3",
                        googleTint(e.color).bar,
                        googleTint(e.color).card,
                      )}
                    >
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {e.allDay || !e.startTime ? (
                          "כל היום"
                        ) : (
                          <TimeRange start={e.startTime} end={e.endTime} />
                        )}
                      </div>
                      {e.location && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" /> {e.location}
                        </div>
                      )}
                      {e.notes && (
                        <div className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                          {e.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}

              <section className="grid gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">משימות</h3>
                  <Button size="sm" variant="outline" onClick={onNewTask}>
                    <Plus /> משימה
                  </Button>
                </div>
                {tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    אין משימות ליום זה.
                  </p>
                )}
                {tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onEdit={onEditTask}
                    hideDate
                    compact
                  />
                ))}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
