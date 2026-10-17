"use client";

import { useEffect, useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { APP_NAME, REPO_URL } from "@/lib/app-info";
import { appAbout, type About } from "@/lib/desktop-updates";
import { useUpdate } from "@/components/update-prompt";
import { t } from "@/lib/i18n";

/** Settings › about, in the desktop app: the version, updates, the code. */
export function AboutTab() {
  const [about, setAbout] = useState<About | null>(null);
  const [checking, setChecking] = useState(false);
  const m = t().settings.about;

  useEffect(() => {
    appAbout().then(setAbout, () => {});
  }, []);

  async function check() {
    setChecking(true);
    try {
      const found = await useUpdate.getState().check();
      // A found update opens the update dialog (UpdatePrompt).
      if (found) useUpdate.setState({ answered: null });
      else toast.success(m.upToDate);
    } catch (error) {
      toast.error(typeof error === "string" ? error : m.checkFailed);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-4" />
            {APP_NAME}
          </CardTitle>
          <CardDescription>
            {about ? m.version(about.version) : "…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {about?.updates ? (
            <div className="flex items-center justify-between gap-3">
              <span>{m.updatesHint}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={checking}
                onClick={check}
              >
                <RefreshCw className={checking ? "animate-spin" : undefined} />
                {m.checkUpdates}
              </Button>
            </div>
          ) : (
            about && (
              <p className="text-muted-foreground">{m.unofficialBuild}</p>
            )
          )}
          <p>
            {m.openSource}{" "}
            <a
              href={REPO_URL}
              className="inline-block text-primary underline underline-offset-4"
              dir="ltr"
            >
              {REPO_URL.replace("https://", "")}
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
