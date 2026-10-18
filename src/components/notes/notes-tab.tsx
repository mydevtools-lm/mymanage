"use client";

import { useRef, useState } from "react";
import { Check, NotebookPen, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared";
import { RowActions } from "@/components/row-actions";
import { useAppStore } from "@/lib/store";
import { COLOR_KEYS, COLOR_STYLES } from "@/lib/colors";
import { formatDate, localDayOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFocusTarget } from "./use-focus-target";
import type { ColorKey, Note } from "@/lib/types";
import { t } from "@/lib/i18n";

/** Pinned first, then most recently edited. */
function sortNotes(notes: Note[]) {
  return [...notes].sort(
    (a, b) =>
      Number(!!b.pinned) - Number(!!a.pinned) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}

function noteMatches(note: Note, query: string) {
  const q = query.trim().toLowerCase();
  return !q || `${note.title} ${note.body}`.toLowerCase().includes(q);
}

function ColorRow({
  value,
  onChange,
}: {
  value?: ColorKey;
  onChange: (color: ColorKey | undefined) => void;
}) {
  const m = t().notes.notes;
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="radiogroup"
      aria-label={m.colorLabel}
    >
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        aria-label={m.noColor}
        onClick={() => onChange(undefined)}
        className={cn(
          "size-6 rounded-full border-2 border-dashed border-muted-foreground/40 bg-card",
          !value && "ring-2 ring-ring ring-offset-1 ring-offset-background",
        )}
      />
      {COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          aria-label={COLOR_STYLES[key].label}
          onClick={() => onChange(key)}
          className={cn(
            "size-6 rounded-full",
            COLOR_STYLES[key].dot,
            value === key &&
              "ring-2 ring-ring ring-offset-1 ring-offset-background",
          )}
        />
      ))}
    </div>
  );
}

/**
 * A note that edits in place. Leaving the card (click outside, Tab away, or
 * "סיום") saves; Esc throws the changes away.
 */
function NoteCard({
  note,
  editing,
  onStartEdit,
  onDone,
  onSave,
}: {
  note: Note;
  editing: boolean;
  onStartEdit: () => void;
  onDone: () => void;
  onSave: (patch: Partial<Note>) => void;
}) {
  const deleteNote = useAppStore((s) => s.deleteNote);
  const updateNote = useAppStore((s) => s.updateNote);
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const cardRef = useRef<HTMLDivElement>(null);
  const m = t().notes.notes;

  const finish = () => {
    if (title !== note.title || body !== note.body) {
      onSave({ title: title.trim(), body: body.trim() });
    }
    onDone();
  };

  const tone = note.color ? COLOR_STYLES[note.color].soft : "";

  if (editing) {
    return (
      <Card
        ref={cardRef}
        className={cn("ring-2 ring-ring/40", tone)}
        onBlur={(e) => {
          // Only when focus leaves the whole card, not between its fields.
          if (!cardRef.current?.contains(e.relatedTarget as Node)) finish();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setTitle(note.title);
            setBody(note.body);
            onDone();
          }
        }}
      >
        <CardContent className="grid gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={m.titlePlaceholder}
            aria-label={m.titleLabel}
            className="bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground/70"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={m.bodyPlaceholder}
            aria-label={m.bodyLabel}
            className="field-sizing-content min-h-24 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground/70 md:text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <ColorRow
              value={note.color}
              onChange={(color) => updateNote(note.id, { color })}
            />
            <Button size="sm" onClick={finish}>
              <Check /> {m.done}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn("group", tone, note.pinned && "ring-1 ring-primary/40")}
    >
      <CardContent className="grid gap-2">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onStartEdit}
            className="min-w-0 flex-1 text-start"
            aria-label={m.editNote(note.title || m.note)}
          >
            <h3 className="flex items-center gap-1.5 font-semibold">
              {note.pinned && (
                <Pin
                  className="size-3.5 shrink-0 text-primary"
                  aria-label={m.pinned}
                />
              )}
              <span className="truncate">{note.title || m.untitled}</span>
            </h3>
          </button>
          <RowActions
            actions={[
              {
                label: note.pinned ? m.unpin : m.pin,
                icon: note.pinned ? PinOff : Pin,
                onSelect: () => updateNote(note.id, { pinned: !note.pinned }),
              },
              {
                label: m.delete,
                icon: Trash2,
                destructive: true,
                onSelect: () => deleteNote(note.id),
              },
            ]}
          />
        </div>
        <button type="button" onClick={onStartEdit} className="text-start">
          <p className="line-clamp-6 text-sm whitespace-pre-wrap text-muted-foreground">
            {note.body || m.emptyBody}
          </p>
        </button>
        <div className="text-xs text-muted-foreground/70">
          {m.updated(formatDate(localDayOf(note.updatedAt)))}
        </div>
      </CardContent>
    </Card>
  );
}

/** A new note lives only here until it has something in it. */
function DraftNote({ onClose }: { onClose: () => void }) {
  const addNote = useAppStore((s) => s.addNote);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const m = t().notes.notes;

  const finish = () => {
    if (title.trim() || body.trim()) {
      addNote({ title: title.trim(), body: body.trim() });
    }
    onClose();
  };

  return (
    <Card
      ref={cardRef}
      className="ring-2 ring-ring/40"
      onBlur={(e) => {
        if (!cardRef.current?.contains(e.relatedTarget as Node)) finish();
      }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <CardContent className="grid gap-2">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={m.titlePlaceholder}
          aria-label={m.newTitleLabel}
          className="bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground/70"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={m.bodyPlaceholder}
          aria-label={m.newBodyLabel}
          className="field-sizing-content min-h-24 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground/70 md:text-sm"
        />
        <div className="flex justify-end border-t pt-2">
          <Button size="sm" onClick={finish}>
            <Check /> {m.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function NotesTab({ query = "" }: { query?: string }) {
  useFocusTarget(true);
  const notes = useAppStore((s) => s.notes);
  const updateNote = useAppStore((s) => s.updateNote);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const m = t().notes.notes;

  const shown = sortNotes(notes).filter((n) => noteMatches(n, query));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {notes.length === 0
            ? m.intro
            : query
              ? m.countOf(shown.length, notes.length)
              : m.count(notes.length)}
        </p>
        <Button
          onClick={() => {
            setEditingId(null);
            setDrafting(true);
          }}
        >
          <Plus /> {m.newNote}
        </Button>
      </div>

      {notes.length === 0 && !drafting ? (
        <EmptyState
          icon={NotebookPen}
          title={m.empty}
          hint={m.intro}
          action={{ label: m.newNote, onClick: () => setDrafting(true) }}
        />
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {drafting && <DraftNote onClose={() => setDrafting(false)} />}
          {shown.map((n) => (
            <div
              key={n.id}
              id={`item-${n.id}`}
              className="scroll-mt-20 rounded-xl transition-shadow data-focused:ring-2 data-focused:ring-primary"
            >
              <NoteCard
                note={n}
                editing={editingId === n.id}
                onStartEdit={() => {
                  setDrafting(false);
                  setEditingId(n.id);
                }}
                onDone={() => setEditingId(null)}
                onSave={(patch) => updateNote(n.id, patch)}
              />
            </div>
          ))}
          {query && shown.length === 0 && !drafting && (
            <p className="py-6 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              {m.noMatch}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
