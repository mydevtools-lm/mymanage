import { format, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import type { Proposal } from "./nl-parse";

/**
 * The Claude request behind "add in one sentence", and how its answer is
 * read. Pure, so the server (assist.ts) and the desktop app (where Rust adds
 * the key and sends it) build the same request and trust the same fields.
 */

export const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const TOOL = {
  name: "propose_items",
  description:
    "Items to add to a personal planner, read from the user's sentence (Hebrew or English).",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["task", "event", "transaction"] },
            title: {
              type: "string",
              description:
                "Short title in the language the user wrote in, without the date or time words",
            },
            date: {
              type: "string",
              description: "yyyy-MM-dd, if a day is said",
            },
            time: { type: "string", description: "HH:mm, if a time is said" },
            endTime: {
              type: "string",
              description: "HH:mm, if an end is said",
            },
            amount: {
              type: "number",
              description:
                "For a transaction: the number, in the currency the user means",
            },
            type: { type: "string", enum: ["income", "expense"] },
          },
          required: ["kind", "title"],
        },
      },
    },
    required: ["items"],
  },
} as const;

function systemPrompt(today: string) {
  const day = format(parseISO(today), "EEEE, MMMM d, yyyy", { locale: enUS });
  return [
    `Today is ${today} (${day}).`,
    "The user writes in Hebrew or English. Split the text into separate items and call propose_items.",
    "- event: something that happens at a time or on a day (meeting, lunch, a visit, a class).",
    "- task: something to do (verbs like call, buy, pay, replace — להתקשר, לקנות, לשלם, להחליף).",
    "- transaction: money spent or received; set amount and type.",
    "A day mentioned once applies to the items that follow it.",
    "A weekday means its next occurrence after today.",
    "Titles stay in the language the user wrote in, and drop filler like 'I'm going to' or 'אני הולך ל'.",
  ].join("\n");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/** Whatever came back, keep only well-formed proposals. */
export function sanitizeProposals(raw: unknown): Proposal[] {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item): Proposal[] => {
    const i = item as Record<string, unknown>;
    const kind = i.kind;
    const title = typeof i.title === "string" ? i.title.trim() : "";
    if (
      !title ||
      (kind !== "task" && kind !== "event" && kind !== "transaction")
    )
      return [];
    const amount =
      typeof i.amount === "number" && i.amount > 0 ? i.amount : undefined;
    if (kind === "transaction" && amount === undefined) return [];
    return [
      {
        kind,
        title,
        date:
          typeof i.date === "string" && DATE.test(i.date) ? i.date : undefined,
        time:
          typeof i.time === "string" && TIME.test(i.time) ? i.time : undefined,
        endTime:
          typeof i.endTime === "string" && TIME.test(i.endTime)
            ? i.endTime
            : undefined,
        amount: kind === "transaction" ? amount : undefined,
        type:
          kind === "transaction"
            ? i.type === "income"
              ? "income"
              : "expense"
            : undefined,
      },
    ];
  });
}

/** The Messages API body: a forced call to propose_items. */
export function claudeRequest(
  text: string,
  today: string,
  model = DEFAULT_MODEL,
) {
  return {
    model,
    max_tokens: 1024,
    system: systemPrompt(today),
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: text }],
  };
}

/** The proposals in a Messages API answer, or none. */
export function proposalsFrom(data: unknown): Proposal[] {
  const content = (data as { content?: { type: string; input?: unknown }[] })
    ?.content;
  const call = content?.find((c) => c.type === "tool_use");
  return sanitizeProposals(call?.input);
}
