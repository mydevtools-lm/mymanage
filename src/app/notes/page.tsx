"use client";

import { Hydrated, PageHeader } from "@/components/shared";
import { UrlTabs } from "@/components/url-tabs";
import { ListsTab } from "@/components/notes/lists-tab";
import { NotesTab } from "@/components/notes/notes-tab";

export default function NotesPage() {
  return (
    <>
      <PageHeader title="הערות ורשימות" />
      <Hydrated>
        <UrlTabs
          tabs={[
            { value: "lists", label: "רשימות", content: <ListsTab /> },
            { value: "notes", label: "הערות", content: <NotesTab /> },
          ]}
        />
      </Hydrated>
    </>
  );
}
