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

/** Settings › about, in the desktop app: the version, updates, the code. */
export function AboutTab() {
  const [about, setAbout] = useState<About | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    appAbout().then(setAbout, () => {});
  }, []);

  async function check() {
    setChecking(true);
    try {
      const found = await useUpdate.getState().check();
      // A found update opens the update dialog (UpdatePrompt).
      if (found) useUpdate.setState({ answered: null });
      else toast.success("זו הגרסה האחרונה");
    } catch (error) {
      toast.error(
        typeof error === "string" ? error : "הבדיקה נכשלה — אין חיבור?",
      );
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
            {about ? `גרסה ${about.version}` : "…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {about?.updates ? (
            <div className="flex items-center justify-between gap-3">
              <span>
                עדכונים נבדקים בפתיחה ופעם ביום, ומותקנים רק אחרי שאישרת.
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={checking}
                onClick={check}
              >
                <RefreshCw className={checking ? "animate-spin" : undefined} />
                בדיקת עדכונים
              </Button>
            </div>
          ) : (
            about && (
              <p className="text-muted-foreground">
                הבנייה הזו לא מתעדכנת לבד — היא לא נבנתה בשחרור הרשמי. גרסאות
                חדשות בעמוד הגרסאות במאגר.
              </p>
            )
          )}
          <p>
            קוד פתוח ברישיון MIT:{" "}
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
