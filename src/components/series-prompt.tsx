"use client";

import { create } from "zustand";
import { CalendarRange, CalendarX2, Repeat } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SeriesScope } from "@/lib/types";
import { t } from "@/lib/i18n";

interface Question {
  action: "edit" | "delete";
  title: string;
  /** The day of the occurrence being changed. */
  date: string;
}

interface PromptState {
  open: boolean;
  question: Question | null;
  resolve: ((scope: SeriesScope | null) => void) | null;
  ask: (question: Question) => Promise<SeriesScope | null>;
  answer: (scope: SeriesScope | null) => void;
}

/**
 * "Just this day, from here on, or all of them?" for recurring events.
 * One dialog for the whole app, asked from anywhere with `await ask(...)`;
 * closing it answers null.
 */
export const useSeriesPrompt = create<PromptState>()((set, get) => ({
  open: false,
  question: null,
  resolve: null,
  ask: (question) =>
    new Promise((resolve) => {
      get().resolve?.(null);
      set({ open: true, question, resolve });
    }),
  answer: (scope) => {
    get().resolve?.(scope);
    // Keep the question while the dialog fades out, so its text stays put.
    set({ open: false, resolve: null });
  },
}));

function options(): {
  scope: SeriesScope;
  label: string;
  icon: typeof Repeat;
  hint: (date: string) => string;
}[] {
  const m = t().common.series;
  return [
    {
      scope: "this",
      label: m.thisLabel,
      icon: CalendarX2,
      hint: (d) => m.thisHint(formatDate(d)),
    },
    {
      scope: "following",
      label: m.followingLabel,
      icon: CalendarRange,
      hint: (d) => m.followingHint(formatDate(d)),
    },
    {
      scope: "all",
      label: m.allLabel,
      icon: Repeat,
      hint: () => m.allHint,
    },
  ];
}

export function SeriesPrompt() {
  const { open, question, answer } = useSeriesPrompt();
  const m = t().common.series;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && answer(null)}>
      <DialogContent className="sm:max-w-md">
        {question && (
          <>
            <DialogHeader>
              <DialogTitle>
                {question.action === "delete"
                  ? m.deleteTitle(question.title)
                  : m.editTitle(question.title)}
              </DialogTitle>
              <DialogDescription>{m.description}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {options().map(({ scope, label, icon: Icon, hint }) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => answer(scope)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-start transition-colors can-hover:hover:bg-accent/50",
                    question.action === "delete" &&
                      scope === "all" &&
                      "border-destructive/40 text-destructive",
                  )}
                >
                  <Icon className="mt-0.5 size-5 shrink-0" />
                  <span className="grid gap-0.5">
                    <span className="font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {hint(question.date)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
