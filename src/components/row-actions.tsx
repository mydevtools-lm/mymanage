"use client";

import { MoreVertical, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface RowAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
}

// Static class strings, one per Tailwind group name, so the compiler sees
// every class. Nested rows (a list item inside a list card) need their own
// group name, or hovering the card would reveal every item's actions.
const REVEAL = {
  default:
    "can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100",
  item: "can-hover:group-hover/item:opacity-100 can-hover:group-focus-within/item:opacity-100",
  card: "can-hover:group-hover/card:opacity-100 can-hover:group-focus-within/card:opacity-100",
} as const;

/**
 * Edit / delete / … for one row.
 *
 * With a mouse the buttons sit inline and appear on hover or keyboard focus,
 * as before. On a touch screen there is no hover, so the same actions live
 * behind a "⋯" button that is always visible.
 */
export function RowActions({
  actions,
  group = "default",
  className,
}: {
  actions: RowAction[];
  group?: keyof typeof REVEAL;
  className?: string;
}) {
  if (actions.length === 0) return null;

  return (
    <div className={cn("flex shrink-0 items-center", className)}>
      <div
        className={cn(
          "hidden transition-opacity can-hover:flex can-hover:opacity-0",
          REVEAL[group],
        )}
      >
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            size="icon-sm"
            aria-label={action.label}
            title={action.label}
            className={cn(action.destructive && "text-destructive")}
            onClick={action.onSelect}
          >
            <action.icon />
          </Button>
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="פעולות"
              className="can-hover:hidden"
            />
          }
        >
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              variant={action.destructive ? "destructive" : "default"}
              onClick={action.onSelect}
              className="py-2"
            >
              <action.icon />
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
