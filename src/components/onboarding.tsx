"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/app-info";
import { useDevicePrefs } from "@/lib/device-prefs";
import { isSample } from "@/lib/sample-data";
import { useAppStore } from "@/lib/store";

type Step = "name" | "start" | "backup";

/**
 * The first run (DESKTOP.md 6.1): a name for the greeting, an empty start or
 * sample data, and a pointer to the backup import. Shown once per device,
 * and not at all when the data already has a name — an imported backup, or
 * the same data opened on a second device.
 */
export function Onboarding() {
  const hydrated = useAppStore((s) => s.hydrated);
  const named = useAppStore((s) => !!s.settings.prefs?.userName);
  const loaded = useDevicePrefs((s) => s.loaded);
  const onboarded = useDevicePrefs((s) => s.onboarded);

  useEffect(() => {
    if (!useDevicePrefs.getState().loaded) useDevicePrefs.getState().load();
  }, []);

  // Decided once, when both are known: the first answer saves the name, and
  // that mustn't close the questions that follow it.
  const [asking, setAsking] = useState<boolean | null>(null);
  if (asking === null && hydrated && loaded) setAsking(!onboarded && !named);

  const open = !!asking && !onboarded;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && useDevicePrefs.getState().markOnboarded()}
    >
      <DialogContent className="sm:max-w-md">
        {open && <Questions />}
      </DialogContent>
    </Dialog>
  );
}

function Questions() {
  const router = useRouter();
  const setPrefs = useAppStore((s) => s.setPrefs);
  const addSampleData = useAppStore((s) => s.addSampleData);
  const isEmpty = useAppStore(
    (s) =>
      s.tasks.length +
        s.events.length +
        s.transactions.length +
        s.notes.length +
        s.checklists.length ===
      0,
  );
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const finish = () => useDevicePrefs.getState().markOnboarded();

  if (step === "name") {
    return (
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setPrefs({ userName: name.trim() });
          // With data already here there is nothing to start with.
          setStep(isEmpty ? "start" : "backup");
        }}
      >
        <DialogHeader>
          <DialogTitle>ברוכים הבאים ל{APP_NAME}</DialogTitle>
          <DialogDescription>שלוש שאלות קצרות, ואפשר להתחיל.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="onboarding-name">איך לקרוא לך?</Label>
          <Input
            id="onboarding-name"
            autoFocus
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={finish}>
            אחר כך
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            המשך
          </Button>
        </DialogFooter>
      </form>
    );
  }

  if (step === "start") {
    return (
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle>להתחיל ריק או עם נתוני דוגמה?</DialogTitle>
          <DialogDescription>
            הדוגמה היא כמה משימות, אירועים ותנועות כדי לראות איך הכול נראה.
            אפשר למחוק אותה בלחיצה אחת.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setStep("backup")}>
            להתחיל ריק
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await addSampleData();
                finish();
              } catch {
                toast.error("לא הצלחנו להוסיף את נתוני הדוגמה");
                setBusy(false);
              }
            }}
          >
            עם נתוני דוגמה
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>יש לך גיבוי?</DialogTitle>
        <DialogDescription>
          קובץ JSON שהורד מהגדרות › גיבוי נטען משם, ומחליף את מה שכאן.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => {
            finish();
            router.push("/settings?tab=backup");
          }}
        >
          לייבוא גיבוי
        </Button>
        <Button onClick={finish}>אין, מתחילים</Button>
      </DialogFooter>
    </div>
  );
}

/** While the sample set is in, a line that offers to remove it. */
export function SampleBanner() {
  const hasSample = useAppStore(
    (s) =>
      s.tasks.some((t) => isSample(t.id)) ||
      s.events.some((e) => isSample(e.id)) ||
      s.transactions.some((t) => isSample(t.id)) ||
      s.notes.some((n) => isSample(n.id)),
  );
  const removeSampleData = useAppStore((s) => s.removeSampleData);
  if (!hasSample) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-4 py-2 text-sm print:hidden">
      <span>מוצגים נתוני דוגמה.</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          removeSampleData().then(
            () => toast.success("נתוני הדוגמה נמחקו"),
            () => toast.error("המחיקה נכשלה"),
          )
        }
      >
        למחוק את הדוגמה
      </Button>
    </div>
  );
}
