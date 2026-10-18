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
import { t } from "@/lib/i18n";

/**
 * Settings › connections in the desktop app. The iCal addresses and the
 * Claude key go straight to Rust, which keeps them encrypted (vault.rs);
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
    toast.error(
      typeof error === "string" ? error : t().settings.connections.saveFailed,
    );
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
  const m = t().settings.connections;

  return (
    <div className="flex items-end gap-2">
      <Field label={m.displayName} htmlFor={inputId} className="flex-1">
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
            toast.success(m.disconnected(name));
          }
        }}
      >
        {m.disconnect}
      </Button>
    </div>
  );
}

/** Paste a secret iCal address; it gets the first free number. */
export function DesktopCalendarForm({ connected }: { connected: string[] }) {
  const setPref = useAppStore((s) => s.setCalendarPref);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const m = t().settings.connections;
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
        toast.success(m.calendarConnected);
      }}
    >
      <div className="text-sm font-medium">
        {connected.length ? m.anotherCalendar : m.connectCalendar}
      </div>
      <Field label={m.secretAddress} htmlFor="calendar-url">
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
      <Field label={m.displayNameOptional} htmlFor="calendar-new-name">
        <Input
          id="calendar-new-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <p className="text-xs text-muted-foreground">{m.desktopSteps}</p>
      <Button
        type="submit"
        disabled={!url.trim()}
        className="justify-self-start"
      >
        {m.connect}
      </Button>
    </form>
  );
}

export function ClaudeCard() {
  const status = useSecretStatus();
  const [key, setKey] = useState("");
  const m = t().settings.connections;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              Claude
            </CardTitle>
            <CardDescription>{m.claudeHint}</CardDescription>
          </div>
          {status === null ? (
            <Badge variant="secondary">{m.checking}</Badge>
          ) : status.claude ? (
            <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
              {m.connected}
            </Badge>
          ) : (
            <Badge variant="outline">{m.notConnected}</Badge>
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
              toast.success(m.keySaved);
            }
          }}
        >
          <Field
            label={status?.claude ? m.replaceKey : m.apiKey}
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
            {t().common.save}
          </Button>
        </form>
        {status?.claude && (
          <Button
            variant="outline"
            className="justify-self-start"
            onClick={async () => {
              if (await save("anthropic", "")) toast.success(m.keyRemoved);
            }}
          >
            {m.removeKey}
          </Button>
        )}
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3 shrink-0" />
          {m.keyStorage}
        </p>
      </CardContent>
    </Card>
  );
}
