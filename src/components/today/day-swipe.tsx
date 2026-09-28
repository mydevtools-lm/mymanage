"use client";

import { useRef } from "react";

const THRESHOLD = 70;

/**
 * Swipe the day on a phone. RTL order: the next day sits to the left, so
 * dragging the content to the right brings it in — the same way the "next
 * day" arrow points left.
 *
 * Swipes that start on a task row belong to the row (done / tomorrow), and
 * vertical drags stay with the page scroll.
 */
export function DaySwipe({
  children,
  onNext,
  onPrevious,
}: {
  children: React.ReactNode;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      style={{ touchAction: "pan-y" }}
      onPointerDown={(e) => {
        if (e.pointerType !== "touch") return;
        const target = e.target as Element;
        if (target.closest("[data-swipe-row], input, textarea, button")) return;
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const dx = e.clientX - from.x;
        const dy = e.clientY - from.y;
        if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) {
          return;
        }
        if (dx > 0) onNext();
        else onPrevious();
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    >
      {children}
    </div>
  );
}
