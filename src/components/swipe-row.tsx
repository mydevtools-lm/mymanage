"use client";

import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeAction {
  label: string;
  icon: LucideIcon;
  onSwipe: () => void;
  /** Background of the strip uncovered while dragging. */
  className: string;
}

const THRESHOLD = 80; // px of drag that commits the action
const MAX = 120;

/**
 * Touch-only horizontal swipe on a row. Directions are physical, not
 * logical: dragging the row to the right uncovers the strip on its left, and
 * the other way round — the same on an RTL page as on an LTR one.
 *
 * Mouse and pen input pass straight through, and vertical scrolling is left
 * to the browser (touch-action: pan-y).
 */
export function SwipeRow({
  children,
  right,
  left,
}: {
  children: React.ReactNode;
  /** Runs when the row is dragged to the right. */
  right?: SwipeAction;
  /** Runs when the row is dragged to the left. */
  left?: SwipeAction;
}) {
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"h" | "v" | null>(null);
  const moved = useRef(false);

  function reset() {
    start.current = null;
    axis.current = null;
    setSettling(true);
    setDx(0);
  }

  const active = dx > 0 ? right : dx < 0 ? left : undefined;
  const armed = Math.abs(dx) >= THRESHOLD;

  return (
    <div data-swipe-row className="relative overflow-hidden rounded-lg">
      {active && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 flex items-center px-5 text-sm font-medium text-white transition-opacity",
            dx > 0 ? "justify-start" : "justify-end",
            active.className,
            armed ? "opacity-100" : "opacity-70",
          )}
          // Physical side: the strip sits where the row has moved away from.
          style={{ direction: "ltr" }}
        >
          <span className="flex items-center gap-2">
            <active.icon className="size-5" />
            {active.label}
          </span>
        </div>
      )}

      <div
        className={cn(
          "relative",
          settling && "transition-transform duration-200",
        )}
        style={{ transform: `translateX(${dx}px)`, touchAction: "pan-y" }}
        onTransitionEnd={() => setSettling(false)}
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") return;
          // A drag handle inside the row reorders; it mustn't swipe too.
          if ((e.target as HTMLElement).closest("[data-drag-handle]")) return;
          start.current = { x: e.clientX, y: e.clientY };
          axis.current = null;
          moved.current = false;
          setSettling(false);
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const mx = e.clientX - start.current.x;
          const my = e.clientY - start.current.y;
          if (!axis.current && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
            axis.current = Math.abs(mx) > Math.abs(my) ? "h" : "v";
          }
          if (axis.current !== "h") return;
          moved.current = true;
          const allowed = (mx > 0 && right) || (mx < 0 && left);
          setDx(allowed ? Math.max(-MAX, Math.min(MAX, mx)) : 0);
        }}
        onPointerUp={() => {
          if (axis.current === "h") {
            if (dx >= THRESHOLD) right?.onSwipe();
            else if (dx <= -THRESHOLD) left?.onSwipe();
          }
          reset();
        }}
        onPointerCancel={reset}
        // A swipe must not also count as a tap on whatever was under the finger.
        onClickCapture={(e) => {
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
