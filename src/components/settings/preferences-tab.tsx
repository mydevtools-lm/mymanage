"use client";

import { useTheme } from "next-themes";
import {
  Download,
  MonitorSmartphone,
  Palette,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, SimpleSelect } from "@/components/fields";
import { ReminderField } from "@/components/reminder-field";
import { install, useInstall } from "@/components/pwa";
import { useAppStore } from "@/lib/store";
import type { CurrencyCode } from "@/lib/types";

const WEEK_STARTS = [
  { value: "0", label: "ראשון" },
  { value: "1", label: "שני" },
  { value: "6", label: "שבת" },
];

const CURRENCIES = [
  { value: "ILS", label: "שקל (₪)" },
  { value: "USD", label: "דולר ($)" },
  { value: "EUR", label: "אירו (€)" },
];

const THEMES = [
  { value: "light", label: "בהיר" },
  { value: "dark", label: "כהה" },
  { value: "system", label: "לפי המכשיר" },
];

export function PreferencesTab() {
  const prefs = useAppStore((s) => s.settings.prefs) ?? {};
  const setPrefs = useAppStore((s) => s.setPrefs);
  const { theme, setTheme } = useTheme();
  const offer = useInstall((s) => s.offer);
  const installed = useInstall((s) => s.installed);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4" />
            העדפות
          </CardTitle>
          <CardDescription>
            נשמרות עם הנתונים, ותקפות בכל מכשיר.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="השבוע מתחיל ביום">
            <SimpleSelect
              label="השבוע מתחיל ביום"
              value={String(prefs.weekStart ?? 0)}
              options={WEEK_STARTS}
              onChange={(v) => setPrefs({ weekStart: Number(v) as 0 | 1 | 6 })}
            />
          </Field>
          <Field label="מטבע">
            <SimpleSelect
              label="מטבע"
              value={prefs.currency ?? "ILS"}
              options={CURRENCIES}
              onChange={(v) => {
                setPrefs({ currency: v as CurrencyCode });
                toast.success("המטבע עודכן");
              }}
            />
          </Field>
          <Field label="תזכורת ברירת מחדל למשימה או אירוע עם שעה">
            <ReminderField
              value={prefs.defaultReminder}
              onChange={(v) => setPrefs({ defaultReminder: v })}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-4" />
              מראה
            </CardTitle>
            <CardDescription>במכשיר הזה.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field label="ערכת צבעים">
              <SimpleSelect
                label="ערכת צבעים"
                value={theme ?? "light"}
                options={THEMES}
                onChange={setTheme}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MonitorSmartphone className="size-4" />
              התקנה כאפליקציה
            </CardTitle>
            <CardDescription>
              אייקון במסך הבית ובשולחן העבודה, וחלון משלה בלי שורת כתובת.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {installed ? (
              <p>המערכת מותקנת ופתוחה כאפליקציה.</p>
            ) : offer ? (
              <Button
                className="justify-self-start"
                onClick={() => void install()}
              >
                <Download />
                התקנה
              </Button>
            ) : (
              <ul className="grid list-disc gap-1 ps-5 text-muted-foreground">
                <li>
                  כרום במחשב או באנדרואיד: סמל ההתקנה בשורת הכתובת, או התפריט
                  ״התקנת האפליקציה״.
                </li>
                <li>אייפון (ספארי): כפתור השיתוף, ואז ״הוספה למסך הבית״.</li>
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              בטלפון זה יעבוד אחרי שהמערכת תתארח ברשת (החלטה 2 בתוכנית) — היום
              היא רצה רק על המחשב הזה.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
