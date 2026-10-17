"use client";

import { SimpleSelect } from "@/components/fields";
import { t } from "@/lib/i18n";

const NONE = "none";

function options() {
  const m = t().common.reminder;
  return [
    { value: NONE, label: m.none },
    { value: "0", label: m.atTime },
    { value: "5", label: m.minutesBefore(5) },
    { value: "10", label: m.minutesBefore(10) },
    { value: "30", label: m.halfHourBefore },
    { value: "60", label: m.hourBefore },
    { value: "1440", label: m.dayBefore },
  ];
}

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
      label={t().common.reminder.label}
      value={value === undefined ? NONE : String(value)}
      onChange={(v) => onChange(v === NONE ? undefined : Number(v))}
      options={options()}
    />
  );
}
