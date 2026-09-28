"use client";

import { useRouter } from "next/navigation";
import { useQuickAdd } from "@/components/quick-add";
import { useAppStore } from "@/lib/store";
import type { ResultKind } from "@/lib/search";

/**
 * Open any item where it is edited: tasks, routines, events and
 * transactions in their dialog, right here; notes and lists on their screen,
 * scrolled to and highlighted.
 */
export function useOpenItem() {
  const router = useRouter();
  const openEdit = useQuickAdd((s) => s.openEdit);

  return (kind: ResultKind, id: string) => {
    const s = useAppStore.getState();
    if (kind === "task") {
      const task = s.tasks.find((t) => t.id === id);
      if (task) openEdit({ kind: "task", task });
    } else if (kind === "routine") {
      const routine = s.routines.find((r) => r.id === id);
      if (routine) openEdit({ kind: "routine", routine });
    } else if (kind === "event") {
      const event = s.events.find((e) => e.id === id);
      if (event) openEdit({ kind: "event", event });
    } else if (kind === "transaction") {
      const transaction = s.transactions.find((t) => t.id === id);
      if (transaction) openEdit({ kind: "transaction", transaction });
    } else {
      router.push(
        `/notes?tab=${kind === "note" ? "notes" : "lists"}&focus=${id}`,
      );
    }
  };
}
