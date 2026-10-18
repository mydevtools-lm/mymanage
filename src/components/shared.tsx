"use client";

import { cn } from "@/lib/utils";
import { COLOR_STYLES } from "@/lib/colors";
import { useAppStore } from "@/lib/store";
import type { Category, ColorKey, Priority } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { t } from "@/lib/i18n";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Renders children only after the persisted store has loaded, so the first
// client render matches the server render.
export function Hydrated({ children }: { children: React.ReactNode }) {
  const hydrated = useAppStore((s) => s.hydrated);
  if (!hydrated) {
    return (
      <div
        data-skeleton
        role="status"
        aria-label={t().common.shared.loading}
        className="space-y-4"
      >
        <div className="h-9 w-56 rounded-md bg-muted motion-safe:animate-pulse" />
        <div className="h-44 rounded-xl border bg-card motion-safe:animate-pulse" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-32 rounded-xl border bg-card motion-safe:animate-pulse" />
          <div className="h-32 rounded-xl border bg-card motion-safe:animate-pulse" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** One look for "nothing here", with the first thing to do about it. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
      <Icon className="mb-3 size-8 text-muted-foreground/60" />
      <div className="font-medium">{title}</div>
      {hint && <div className="mt-1 text-sm text-muted-foreground">{hint}</div>}
      {action && (
        <Button className="mt-4" size="sm" onClick={action.onClick}>
          <Plus /> {action.label}
        </Button>
      )}
    </div>
  );
}

export function ColorDot({
  color,
  className,
}: {
  color: ColorKey;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        COLOR_STYLES[color].dot,
        className,
      )}
    />
  );
}

export function CategoryBadge({ category }: { category?: Category | null }) {
  if (!category) return null;
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1.5 font-normal", COLOR_STYLES[category.color].badge)}
    >
      <ColorDot color={category.color} className="size-1.5" />
      {category.name}
    </Badge>
  );
}

export function priorityLabels(): Record<Priority, string> {
  return t().common.shared.priority;
}

const PRIORITY_CLASSES: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  normal: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  urgent: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge
      variant="secondary"
      className={cn("font-normal", PRIORITY_CLASSES[priority])}
    >
      {priorityLabels()[priority]}
    </Badge>
  );
}
