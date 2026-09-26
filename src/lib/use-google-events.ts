"use client";

import { useEffect, useState } from "react";

export interface ExternalEvent {
  id: string;
  title: string;
  date: string; // yyyy-MM-dd
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  notes?: string;
  source: "google";
}

interface State {
  events: ExternalEvent[];
  configured: boolean;
  loading: boolean;
  error: string | null;
}

const EMPTY: ExternalEvent[] = [];

/**
 * Read-only Google Calendar events for a date window. The secret iCal address
 * stays on the server; this only ever talks to our own route handler.
 */
export function useGoogleEvents(from: string, to: string): State {
  const [state, setState] = useState<State>({
    events: EMPTY,
    configured: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `/api/calendar/google?from=${from}&to=${to}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        setState({
          events: data.events ?? EMPTY,
          configured: !!data.configured,
          loading: false,
          error: data.error ?? null,
        });
      } catch {
        if (controller.signal.aborted) return;
        setState({
          events: EMPTY,
          configured: false,
          loading: false,
          error: "החיבור ליומן גוגל נכשל",
        });
      }
    }

    load();
    return () => controller.abort();
  }, [from, to]);

  return state;
}
