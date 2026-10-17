import { t } from "./i18n";

/** Greeting by local hour. The boundaries follow everyday Hebrew usage. */
export function greeting(date = new Date()) {
  const hour = date.getHours();
  const text = t().today.greetings;
  if (hour >= 5 && hour < 12) return text.morning;
  if (hour >= 12 && hour < 17) return text.afternoon;
  if (hour >= 17 && hour < 22) return text.evening;
  return text.night;
}
