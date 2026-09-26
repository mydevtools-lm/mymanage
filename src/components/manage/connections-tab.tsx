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
import { useGoogleEvents } from "@/lib/use-google-events";
import { addDays, format } from "date-fns";
import { he } from "date-fns/locale";
import { toDateKey } from "@/lib/format";

export function ConnectionsTab() {
  // A 30-day window is enough to show that the feed is alive.
  const from = toDateKey(new Date());
  const to = toDateKey(addDays(new Date(), 30));
  const google = useGoogleEvents(from, to);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="size-4" />
                גוגל יומן
              </CardTitle>
              <CardDescription>קריאה בלבד דרך כתובת iCal פרטית</CardDescription>
            </div>
            {google.loading ? (
              <Badge variant="secondary">בודק…</Badge>
            ) : google.error ? (
              <Badge variant="destructive">שגיאה</Badge>
            ) : google.configured ? (
              <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
                מחובר
              </Badge>
            ) : (
              <Badge variant="outline">לא מחובר</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {google.error && (
            <p className="flex items-start gap-2 text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {google.error}
            </p>
          )}

          {google.configured && !google.error && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  אירועים ב‑30 הימים הקרובים
                </span>
                <span className="font-medium tabular-nums">
                  {google.events.length}
                </span>
              </div>
              {google.events.slice(0, 5).map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 border-s-2 border-s-sky-500 ps-2"
                >
                  <span className="truncate">{e.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(e.date + "T00:00"), "d בMMM", {
                      locale: he,
                    })}
                    {e.startTime ? ` · ${e.startTime}` : ""}
                  </span>
                </div>
              ))}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3" />
                אי אפשר לערוך או למחוק אירועי גוגל מכאן. שינוי נעשה בגוגל יומן
                עצמו, ומופיע כאן תוך כעשר דקות.
              </p>
            </>
          )}

          {!google.configured && !google.loading && (
            <div className="grid gap-2 text-muted-foreground">
              <p className="flex items-start gap-2">
                <PlugZap className="mt-0.5 size-4 shrink-0" />
                כדי לחבר: בגוגל יומן → הגדרות היומן → ״שילוב יומן״ → להעתיק את
                ״כתובת סודית בפורמט iCal״.
              </p>
              <p>
                להדביק אותה בקובץ{" "}
                <code className="rounded bg-muted px-1">.env.local</code> בשורה{" "}
                <code className="rounded bg-muted px-1">
                  GOOGLE_CALENDAR_ICS_URL=
                </code>{" "}
                ולהפעיל מחדש את השרת. ההוראות המלאות בקובץ{" "}
                <code className="rounded bg-muted px-1">.env.example</code>.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
