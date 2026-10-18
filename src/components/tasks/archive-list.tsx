"use client";

import { useMemo, useState } from "react";
import { Archive, CheckCircle2, RotateCcw, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared";
import { RowActions } from "@/components/row-actions";
import { useAppStore } from "@/lib/store";
import { formatDate, localDayOf, todayKey } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Task } from "@/lib/types";

/** Finished tasks, grouped by the day they were ticked off, newest first. */
export function ArchiveList() {
  const tasks = useAppStore((s) => s.tasks);
  const restoreTask = useAppStore((s) => s.restoreTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const archived = tasks.filter(
      (t) =>
        t.archivedAt &&
        (!q || `${t.title} ${t.description ?? ""}`.toLowerCase().includes(q)),
    );
    const map = new Map<string, Task[]>();
    for (const task of archived) {
      const day = localDayOf(task.completedAt ?? task.archivedAt!);
      const list = map.get(day) ?? [];
      list.push(task);
      map.set(day, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [tasks, query]);

  const total = tasks.filter((t) => t.archivedAt).length;
  const { common, tasks: text } = t();

  if (total === 0) {
    return (
      <EmptyState
        icon={Archive}
        title={text.archive.empty}
        hint={text.archive.emptyHint}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="relative w-full sm:w-64">
        <Search className="absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="ps-8"
          data-search
          placeholder={text.archive.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {text.archive.noneFound}
        </p>
      )}

      {groups.map(([day, dayTasks]) => (
        <Card key={day}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {day === todayKey()
                ? common.today
                : formatDate(day, common.dates.long)}
            </CardTitle>
            <CardDescription>
              {text.archive.completedCount(dayTasks.length)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            {dayTasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-3 rounded-md px-2 py-1.5 can-hover:hover:bg-accent/40"
              >
                <CheckCircle2 className="size-4 shrink-0 text-income" />
                <span className="flex-1 truncate text-sm text-muted-foreground line-through">
                  {task.title}
                </span>
                <RowActions
                  actions={[
                    {
                      label: text.archive.restore,
                      icon: RotateCcw,
                      onSelect: () => restoreTask(task.id),
                    },
                    {
                      label: common.delete,
                      icon: Trash2,
                      destructive: true,
                      onSelect: () => deleteTask(task.id),
                    },
                  ]}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
