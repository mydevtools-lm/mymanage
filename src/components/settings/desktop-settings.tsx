"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Monitor } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useDevicePrefs } from "@/lib/device-prefs";
import { backupNow } from "@/lib/tauri-db";
import { t } from "@/lib/i18n";

const failed = (message: string) => (error: unknown) =>
  toast.error(typeof error === "string" ? error : message);

/** Settings › preferences, desktop app only: the window, sign-in, folders. */
export function DesktopSettings() {
  const closeToTray = useDevicePrefs((s) => s.closeToTray !== false);
  const backupDir = useDevicePrefs((s) => s.backupDir);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [dataDir, setDataDir] = useState("");
  const m = t().settings.desktop;

  useEffect(() => {
    const prefs = useDevicePrefs.getState();
    if (!prefs.loaded) prefs.load();
    isEnabled().then(setAutostart, () => setAutostart(false));
    invoke<string>("shell_data_dir").then(setDataDir, () => {});
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="size-4" />
          {m.title}
        </CardTitle>
        <CardDescription>{m.hint}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="close-to-tray">{m.closeToTray}</Label>
          <Switch
            id="close-to-tray"
            checked={closeToTray}
            onCheckedChange={(on) => {
              useDevicePrefs.getState().setCloseToTray(on);
              void invoke("shell_set_close_to_tray", { on });
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="autostart">{m.autostart}</Label>
          <Switch
            id="autostart"
            disabled={autostart === null}
            checked={!!autostart}
            onCheckedChange={(on) =>
              (on ? enable() : disable()).then(
                () => setAutostart(on),
                failed(m.changeFailed),
              )
            }
          />
        </div>

        <div className="grid gap-1.5">
          <div className="font-medium">{m.dataDir}</div>
          <div className="flex items-center justify-between gap-3">
            <code
              dir="ltr"
              className="min-w-0 truncate text-xs text-muted-foreground"
            >
              {dataDir}
            </code>
            <Button
              size="sm"
              variant="outline"
              disabled={!dataDir}
              onClick={() =>
                invoke("shell_open_data_dir").catch(failed(m.openFailed))
              }
            >
              <FolderOpen />
              {m.open}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{m.dataDirHint}</p>
        </div>

        <div className="grid gap-1.5">
          <div className="font-medium">{m.backupDir}</div>
          <div className="flex items-center justify-between gap-3">
            <code
              dir="ltr"
              className="min-w-0 truncate text-xs text-muted-foreground"
            >
              {backupDir ?? m.notChosen}
            </code>
            <div className="flex shrink-0 gap-2">
              {backupDir && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    useDevicePrefs.getState().setBackupDir(undefined)
                  }
                >
                  {m.remove}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const picked = await open({ directory: true });
                  if (typeof picked !== "string") return;
                  useDevicePrefs.getState().setBackupDir(picked);
                  backupNow().then(
                    () => toast.success(m.backupCopied),
                    failed(m.backupFailed),
                  );
                }}
              >
                {m.choose}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{m.backupDirHint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
