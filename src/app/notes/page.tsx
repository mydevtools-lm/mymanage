"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Hydrated, PageHeader } from "@/components/shared";
import { UrlTabs } from "@/components/url-tabs";
import { ListsTab } from "@/components/notes/lists-tab";
import { NotesTab } from "@/components/notes/notes-tab";
import { useAppStore } from "@/lib/store";
import { listMatches } from "@/lib/list-text";
import { t } from "@/lib/i18n";

export default function NotesPage() {
  const checklists = useAppStore((s) => s.checklists);
  const notes = useAppStore((s) => s.notes);
  const [query, setQuery] = useState("");
  const m = t().notes.page;

  // With a search running, each tab says how many hits it holds, so a match
  // in the other tab isn't missed.
  const q = query.trim().toLowerCase();
  const listHits = q
    ? checklists.filter((l) => listMatches(l, q)).length
    : null;
  const noteHits = q
    ? notes.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q))
        .length
    : null;

  return (
    <>
      <PageHeader title={m.title} />
      <Hydrated>
        <div className="relative mb-4 max-w-md">
          <Search className="absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-8 pe-8"
            data-search
            placeholder={m.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={m.clearSearch}
              className="absolute top-1/2 end-1.5 -translate-y-1/2"
              onClick={() => setQuery("")}
            >
              <X />
            </Button>
          )}
        </div>
        <UrlTabs
          tabs={[
            {
              value: "lists",
              label: listHits === null ? m.listsTab : m.listsTabHits(listHits),
              content: <ListsTab query={query} />,
            },
            {
              value: "notes",
              label: noteHits === null ? m.notesTab : m.notesTabHits(noteHits),
              content: <NotesTab query={query} />,
            },
          ]}
        />
      </Hydrated>
    </>
  );
}
