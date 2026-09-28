/**
 * "09:00–11:00" inside Hebrew text. Without an LTR island the bidi algorithm
 * reorders the two times around the dash, and a narrow block wraps it as
 * "–09:00 / 11:00". The inline-block keeps it in the RTL flow of its line.
 */
export function TimeRange({ start, end }: { start?: string; end?: string }) {
  if (!start) return null;
  return (
    <span dir="ltr" className="inline-block tabular-nums">
      {end ? `${start}–${end}` : start}
    </span>
  );
}
