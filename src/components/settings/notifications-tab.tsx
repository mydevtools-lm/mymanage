"use client";

import { useEffect, useState } from "react";
import { BellRing, CircleAlert, Sunrise } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDevicePrefs } from "@/lib/device-prefs";
import { useBrief } from "@/components/brief-dialog";
import { isTauri, useIsTauri } from "@/lib/platform";
import { desktopNotify } from "@/lib/desktop-notify";
import { dirOf, getLocale, t } from "@/lib/i18n";

type Permission = NotificationPermission | "unsupported";

function currentPermission(): Permission {
  return typeof Notification === "undefined"
    ? "unsupported"
    : Notification.permission;
}

export function NotificationsTab() {
  const autoBrief = useDevicePrefs((s) => s.autoBrief);
  const setAutoBrief = useDevicePrefs((s) => s.setAutoBrief);
  const [permission, setPermission] = useState<Permission>("default");
  const desktop = useIsTauri();
  const m = t().settings.notifications;

  useEffect(() => {
    const prefs = useDevicePrefs.getState();
    if (!prefs.loaded) prefs.load();
    // Read after mount: the server has no Notification object. The desktop
    // app needs no permission; Windows itself can turn its notifications off.
    const read = () =>
      setPermission(isTauri() ? "granted" : currentPermission());
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);

  async function enable() {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  }

  function test() {
    if (isTauri()) {
      void desktopNotify(m.testTitle, m.testBody).catch(() =>
        toast.error(m.testFailed),
      );
    } else if (permission === "granted") {
      new Notification(m.testTitle, {
        body: m.testBody,
        lang: getLocale(),
        dir: dirOf(getLocale()),
      });
    }
    toast(m.testTitle, { description: m.testInApp });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="size-4" />
            {m.remindersTitle}
          </CardTitle>
          <CardDescription>{m.remindersHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>
              {desktop ? m.windowsNotifications : m.browserNotifications}:{" "}
              <strong>
                {permission === "granted"
                  ? m.granted
                  : permission === "denied"
                    ? m.denied
                    : permission === "unsupported"
                      ? m.unsupported
                      : m.notYet}
              </strong>
            </span>
            {permission === "default" && (
              <Button size="sm" onClick={enable}>
                {m.enable}
              </Button>
            )}
          </div>
          {permission === "denied" && (
            <p className="flex items-start gap-2 text-muted-foreground">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {desktop ? m.deniedWindows : m.deniedBrowser}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={test}
          >
            {m.test}
          </Button>
          <p className="text-xs text-muted-foreground">{m.phoneNote}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sunrise className="size-4" />
            {m.briefTitle}
          </CardTitle>
          <CardDescription>{m.briefHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="auto-brief">{m.autoBrief}</label>
            <Switch
              id="auto-brief"
              checked={autoBrief}
              onCheckedChange={setAutoBrief}
            />
          </div>
          <p className="text-xs text-muted-foreground">{m.deviceOnly}</p>
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => useBrief.getState().open()}
          >
            {m.openBrief}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
