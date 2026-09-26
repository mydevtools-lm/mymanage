"use client";

import { cn } from "@/lib/utils";
import { COLOR_STYLES } from "@/lib/colors";
import { useAppStore } from "@/lib/store";
import type { Category, ColorKey, Priority } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

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
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  return <>{children}</>;
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
      <Icon className="mb-3 size-8 text-muted-foreground/60" />
      <div className="font-medium">{title}</div>
      {hint && <div className="mt-1 text-sm text-muted-foreground">{hint}</div>}
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

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "נמוכה",
  normal: "רגילה",
  high: "גבוהה",
  urgent: "דחופה",
};

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
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
