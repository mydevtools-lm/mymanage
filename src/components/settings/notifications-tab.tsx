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

  useEffect(() => {
    const prefs = useDevicePrefs.getState();
    if (!prefs.loaded) prefs.load();
    // Read after mount: the server has no Notification object.
    const read = () => setPermission(currentPermission());
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);

  async function enable() {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  }

  function test() {
    if (permission === "granted") {
      new Notification("בדיקת התראה", {
        body: "ככה תיראה תזכורת",
        lang: "he",
        dir: "rtl",
      });
    }
    toast("בדיקת התראה", { description: "ככה תיראה תזכורת בתוך המערכת" });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="size-4" />
            תזכורות
          </CardTitle>
          <CardDescription>
            תזכורת נקבעת בדיאלוג של משימה או אירוע עם שעה. בזמנה מופיעה הודעה
            במערכת, והתראה של המחשב או הטלפון כשהמערכת פתוחה ברקע.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>
              התראות מהדפדפן:{" "}
              <strong>
                {permission === "granted"
                  ? "מופעלות"
                  : permission === "denied"
                    ? "חסומות"
                    : permission === "unsupported"
                      ? "לא נתמכות בדפדפן הזה"
                      : "עוד לא הופעלו"}
              </strong>
            </span>
            {permission === "default" && (
              <Button size="sm" onClick={enable}>
                הפעלה
              </Button>
            )}
          </div>
          {permission === "denied" && (
            <p className="flex items-start gap-2 text-muted-foreground">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              ההתראות נחסמו בדפדפן. אפשר לאשר אותן מחדש מסמל המנעול שליד הכתובת.
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={test}
          >
            בדיקה
          </Button>
          <p className="text-xs text-muted-foreground">
            התראה לטלפון כשהמערכת סגורה לגמרי דורשת את המעבר ל‑Firebase (ספרינט
            1).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sunrise className="size-4" />
            תדריך בוקר
          </CardTitle>
          <CardDescription>
            בכניסה הראשונה של היום: אירועים ומשימות, מה שנגרר, חשבונות קבועים
            שמתקרבים ומאזן החודש. בימי שישי — סיכום השבוע.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="auto-brief">להציג לבד בכניסה הראשונה של היום</label>
            <Switch
              id="auto-brief"
              checked={autoBrief}
              onCheckedChange={setAutoBrief}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            ההגדרה הזו שמורה במכשיר הזה בלבד.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => useBrief.getState().open()}
          >
            פתיחת התדריך עכשיו
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
