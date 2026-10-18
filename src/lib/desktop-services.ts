"use client";

import { invoke } from "@tauri-apps/api/core";
import { claudeRequest, proposalsFrom } from "./assist-request";
import { parseEvents, type ExternalEvent } from "./ical-parse";
import { parseSentence, type Proposal } from "./nl-parse";
import { t } from "./i18n";

/**
 * Google Calendar and Claude in the desktop app. The secrets sit encrypted
 * behind src-tauri/src/services.rs (vault.rs): the page
 * writes them once and only ever learns whether they are set. These
 * functions answer like /api/calendar/google and /api/assist/parse do in
 * the browser, so the screens don't care which one they talk to.
 */

export type SecretName = `calendar-${number}` | "anthropic";

export interface SecretStatus {
  /** Calendar numbers that have an address, e.g. ["1", "3"]. */
  calendars: string[];
  claude: boolean;
}

export const secretStatus = () => invoke<SecretStatus>("secret_status");

/** Stores a secret; an empty value removes it. */
export async function setSecret(name: SecretName, value: string) {
  await invoke("secret_set", { name, value });
  feeds.clear();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SECRETS_CHANGED));
  }
}

/** Fired after a secret changes, so open screens read the calendars again. */
export const SECRETS_CHANGED = "desktop-secrets-changed";

/** The name a calendar shows when settings give none, as on the server. */
export const defaultCalendarName = (id: string) =>
  t().data.calendars.defaultName(id);

// Google regenerates a feed slowly; the server caches for ten minutes too.
const FEED_TTL = 10 * 60_000;
const feeds = new Map<string, { at: number; text: Promise<string> }>();

function feed(id: string) {
  const cached = feeds.get(id);
  if (cached && Date.now() - cached.at < FEED_TTL) return cached.text;
  const text = invoke<string>("calendar_fetch", { id });
  feeds.set(id, { at: Date.now(), text });
  // A failure isn't cached: the next screen tries again.
  text.catch(() => feeds.delete(id));
  return text;
}

export interface DesktopCalendars {
  configured: boolean;
  calendars: { id: string; name: string; failed?: boolean }[];
  events: ExternalEvent[];
  error?: string;
}

/** Every connected calendar for a date window; one failing leaves the rest. */
export async function desktopCalendars(
  from: string,
  to: string,
  names: Record<string, string | undefined> = {},
): Promise<DesktopCalendars> {
  const { calendars: ids } = await secretStatus();
  if (ids.length === 0) return { configured: false, calendars: [], events: [] };

  const settled = await Promise.allSettled(
    ids.map(async (id) => parseEvents(await feed(id), from, to, id)),
  );
  const calendars: DesktopCalendars["calendars"] = [];
  const events: ExternalEvent[] = [];
  settled.forEach((result, index) => {
    const id = ids[index];
    const name = names[id]?.trim() || defaultCalendarName(id);
    if (result.status === "fulfilled") {
      calendars.push({ id, name });
      events.push(...result.value);
    } else {
      // The message carries a status, never the address.
      console.error(`Google Calendar ${id}:`, result.reason);
      calendars.push({ id, name, failed: true });
    }
  });
  events.sort((a, b) =>
    a.date === b.date
      ? (a.startTime ?? "").localeCompare(b.startTime ?? "")
      : a.date.localeCompare(b.date),
  );
  const failed = calendars.filter((c) => c.failed);
  return {
    configured: true,
    calendars,
    events,
    error:
      failed.length === calendars.length
        ? t().data.calendars.allFailedSettings
        : failed.length
          ? t().data.calendars.someFailed(failed.map((c) => c.name))
          : undefined,
  };
}

/** Like POST /api/assist/parse: Claude when a key is set, else — or when
 *  the call fails — the local rules. */
export async function desktopParse(
  text: string,
  today: string,
): Promise<{ source: "claude" | "local"; proposals: Proposal[] }> {
  const { claude } = await secretStatus();
  if (claude) {
    try {
      const answer = await invoke("assist_parse", {
        body: claudeRequest(text, today),
      });
      const proposals = proposalsFrom(answer);
      if (proposals.length > 0) return { source: "claude", proposals };
    } catch (error) {
      console.error("Claude parse failed:", error);
    }
  }
  return { source: "local", proposals: parseSentence(text, today) };
}
