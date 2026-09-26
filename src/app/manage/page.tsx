"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hydrated, PageHeader } from "@/components/shared";
import { NotesTab } from "@/components/manage/notes-tab";
import { CategoriesTab } from "@/components/manage/categories-tab";
import { BackupTab } from "@/components/manage/backup-tab";
import { ConnectionsTab } from "@/components/manage/connections-tab";
import { ListsTab } from "@/components/manage/lists-tab";

export default function ManagePage() {
  return (
    <>
      <PageHeader
        title="ניהול כללי"
        description="הערות, רשימות, קטגוריות, חיבורים וגיבוי"
      />
      <Hydrated>
        <Tabs defaultValue="notes">
          <TabsList className="mb-4">
            <TabsTrigger value="notes">הערות</TabsTrigger>
            <TabsTrigger value="lists">רשימות</TabsTrigger>
            <TabsTrigger value="categories">קטגוריות</TabsTrigger>
            <TabsTrigger value="connections">חיבורים</TabsTrigger>
            <TabsTrigger value="backup">גיבוי</TabsTrigger>
          </TabsList>
          <TabsContent value="notes">
            <NotesTab />
          </TabsContent>
          <TabsContent value="lists">
            <ListsTab />
          </TabsContent>
          <TabsContent value="categories">
            <CategoriesTab />
          </TabsContent>
          <TabsContent value="connections">
            <ConnectionsTab />
          </TabsContent>
          <TabsContent value="backup">
            <BackupTab />
          </TabsContent>
        </Tabs>
      </Hydrated>
    </>
  );
}
