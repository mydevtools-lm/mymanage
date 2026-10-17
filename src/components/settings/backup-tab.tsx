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
import { t } from "@/lib/i18n";

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
  const m = t().settings.backup;

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
    toast.success(m.downloaded);
  }

  async function applyImport() {
    const file = pendingFile.current;
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as DataSnapshot;
      if (!parsed || !Array.isArray(parsed.tasks)) throw new Error("bad file");
      await importData(parsed);
      toast.success(m.imported);
    } catch {
      toast.error(m.badFile);
    } finally {
      pendingFile.current = null;
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>{m.statusTitle}</CardTitle>
          <CardDescription>
            {m.localDb} <code className="text-xs">data/lior.db</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1.5 text-sm">
          <Row label={m.startMonth} value={formatMonth(counts.startMonth)} />
          <Row label={m.tasks} value={counts.tasks} />
          <Row label={m.events} value={counts.events} />
          <Row label={m.transactions} value={counts.transactions} />
          <Row label={m.notes} value={counts.notes} />
          <Row label={m.lists} value={counts.checklists} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{m.backupTitle}</CardTitle>
          <CardDescription>{m.backupHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Button onClick={download}>
            <Download /> {m.exportJson}
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
                <AlertDialogTitle>{m.importConfirmTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {m.importConfirmBody}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    pendingFile.current = null;
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  {t().common.cancel}
                </AlertDialogCancel>
                <AlertDialogAction onClick={applyImport}>
                  {m.importAction}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload /> {m.importJson}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">{m.dangerTitle}</CardTitle>
          <CardDescription>{m.dangerHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              <Trash2 /> {m.deleteAll}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{m.deleteConfirmTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {m.deleteConfirmBody}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t().common.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await clearAll();
                      toast.success(m.deleted);
                    } catch {
                      toast.error(m.deleteFailed);
                    }
                  }}
                >
                  {t().common.delete}
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
