"use client";

import { SimpleSelect } from "@/components/fields";

const NONE = "none";

const OPTIONS = [
  { value: NONE, label: "בלי תזכורת" },
  { value: "0", label: "בזמן" },
  { value: "5", label: "5 דקות לפני" },
  { value: "10", label: "10 דקות לפני" },
  { value: "30", label: "חצי שעה לפני" },
  { value: "60", label: "שעה לפני" },
  { value: "1440", label: "יום לפני" },
];

/** Minutes before the set time; undefined is no reminder. */
export function ReminderField({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <SimpleSelect
      label="תזכורת"
      value={value === undefined ? NONE : String(value)}
      onChange={(v) => onChange(v === NONE ? undefined : Number(v))}
      options={OPTIONS}
    />
  );
}
