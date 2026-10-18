import { addDays, parseISO } from "date-fns";
import { toDateKey } from "./format";
import type { Proposal, ProposalKind } from "./nl-parse";

/**
 * Free English → things to add, by the same rules as the Hebrew reader in
 * nl-parse.ts: "lunch with Dana tomorrow at 1pm, then call the plumber"
 * becomes an event and a task. Local and always available; with a Claude
 * key, Claude reads the sentence instead and this is the fallback.
 */

const WEEKDAYS = [
  ["sunday", "sun"],
  ["monday", "mon"],
  ["tuesday", "tue", "tues"],
  ["wednesday", "wed"],
  ["thursday", "thu", "thur", "thurs"],
  ["friday", "fri"],
  ["saturday", "sat"],
];

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

// Where one thing ends and the next begins. A plain "and" stays inside a
// title ("call mom and dad"); "and then" and "then" split.
const SPLIT = /\s*(?:\n|;|,?\s+and\s+then\s+|,?\s+then\s+|,\s+)\s*/i;

const TASK_WORDS =
  /^(?:to\s+)?(?:call|buy|pay|book|send|write|check|fix|pick\s+up|bring|clean|renew|submit|fill|cancel|order|email|text|reply|finish|prepare|return|remember|remind|need\s+to|have\s+to)\b/i;
const EVENT_WORDS =
  /\b(?:meeting|meet|lunch|dinner|breakfast|brunch|wedding|birthday|doctor|dentist|appointment|flight|show|concert|gym|workout|training|class|lesson|party|conference|interview|visit|ceremony|game|date)\b/i;
const INCOME_WORDS =
  /\b(?:received|got\s+paid|salary|income|refund|bonus|grant|paycheck)\b/i;

function nextWeekday(today: string, weekday: number) {
  const base = parseISO(today);
  // "on Monday" (or "next Monday") said on a Monday means next week, as in
  // Hebrew; on any other day, the coming one.
  const ahead = (weekday - base.getDay() + 7) % 7 || 7;
  return toDateKey(addDays(base, ahead));
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

interface Found {
  date?: string;
  time?: string;
  endTime?: string;
  amount?: number;
  rest: string;
}

/** A date with no year that has already passed this year means next year's. */
function dayOf(today: string, month: number, day: number, year?: number) {
  const base = parseISO(today);
  let y = year ?? base.getFullYear();
  let candidate = new Date(y, month - 1, day);
  if (year === undefined && toDateKey(candidate) < today) {
    y += 1;
    candidate = new Date(y, month - 1, day);
  }
  return candidate.getMonth() === month - 1 ? toDateKey(candidate) : undefined;
}

function takeDate(text: string, today: string): Found {
  let rest = text;
  let date: string | undefined;
  const base = parseISO(today);
  const cut = (
    re: RegExp,
    value: (m: RegExpMatchArray) => string | undefined,
  ) => {
    if (date) return;
    const m = rest.match(re);
    if (!m) return;
    const found = value(m);
    if (!found) return;
    date = found;
    rest = rest.replace(m[0], " ");
  };

  cut(/\b(?:today|tonight|this\s+evening)\b/i, () => today);
  cut(/\b(?:the\s+)?day\s+after\s+tomorrow\b/i, () =>
    toDateKey(addDays(base, 2)),
  );
  cut(/\btomorrow\b/i, () => toDateKey(addDays(base, 1)));
  cut(/\b(?:next\s+week|in\s+a\s+week)\b/i, () => toDateKey(addDays(base, 7)));
  cut(/\bin\s+(\d+)\s+days?\b/i, (m) => toDateKey(addDays(base, Number(m[1]))));

  const names = WEEKDAYS.flat().join("|");
  cut(new RegExp(`\\b(?:(?:on|next|this)\\s+)?(${names})\\b`, "i"), (m) => {
    const word = m[1].toLowerCase();
    return nextWeekday(
      today,
      WEEKDAYS.findIndex((w) => w.includes(word)),
    );
  });

  // "Oct 20", "October 20th", "20 Oct", "on the 20th of October".
  const month = `(${MONTHS.join("|")})[a-z]*\\.?`;
  cut(
    new RegExp(
      `\\b(?:on\\s+)?${month}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`,
      "i",
    ),
    (m) =>
      dayOf(
        today,
        MONTHS.indexOf(m[1].toLowerCase().slice(0, 3)) + 1,
        Number(m[2]),
        m[3] ? Number(m[3]) : undefined,
      ),
  );
  cut(
    new RegExp(
      `\\b(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${month}(?:,?\\s+(\\d{4}))?\\b`,
      "i",
    ),
    (m) =>
      dayOf(
        today,
        MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)) + 1,
        Number(m[1]),
        m[3] ? Number(m[3]) : undefined,
      ),
  );

  // Numbers: day first, as the Hebrew reader and most of the world read
  // "20/10"; the other way round only when the first can't be a month… and
  // the second can't be a day. "10/20" is October 20.
  cut(
    /(?:^|\s)(?:on\s+)?(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=\s|$)/i,
    (m) => {
      let day = Number(m[1]);
      let monthNo = Number(m[2]);
      if (monthNo > 12 && day <= 12) [day, monthNo] = [monthNo, day];
      const year = m[3]
        ? Number(m[3]) < 100
          ? 2000 + Number(m[3])
          : Number(m[3])
        : undefined;
      return dayOf(today, monthNo, day, year);
    },
  );

  return { date, rest };
}

/** 3pm → 15, 12am → 0; without am/pm, 1–7 means the afternoon. */
function hour24(hour: number, meridiem: string | undefined, guess: boolean) {
  const m = meridiem?.toLowerCase().replace(/\./g, "");
  if (m === "pm" && hour < 12) return hour + 12;
  if (m === "am" && hour === 12) return 0;
  if (!m && guess && hour >= 1 && hour <= 7) return hour + 12;
  return hour;
}

function takeTime(text: string): Found {
  let rest = text;
  const ampm = "(a\\.?m\\.?|p\\.?m\\.?)";

  // "from 10 to 12", "between 2 and 4pm", "10:00-11:30", "2-4pm"
  const range = rest.match(
    new RegExp(
      `\\b(?:from\\s+|between\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*${ampm}?\\s*(?:to|until|till|-|–|and)\\s*(\\d{1,2})(?::(\\d{2}))?\\s*${ampm}?(?=\\s|$|,)`,
      "i",
    ),
  );
  if (
    range &&
    Number(range[1]) < 24 &&
    Number(range[4]) < 24 &&
    (range[2] ||
      range[5] ||
      range[3] ||
      range[6] ||
      /from|between|to|until|till/i.test(range[0]))
  ) {
    // "2-4pm": the end's am/pm holds for the start too.
    const endMeridiem = range[6];
    const start = hour24(
      Number(range[1]),
      range[3] ?? endMeridiem,
      !range[3] && !endMeridiem,
    );
    const end = hour24(Number(range[4]), endMeridiem, !endMeridiem);
    rest = rest.replace(range[0], " ");
    return {
      time: `${pad(start)}:${range[2] ?? "00"}`,
      endTime: `${pad(end)}:${range[5] ?? "00"}`,
      rest,
    };
  }

  const noon = rest.match(/\b(?:at\s+)?noon\b/i);
  if (noon) return { time: "12:00", rest: rest.replace(noon[0], " ") };

  // "at 10", "at 3:30 pm", "10am", "15:00"
  const at = rest.match(
    new RegExp(
      `\\bat\\s+(\\d{1,2})(?::(\\d{2}))?\\s*${ampm}?(?=\\s|$|,)|\\b(\\d{1,2})(?::(\\d{2}))?\\s*${ampm}(?=\\s|$|,)|\\b(\\d{1,2}):(\\d{2})(?=\\s|$|,)`,
      "i",
    ),
  );
  if (at) {
    const raw = Number(at[1] ?? at[4] ?? at[7]);
    const minute = at[2] ?? at[5] ?? at[8] ?? "00";
    const meridiem = at[3] ?? at[6];
    // A bare "at 3" is guessed as the afternoon; "15:00" and "3am" are taken as said.
    const hour = hour24(raw, meridiem, at[1] !== undefined && !meridiem);
    if (hour < 24) {
      return { time: `${pad(hour)}:${minute}`, rest: rest.replace(at[0], " ") };
    }
  }
  return { rest };
}

function takeAmount(text: string): Found {
  const m = text.match(
    /(?:^|\s)(?:[$₪€£]\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:[$₪€£]|dollars?|bucks|shekels?|nis|ils|euros?|eur|usd|pounds?|gbp)\b)/i,
  );
  if (!m) return { rest: text };
  return {
    amount: Number((m[1] ?? m[2]).replace(/,/g, "")),
    rest: text.replace(m[0], " "),
  };
}

const FILLER =
  /^(?:i\s+(?:am\s+|'m\s+)?|i'm\s+)?(?:going\s+to|have\s+an?|have|need\s+to|have\s+to|got\s+to|remember\s+to|paid\s+for|paid|spent\s+on|spent|bought|got|received)?\s*/i;

function cleanTitle(text: string) {
  let title = text.replace(/\s+/g, " ").trim();
  title = title.replace(/^(?:and|also|then)\s+/i, "");
  const withoutFiller = title.replace(FILLER, "");
  if (withoutFiller) title = withoutFiller;
  title = title.replace(/^(?:to|for|on|at|a|an)\s+/i, "");
  title = title.replace(/\s+(?:on|at|for|by|from|in)$/i, "");
  title = title.replace(/[,.;]+$/, "").trim();
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : title;
}

export function parseEnglish(text: string, today: string): Proposal[] {
  const proposals: Proposal[] = [];
  let carriedDate: string | undefined;

  for (const piece of text.split(SPLIT)) {
    if (!piece?.trim()) continue;
    const paid = takeAmount(piece);
    const dated = takeDate(paid.rest, today);
    const timed = takeTime(dated.rest);
    // A day said once holds for what follows: "on Monday gym, then lunch".
    const date = dated.date ?? carriedDate;
    if (dated.date) carriedDate = dated.date;

    const words = timed.rest;
    let kind: ProposalKind;
    if (paid.amount !== undefined) kind = "transaction";
    else if (TASK_WORDS.test(words.trim().replace(FILLER, ""))) kind = "task";
    else if (timed.time || EVENT_WORDS.test(words) || date) kind = "event";
    else kind = "task";

    const title = cleanTitle(words);
    if (!title) continue;
    proposals.push({
      kind,
      title,
      date: kind === "transaction" ? (date ?? today) : date,
      time: timed.time,
      endTime: timed.endTime,
      amount: paid.amount,
      type:
        kind === "transaction"
          ? INCOME_WORDS.test(piece)
            ? "income"
            : "expense"
          : undefined,
    });
  }
  return proposals;
}
