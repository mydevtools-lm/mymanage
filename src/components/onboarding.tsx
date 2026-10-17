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
import { chosenLocale, getLocale, LOCALES, t, type Locale } from "@/lib/i18n";
import { switchLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

type Step = "language" | "name" | "start" | "backup";

/**
 * The first run (DESKTOP.md 6.1): the language (Windows' by default), a name
 * for the greeting, an empty start or sample data, and a pointer to the
 * backup import. Shown once per device,
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
      onOpenChange={(next) =>
        !next && useDevicePrefs.getState().markOnboarded()
      }
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
  // Choosing a language renders the app again, and these questions with it:
  // once one is chosen, they go on from the name.
  const [step, setStep] = useState<Step>(chosenLocale() ? "name" : "language");
  const m = t().onboarding;
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const finish = () => useDevicePrefs.getState().markOnboarded();

  if (step === "language") {
    const current = getLocale();
    const choose = (locale: Locale) => {
      // Already showing: just go on. Otherwise the app re-renders in the
      // new language, and these questions continue from the name.
      if (locale === current) {
        useDevicePrefs.getState().setLanguage(locale);
        setStep("name");
      } else {
        switchLanguage(locale);
      }
    };
    return (
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle>{m.languageTitle}</DialogTitle>
          <DialogDescription>{m.languageHint}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {LOCALES.map(({ value, label }) => (
            <Button
              key={value}
              lang={value}
              variant={value === current ? "default" : "outline"}
              className={cn("h-12 text-base")}
              autoFocus={value === current}
              onClick={() => choose(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

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
          <DialogTitle>{m.welcome(APP_NAME)}</DialogTitle>
          <DialogDescription>{m.threeQuestions}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="onboarding-name">{m.nameLabel}</Label>
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
            {m.later}
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            {m.next}
          </Button>
        </DialogFooter>
      </form>
    );
  }

  if (step === "start") {
    return (
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle>{m.startTitle}</DialogTitle>
          <DialogDescription>{m.startHint}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setStep("backup")}>
            {m.startEmpty}
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await addSampleData();
                finish();
              } catch {
                toast.error(m.sampleFailed);
                setBusy(false);
              }
            }}
          >
            {m.withSample}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{m.backupTitle}</DialogTitle>
        <DialogDescription>{m.backupHint}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => {
            finish();
            router.push("/settings?tab=backup");
          }}
        >
          {m.importBackup}
        </Button>
        <Button onClick={finish}>{m.noBackup}</Button>
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
  const m = t().onboarding;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-4 py-2 text-sm print:hidden">
      <span>{m.sampleShown}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          removeSampleData().then(
            () => toast.success(m.sampleRemoved),
            () => toast.error(m.removeFailed),
          )
        }
      >
        {m.removeSample}
      </Button>
    </div>
  );
}
