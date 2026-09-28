import "server-only";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { parseHebrew, type Proposal } from "./nl-parse";

/**
 * Free text → proposals, on the server. With ANTHROPIC_API_KEY set, Claude
 * reads the text; without it — or if the call fails — the local rules do.
 * The key never leaves the server, and nothing is saved here: the screen
 * shows the proposals and the person confirms.
 */

export function claudeConfigured() {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

const TOOL = {
  name: "propose_items",
  description:
    "Items to add to a personal Hebrew planner, read from the user's sentence.",
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
              description: "Short Hebrew title, without the date or time words",
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
              description: "Shekels, for a transaction",
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
  const day = format(parseISO(today), "EEEE, d בMMMM yyyy", { locale: he });
  return [
    `Today is ${today} (${day}), Israel.`,
    "Split the user's Hebrew text into separate items and call propose_items.",
    "- event: something that happens at a time or on a day (meeting, lunch, a visit, a class).",
    "- task: something to do (verbs like להתקשר, לקנות, לשלם, להחליף).",
    "- transaction: money spent or received; set amount and type.",
    "A day mentioned once applies to the items that follow it.",
    "A weekday means its next occurrence after today.",
    "Titles stay in Hebrew and drop filler like 'אני הולך ל'.",
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

async function askClaude(text: string, today: string): Promise<Proposal[]> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt(today),
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: text }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Claude API ${response.status}`);
  const data = (await response.json()) as {
    content?: { type: string; input?: unknown }[];
  };
  const call = data.content?.find((c) => c.type === "tool_use");
  return sanitizeProposals(call?.input);
}

export async function readProposals(text: string, today: string) {
  if (claudeConfigured()) {
    try {
      const proposals = await askClaude(text, today);
      if (proposals.length > 0) return { source: "claude" as const, proposals };
    } catch (error) {
      // The key is a secret; only the status reaches the log.
      console.error("Claude parse failed:", (error as Error).message);
    }
  }
  return { source: "local" as const, proposals: parseHebrew(text, today) };
}
