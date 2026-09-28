"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCategories } from "@/lib/store";
import { COLOR_KEYS, COLOR_STYLES } from "@/lib/colors";
import type { CategoryKind, ColorKey } from "@/lib/types";
import { ColorDot } from "./shared";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: React.ReactNode;
}

export function SimpleSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  /** What this select chooses — its accessible name. */
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange((v as string) ?? "")}
      items={options}
    >
      <SelectTrigger aria-label={label} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const NONE = "__none";

export function CategorySelect({
  kind,
  value,
  onChange,
  includeAll,
  className,
  label = "קטגוריה",
}: {
  kind: CategoryKind;
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  className?: string;
  label?: string;
}) {
  const categories = useCategories(kind);
  const options: Option[] = [
    { value: NONE, label: includeAll ? "כל הקטגוריות" : "ללא קטגוריה" },
    ...categories.map((c) => ({
      value: c.id,
      label: (
        <span className="flex items-center gap-2">
          <ColorDot color={c.color} />
          {c.name}
        </span>
      ),
    })),
  ];
  return (
    <SimpleSelect
      value={value || NONE}
      onChange={onChange}
      options={options}
      className={className}
      label={label}
    />
  );
}

/**
 * Categories as tappable chips — one tap instead of open-scroll-pick, which
 * matters when logging an expense standing at the till.
 */
export function CategoryChips({
  kind,
  value,
  onChange,
}: {
  kind: CategoryKind;
  value: string;
  onChange: (value: string) => void;
}) {
  const categories = useCategories(kind);
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5">
      {categories.map((c) => {
        const selected = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? NONE : c.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              selected
                ? "border-primary bg-accent font-medium text-accent-foreground ring-1 ring-primary"
                : "border-input can-hover:hover:bg-muted",
            )}
          >
            <ColorDot color={c.color} />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

export function ColorSelect({
  value,
  onChange,
}: {
  value: ColorKey;
  onChange: (value: ColorKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          title={COLOR_STYLES[key].label}
          aria-label={COLOR_STYLES[key].label}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "size-7 rounded-full ring-offset-2 ring-offset-background transition",
            COLOR_STYLES[key].dot,
            value === key ? "ring-2 ring-ring" : "hover:scale-110",
          )}
        />
      ))}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
