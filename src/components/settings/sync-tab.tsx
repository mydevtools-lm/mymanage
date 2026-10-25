"use client";

import { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { CircleAlert, FolderOpen, RefreshCw, RefreshCwOff } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDevicePrefs } from "@/lib/device-prefs";
import { dateLocale, t } from "@/lib/i18n";
import { useSync } from "@/lib/sync/client";

/** Settings › Sync, desktop app only: pick the folder, see how it is going. */
export function SyncTab() {
  const dir = useDevicePrefs((s) => s.syncDir);
  const { status, last, running, error, refresh, run, choose, start, stop } =
    useSync();
  const m = t().settings.sync;

  useEffect(() => {
    const prefs = useDevicePrefs.getState();
    if (!prefs.loaded) prefs.load();
    void refresh();
  }, [refresh]);

  const on = !!dir && !!status?.on;
  const waiting = last?.waiting.length ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="size-4" />
                {m.title}
              </CardTitle>
              <CardDescription>{m.hint}</CardDescription>
            </div>
            {on ? (
              <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
                {m.on}
              </Badge>
            ) : (
              <Badge variant="outline">{m.off}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <div className="grid gap-1.5">
            <div className="font-medium">{m.folder}</div>
            <code
              dir="ltr"
              className="min-w-0 truncate text-xs text-muted-foreground"
            >
              {dir ?? m.notChosen}
            </code>
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {m.failed}: {error}
            </p>
          )}

          {on && status && (
            <div className="grid gap-1 text-xs text-muted-foreground">
              <div>
                {status.lastSync
                  ? m.lastSync(
                      formatDistanceToNow(status.lastSync, {
                        addSuffix: true,
                        locale: dateLocale(),
                      }),
                    )
                  : m.never}
              </div>
              <div>{m.computers(status.devices, status.deviceNames)}</div>
              {status.outbox > 0 && <div>{m.outbox(status.outbox)}</div>}
              {status.pending > 0 && <div>{m.pending(status.pending)}</div>}
              {waiting > 0 && <div>{m.waiting(waiting)}</div>}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {on ? (
              <>
                <Button onClick={() => void run()} disabled={running}>
                  <RefreshCw className={running ? "animate-spin" : ""} />
                  {running ? m.running : m.syncNow}
                </Button>
                <Button
                  variant="outline"
                  disabled={running}
                  onClick={async () => {
                    await stop();
                    if (await choose()) toast.success(m.started);
                  }}
                >
                  <FolderOpen />
                  {m.change}
                </Button>
                <Button
                  variant="ghost"
                  disabled={running}
                  onClick={() => void stop()}
                >
                  <RefreshCwOff />
                  {m.stop}
                </Button>
              </>
            ) : (
              <>
                {dir && (
                  <Button
                    disabled={running}
                    onClick={async () => {
                      if (await start(dir)) toast.success(m.started);
                    }}
                  >
                    <RefreshCw />
                    {m.start}
                  </Button>
                )}
                <Button
                  variant={dir ? "outline" : "default"}
                  disabled={running}
                  onClick={async () => {
                    if (await choose()) toast.success(m.started);
                  }}
                >
                  <FolderOpen />
                  {m.choose}
                </Button>
              </>
            )}
          </div>
          {on && <p className="text-xs text-muted-foreground">{m.stopHint}</p>}
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{m.safetyTitle}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {m.safety}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{m.notSyncedTitle}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {m.notSynced}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
