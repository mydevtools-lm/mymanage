"use client";

import { useTheme } from "next-themes";
import {
  Download,
  MonitorSmartphone,
  Palette,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SimpleSelect } from "@/components/fields";
import { ReminderField } from "@/components/reminder-field";
import { install, useInstall } from "@/components/pwa";
import { useAppStore } from "@/lib/store";
import type { CurrencyCode } from "@/lib/types";
import { useIsTauri } from "@/lib/platform";
import { DesktopSettings } from "./desktop-settings";
import { LOCALES, t, useLocale, type Locale } from "@/lib/i18n";
import { switchLanguage } from "@/lib/language";

const weekStarts = () => {
  const m = t().settings.preferences.weekStarts;
  return [
    { value: "0", label: m.sunday },
    { value: "1", label: m.monday },
    { value: "6", label: m.saturday },
  ];
};

const currencies = () => {
  const m = t().settings.preferences.currencies;
  return [
    { value: "ILS", label: m.ils },
    { value: "USD", label: m.usd },
    { value: "EUR", label: m.eur },
  ];
};

const themes = () => {
  const m = t().settings.preferences.themes;
  return [
    { value: "light", label: m.light },
    { value: "dark", label: m.dark },
    { value: "system", label: m.system },
  ];
};

export function PreferencesTab() {
  const prefs = useAppStore((s) => s.settings.prefs) ?? {};
  const setPrefs = useAppStore((s) => s.setPrefs);
  const { theme, setTheme } = useTheme();
  const offer = useInstall((s) => s.offer);
  const installed = useInstall((s) => s.installed);
  const desktop = useIsTauri();
  const locale = useLocale();
  const m = t().settings.preferences;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4" />
            {m.title}
          </CardTitle>
          <CardDescription>{m.hint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label={m.userName} htmlFor="pref-user-name">
            <Input
              id="pref-user-name"
              defaultValue={prefs.userName ?? ""}
              autoComplete="given-name"
              onBlur={(e) => {
                const userName = e.target.value.trim() || undefined;
                if (userName !== prefs.userName) setPrefs({ userName });
              }}
            />
          </Field>
          <Field label={m.weekStart}>
            <SimpleSelect
              label={m.weekStart}
              value={String(prefs.weekStart ?? 0)}
              options={weekStarts()}
              onChange={(v) => setPrefs({ weekStart: Number(v) as 0 | 1 | 6 })}
            />
          </Field>
          <Field label={m.currency}>
            <SimpleSelect
              label={m.currency}
              value={prefs.currency ?? "ILS"}
              options={currencies()}
              onChange={(v) => {
                setPrefs({ currency: v as CurrencyCode });
                toast.success(m.currencyUpdated);
              }}
            />
          </Field>
          <Field label={m.defaultReminder}>
            <ReminderField
              value={prefs.defaultReminder}
              onChange={(v) => setPrefs({ defaultReminder: v })}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-4" />
              {m.appearance}
            </CardTitle>
            <CardDescription>{m.thisDevice}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label={t().common.language.label}>
              <SimpleSelect
                label={t().common.language.label}
                value={locale}
                options={LOCALES}
                onChange={(v) => switchLanguage(v as Locale)}
              />
            </Field>
            <Field label={m.theme}>
              <SimpleSelect
                label={m.theme}
                value={theme ?? "light"}
                options={themes()}
                onChange={setTheme}
              />
            </Field>
          </CardContent>
        </Card>

        {desktop ? (
          <DesktopSettings />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MonitorSmartphone className="size-4" />
                {m.installTitle}
              </CardTitle>
              <CardDescription>{m.installHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {installed ? (
                <p>{m.installed}</p>
              ) : offer ? (
                <Button
                  className="justify-self-start"
                  onClick={() => void install()}
                >
                  <Download />
                  {m.install}
                </Button>
              ) : (
                <ul className="grid list-disc gap-1 ps-5 text-muted-foreground">
                  <li>{m.installChrome}</li>
                  <li>{m.installIphone}</li>
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                {m.installPhoneNote}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
