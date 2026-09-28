"use client";

import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Drag to reorder, by a handle, with mouse or finger. Arrow keys on the
 * focused handle move an item one step, so the order is reachable without
 * a pointer too. The new order is committed once, on release.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  handleLabel = "גרירה לשינוי הסדר",
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  renderItem: (item: T, handle: React.ReactNode) => React.ReactNode;
  handleLabel?: string;
}) {
  const [preview, setPreview] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const order = preview ?? items.map((i) => i.id);
  const byId = new Map(items.map((i) => [i.id, i]));
  const shown = order.flatMap((id) => byId.get(id) ?? []);

  function move(id: string, to: number, commit: boolean) {
    const current = preview ?? items.map((i) => i.id);
    const from = current.indexOf(id);
    if (from < 0 || to === from || to < 0 || to >= current.length) return;
    const next = [...current];
    next.splice(from, 1);
    next.splice(to, 0, id);
    if (commit) onReorder(next);
    else setPreview(next);
  }

  function indexAt(y: number, id: string) {
    const ids = preview ?? items.map((i) => i.id);
    for (let i = 0; i < ids.length; i++) {
      const el = rowRefs.current.get(ids[i]);
      if (!el || ids[i] === id) continue;
      const box = el.getBoundingClientRect();
      if (y < box.top + box.height / 2) {
        const from = ids.indexOf(id);
        return i > from ? i - 1 : i;
      }
    }
    return ids.length - 1;
  }

  return (
    <div className="grid gap-1">
      {shown.map((item, index) => {
        const handle = (
          <button
            type="button"
            aria-label={`${handleLabel} — מקום ${index + 1} מתוך ${shown.length}`}
            className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60 transition-colors active:cursor-grabbing can-hover:hover:text-foreground"
            onPointerDown={(e) => {
              // Capture keeps the moves coming even when the finger leaves
              // the handle. It can refuse (the pointer already ended); the
              // drag still works from the handle's own events.
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {}
              setDragging(item.id);
              setPreview(items.map((i) => i.id));
            }}
            onPointerMove={(e) => {
              if (dragging !== item.id) return;
              move(item.id, indexAt(e.clientY, item.id), false);
            }}
            onPointerUp={() => {
              if (dragging !== item.id) return;
              const final = preview;
              setDragging(null);
              setPreview(null);
              const original = items.map((i) => i.id);
              if (final && final.join() !== original.join()) onReorder(final);
            }}
            onPointerCancel={() => {
              setDragging(null);
              setPreview(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                move(item.id, index - 1, true);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                move(item.id, index + 1, true);
              }
            }}
          >
            <GripVertical className="size-4" />
          </button>
        );

        return (
          <div
            key={item.id}
            ref={(el) => {
              if (el) rowRefs.current.set(item.id, el);
              else rowRefs.current.delete(item.id);
            }}
            className={cn(
              "rounded-md transition-shadow",
              dragging === item.id &&
                "relative z-10 bg-card shadow-md ring-1 ring-primary/40",
            )}
          >
            {renderItem(item, handle)}
          </div>
        );
      })}
    </div>
  );
}
