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

const failed = (what: string) => (error: unknown) =>
  toast.error(typeof error === "string" ? error : `${what} נכשל`);

/** Settings › preferences, desktop app only: the window, sign-in, folders. */
export function DesktopSettings() {
  const closeToTray = useDevicePrefs((s) => s.closeToTray !== false);
  const backupDir = useDevicePrefs((s) => s.backupDir);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [dataDir, setDataDir] = useState("");

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
          אפליקציית המחשב
        </CardTitle>
        <CardDescription>חלות על המחשב הזה בלבד.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="close-to-tray">
            סגירת החלון משאירה את האפליקציה במגש, כדי שתזכורות ימשיכו לקפוץ
          </Label>
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
          <Label htmlFor="autostart">
            הפעלה עם הכניסה ל‑Windows (במגש, בלי חלון)
          </Label>
          <Switch
            id="autostart"
            disabled={autostart === null}
            checked={!!autostart}
            onCheckedChange={(on) =>
              (on ? enable() : disable()).then(
                () => setAutostart(on),
                failed("השינוי"),
              )
            }
          />
        </div>

        <div className="grid gap-1.5">
          <div className="font-medium">תיקיית הנתונים</div>
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
                invoke("shell_open_data_dir").catch(failed("הפתיחה"))
              }
            >
              <FolderOpen />
              פתיחה
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            המסד, 14 הגיבויים היומיים האחרונים, והסודות (מוצפנים).
          </p>
        </div>

        <div className="grid gap-1.5">
          <div className="font-medium">תיקיית גיבוי נוספת</div>
          <div className="flex items-center justify-between gap-3">
            <code
              dir="ltr"
              className="min-w-0 truncate text-xs text-muted-foreground"
            >
              {backupDir ?? "לא נבחרה"}
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
                  הסרה
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
                    () => toast.success("הגיבוי של היום הועתק לתיקייה"),
                    failed("הגיבוי"),
                  );
                }}
              >
                בחירה
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            כונן אחר או תיקייה מסונכרנת (OneDrive, Google Drive) — עותק של כל
            גיבוי יומי, גם כאן 14 אחרונים.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
