"use client";

import { useEffect, useState } from "react";
import { KeyRound, Lock, Sparkles } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Field } from "@/components/fields";
import {
  SECRETS_CHANGED,
  secretStatus,
  setSecret,
  type SecretStatus,
} from "@/lib/desktop-services";
import { useAppStore } from "@/lib/store";

/**
 * Settings › connections in the desktop app. The iCal addresses and the
 * Claude key go straight to the Windows Credential Manager (through Rust);
 * after saving, the screen only knows that one is set — it can't show it.
 */

function useSecretStatus() {
  const [status, setStatus] = useState<SecretStatus | null>(null);
  useEffect(() => {
    const load = () => secretStatus().then(setStatus, () => setStatus(null));
    load();
    window.addEventListener(SECRETS_CHANGED, load);
    return () => window.removeEventListener(SECRETS_CHANGED, load);
  }, []);
  return status;
}

async function save(name: Parameters<typeof setSecret>[0], value: string) {
  try {
    await setSecret(name, value);
    return true;
  } catch (error) {
    toast.error(typeof error === "string" ? error : "השמירה נכשלה");
    return false;
  }
}

/** A calendar's display name and a way to disconnect it. Keyed by the name
 *  where it is used, so a name saved elsewhere resets the draft. */
export function DesktopCalendarControls({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const setPref = useAppStore((s) => s.setCalendarPref);
  const [draft, setDraft] = useState(name);
  const inputId = `calendar-name-${id}`;

  return (
    <div className="flex items-end gap-2">
      <Field label="שם לתצוגה" htmlFor={inputId} className="flex-1">
        <Input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft.trim() !== name) setPref(id, { name: draft.trim() });
          }}
        />
      </Field>
      <Button
        variant="outline"
        onClick={async () => {
          if (await save(`calendar-${Number(id)}`, "")) {
            toast.success(`${name} נותק`);
          }
        }}
      >
        ניתוק
      </Button>
    </div>
  );
}

/** Paste a secret iCal address; it gets the first free number. */
export function DesktopCalendarForm({ connected }: { connected: string[] }) {
  const setPref = useAppStore((s) => s.setCalendarPref);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const free = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(
    (n) => !connected.includes(String(n)),
  );
  if (free === undefined) return null;

  return (
    <form
      className="grid gap-3 rounded-lg border border-dashed p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!(await save(`calendar-${free}`, url))) return;
        if (name.trim()) setPref(String(free), { name: name.trim() });
        setName("");
        setUrl("");
        toast.success("היומן חובר");
      }}
    >
      <div className="text-sm font-medium">
        {connected.length ? "יומן נוסף" : "חיבור יומן"}
      </div>
      <Field label="כתובת סודית בפורמט iCal" htmlFor="calendar-url">
        <Input
          id="calendar-url"
          type="password"
          autoComplete="off"
          dir="ltr"
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>
      <Field label="שם לתצוגה (רשות)" htmlFor="calendar-new-name">
        <Input
          id="calendar-new-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        בגוגל יומן → הגדרות היומן → ״שילוב יומן״ → ״כתובת סודית בפורמט iCal״.
      </p>
      <Button type="submit" disabled={!url.trim()} className="justify-self-start">
        חיבור
      </Button>
    </form>
  );
}

export function ClaudeCard() {
  const status = useSecretStatus();
  const [key, setKey] = useState("");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              Claude
            </CardTitle>
            <CardDescription>
              קורא את ״הוספה במשפט״. בלי מפתח — הכללים המקומיים
            </CardDescription>
          </div>
          {status === null ? (
            <Badge variant="secondary">בודק…</Badge>
          ) : status.claude ? (
            <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
              מחובר
            </Badge>
          ) : (
            <Badge variant="outline">לא מחובר</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await save("anthropic", key)) {
              setKey("");
              toast.success("המפתח נשמר");
            }
          }}
        >
          <Field
            label={status?.claude ? "החלפת מפתח" : "מפתח API"}
            htmlFor="claude-key"
            className="flex-1"
          >
            <Input
              id="claude-key"
              type="password"
              autoComplete="off"
              dir="ltr"
              placeholder="sk-ant-…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={!key.trim()}>
            <KeyRound />
            שמירה
          </Button>
        </form>
        {status?.claude && (
          <Button
            variant="outline"
            className="justify-self-start"
            onClick={async () => {
              if (await save("anthropic", "")) toast.success("המפתח הוסר");
            }}
          >
            הסרת המפתח
          </Button>
        )}
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3 shrink-0" />
          נשמר במנהל האישורים של Windows ולא מוצג שוב. מפתח יוצרים ב‑
          console.anthropic.com.
        </p>
      </CardContent>
    </Card>
  );
}
