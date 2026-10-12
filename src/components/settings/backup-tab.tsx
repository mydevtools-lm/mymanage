"use client";

import { useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/lib/store";
import { formatMonth, toDateKey } from "@/lib/format";
import type { DataSnapshot } from "@/lib/types";
import { APP_SLUG } from "@/lib/app-info";

export function BackupTab() {
  const exportData = useAppStore((s) => s.exportData);
  const importData = useAppStore((s) => s.importData);
  const clearAll = useAppStore((s) => s.clearAll);
  const counts = useAppStore(
    useShallow((s) => ({
      tasks: s.tasks.length,
      events: s.events.length,
      transactions: s.transactions.length,
      notes: s.notes.length,
      checklists: s.checklists.length,
      startMonth: s.settings.startMonth,
    })),
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function download() {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${APP_SLUG}-${toDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("הגיבוי הורד");
  }

  async function applyImport() {
    const file = pendingFile.current;
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as DataSnapshot;
      if (!parsed || !Array.isArray(parsed.tasks)) throw new Error("bad file");
      await importData(parsed);
      toast.success("הנתונים יובאו בהצלחה");
    } catch {
      toast.error("הקובץ אינו גיבוי תקין");
    } finally {
      pendingFile.current = null;
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>מצב הנתונים</CardTitle>
          <CardDescription>
            מסד נתונים מקומי — <code className="text-xs">data/lior.db</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1.5 text-sm">
          <Row label="חודש התחלה" value={formatMonth(counts.startMonth)} />
          <Row label="משימות" value={counts.tasks} />
          <Row label="אירועים" value={counts.events} />
          <Row label="תנועות כספיות" value={counts.transactions} />
          <Row label="הערות" value={counts.notes} />
          <Row label="רשימות" value={counts.checklists} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>גיבוי ושחזור</CardTitle>
          <CardDescription>מומלץ לייצא גיבוי פעם בשבוע</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Button onClick={download}>
            <Download /> ייצוא לקובץ JSON
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              pendingFile.current = e.target.files?.[0] ?? null;
              if (pendingFile.current) setConfirmOpen(true);
            }}
          />
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  לייבא ולדרוס את הנתונים הקיימים?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  כל המשימות, האירועים, התנועות וההערות הנוכחיים יוחלפו בתוכן
                  הקובץ.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    pendingFile.current = null;
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  ביטול
                </AlertDialogCancel>
                <AlertDialogAction onClick={applyImport}>
                  ייבוא
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload /> ייבוא מקובץ JSON
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">אזור מסוכן</CardTitle>
          <CardDescription>מחיקה של כל הנתונים במערכת</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              <Trash2 /> מחיקת כל הנתונים
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>למחוק את כל הנתונים?</AlertDialogTitle>
                <AlertDialogDescription>
                  הפעולה אינה הפיכה. כדאי לייצא גיבוי לפני כן.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await clearAll();
                      toast.success("כל הנתונים נמחקו");
                    } catch {
                      toast.error("המחיקה נכשלה");
                    }
                  }}
                >
                  מחיקה
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
