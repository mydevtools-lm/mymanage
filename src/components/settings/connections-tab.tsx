"use client";

import { CalendarCheck, CircleAlert, Lock, PlugZap } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ColorSelect } from "@/components/fields";
import { googleTint } from "@/components/calendar/chips";
import { useGoogleEvents } from "@/lib/use-google-events";
import { useAppStore } from "@/lib/store";
import { addDays, format } from "date-fns";
import { toDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useIsTauri } from "@/lib/platform";
import { dateLocale, t } from "@/lib/i18n";
import {
  ClaudeCard,
  DesktopCalendarControls,
  DesktopCalendarForm,
} from "./desktop-connections";

export function ConnectionsTab() {
  // A 30-day window is enough to show that each feed is alive.
  const from = toDateKey(new Date());
  const to = toDateKey(addDays(new Date(), 30));
  const google = useGoogleEvents(from, to);
  const setPref = useAppStore((s) => s.setCalendarPref);
  // The desktop app keeps the addresses itself; the browser reads .env.local.
  const desktop = useIsTauri();
  const m = t().settings.connections;

  const allFailed =
    google.calendars.length > 0 && google.calendars.every((c) => c.failed);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="size-4" />
                {m.googleTitle}
              </CardTitle>
              <CardDescription>{m.googleHint}</CardDescription>
            </div>
            {google.loading ? (
              <Badge variant="secondary">{m.checking}</Badge>
            ) : allFailed ? (
              <Badge variant="destructive">{m.error}</Badge>
            ) : google.configured ? (
              <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
                {google.calendars.length > 1
                  ? m.connectedMany(google.calendars.length)
                  : m.connected}
              </Badge>
            ) : (
              <Badge variant="outline">{m.notConnected}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {google.error && (
            <p className="flex items-start gap-2 text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {google.error}
            </p>
          )}

          {google.calendars.map((calendar) => {
            const count = google.events.filter(
              (e) => e.calendarId === calendar.id,
            ).length;
            const switchId = `calendar-shown-${calendar.id}`;
            return (
              <section
                key={calendar.id}
                aria-label={calendar.name}
                className={cn(
                  "grid gap-3 rounded-lg border border-s-4 p-3",
                  googleTint(calendar.color).bar,
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{calendar.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {calendar.failed
                        ? m.calendarFailed
                        : calendar.hidden
                          ? m.calendarHidden
                          : m.calendarEvents(count)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <label htmlFor={switchId} className="text-xs">
                      {m.show}
                    </label>
                    <Switch
                      id={switchId}
                      checked={!calendar.hidden}
                      onCheckedChange={(shown) =>
                        setPref(calendar.id, { hidden: !shown })
                      }
                    />
                  </div>
                </div>
                <ColorSelect
                  value={calendar.color}
                  onChange={(color) => setPref(calendar.id, { color })}
                />
                {desktop && (
                  <DesktopCalendarControls
                    key={calendar.name}
                    id={calendar.id}
                    name={calendar.name}
                  />
                )}
              </section>
            );
          })}

          {google.configured && google.events.length > 0 && (
            <div className="grid gap-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                {m.upcoming}
              </div>
              {google.events.slice(0, 5).map((e) => (
                <div
                  key={e.id}
                  className={cn(
                    "flex items-center justify-between gap-3 border-s-2 ps-2",
                    googleTint(e.color).bar,
                  )}
                >
                  <span className="truncate">{e.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(
                      new Date(e.date + "T00:00"),
                      t().common.dates.dayMonth,
                      { locale: dateLocale() },
                    )}
                    {e.startTime ? ` · ${e.startTime}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {google.configured && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3" />
              {m.readOnly}
            </p>
          )}

          {!google.loading && desktop && (
            <DesktopCalendarForm
              connected={google.calendars.map((c) => c.id)}
            />
          )}

          {!google.loading && !desktop && (
            <div className="grid gap-2 text-muted-foreground">
              <p className="flex items-start gap-2">
                <PlugZap className="mt-0.5 size-4 shrink-0" />
                {m.envSteps(google.configured)}
              </p>
              <p>
                {m.envPasteIn}{" "}
                <code className="rounded bg-muted px-1">.env.local</code>{" "}
                {m.envOnLine}{" "}
                <code className="rounded bg-muted px-1">
                  {google.configured
                    ? `GOOGLE_CALENDAR_ICS_URL_${google.calendars.length + 1}=`
                    : "GOOGLE_CALENDAR_ICS_URL="}
                </code>
                {google.configured && (
                  <>
                    {" "}
                    {m.envNameIn}
                    <code className="rounded bg-muted px-1">
                      GOOGLE_CALENDAR_NAME_{google.calendars.length + 1}=
                    </code>
                    )
                  </>
                )}{" "}
                {m.envRestart}{" "}
                <code className="rounded bg-muted px-1">.env.example</code>.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {desktop && <ClaudeCard />}
    </div>
  );
}
