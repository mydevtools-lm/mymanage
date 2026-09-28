"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useDevicePrefs } from "@/lib/device-prefs";
import { dueReminders, upcomingBills } from "@/lib/brief";
import { formatCurrency, todayKey } from "@/lib/format";

const CHECK_MS = 30_000;
// Bills are mentioned once a day, from this hour.
const BILL_HOUR = 8;

function notify(title: string, body: string, tag: string) {
  // A system notification when the app is in the background and allowed;
  // on screen a toast is enough.
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted" ||
    document.visibilityState === "visible"
  ) {
    return;
  }
  const options = {
    body,
    tag,
    lang: "he",
    dir: "rtl" as const,
    icon: "/icons/icon-192.png",
  };
  // Phones allow notifications only through the service worker.
  navigator.serviceWorker?.getRegistration().then((registration) => {
    if (registration) {
      void registration.showNotification(title, options);
      return;
    }
    try {
      new Notification(title, options);
    } catch {
      // No worker and no page notifications here: the toast has to do.
    }
  });
}

/**
 * Reminders for tasks and events at their set time, and a word about
 * recurring bills due within three days — while the app is open, in this
 * tab or in the background. (Push to a closed phone needs FCM: sprint 1.)
 */
export function ReminderWatch() {
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    const prefs = useDevicePrefs.getState();
    if (!prefs.loaded) prefs.load();

    const check = () => {
      const { tasks, events, transactions } = useAppStore.getState();
      const { fired, markFired } = useDevicePrefs.getState();
      const done = new Set(Object.keys(fired));
      const now = new Date();
      const today = todayKey();
      const shown: string[] = [];

      for (const r of dueReminders({ tasks, events }, now, done)) {
        toast(r.title, {
          description: r.body,
          duration: 60_000,
          icon: <BellRing className="size-4" />,
        });
        notify(r.title, r.body, r.key);
        shown.push(r.key);
      }

      if (now.getHours() >= BILL_HOUR) {
        for (const bill of upcomingBills(transactions, today)) {
          const key = `bill:${bill.id}@${bill.date}`;
          if (done.has(key)) continue;
          const when =
            bill.daysLeft === 0
              ? "היום"
              : bill.daysLeft === 1
                ? "מחר"
                : `בעוד ${bill.daysLeft} ימים`;
          const text = `${formatCurrency(bill.amount)} · ${when}`;
          toast(`חשבון קבוע: ${bill.description}`, { description: text });
          notify(`חשבון קבוע: ${bill.description}`, text, key);
          shown.push(key);
        }
      }

      if (shown.length > 0) markFired(shown, today);
    };

    check();
    const timer = setInterval(check, CHECK_MS);
    return () => clearInterval(timer);
  }, [hydrated]);

  return null;
}
