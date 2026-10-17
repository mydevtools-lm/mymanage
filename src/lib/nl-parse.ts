import { addDays, parseISO } from "date-fns";
import { toDateKey } from "./format";
import { parseEnglish } from "./nl-parse-en";

/**
 * Free Hebrew → things to add. "ביום שני חממה ואחרי זה ארוחת צהריים
 * משפחתית" becomes two events on Monday.
 *
 * This is the local, rule-based reader: it always works, with no key and no
 * network. When a Claude API key is set, the server asks Claude instead and
 * this stays the fallback. Either way the person sees a preview and confirms
 * before anything is saved.
 */

export type ProposalKind = "task" | "event" | "transaction";

export interface Proposal {
  kind: ProposalKind;
  title: string;
  date?: string; // yyyy-MM-dd
  time?: string; // HH:mm
  endTime?: string;
  amount?: number;
  type?: "income" | "expense";
}

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// Where one thing ends and the next begins.
const SPLIT =
  /\s*(?:\n|;|,\s*ו?אחרי\s+זה|,\s*ואז|\s+ו?אחרי\s+זה\s+|\s+ואחר\s+כך\s+|\s+ואז\s+|\s+וגם\s+|,\s+)\s*/;

const TASK_WORDS =
  /^(?:ל(?:התקשר|קנות|שלם|סדר|החליף|הזמין|שלוח|כתוב|בדוק|תקן|אסוף|הביא|נקות|חדש|הגיש|מלא|לבטל|בטל)|צריך|צריכה|לזכור|תזכורת)/;
const EVENT_WORDS =
  /(?:פגישה|ארוחת|ארוחה|חתונה|יום הולדת|רופא|טיפול|טיסה|הופעה|הצגה|אימון|שיעור|חוג|מסיבה|כנס|ראיון|ביקור|חממה|טקס)/;
const INCOME_WORDS = /(?:קיבלתי|משכורת|הכנסה|החזר|זיכוי|מענק)/;

function nextWeekday(today: string, weekday: number) {
  const base = parseISO(today);
  // Said on that very day, "ביום שני" means next week; "היום" means today.
  const ahead = (weekday - base.getDay() + 7) % 7 || 7;
  return toDateKey(addDays(base, ahead));
}

interface Found {
  date?: string;
  time?: string;
  endTime?: string;
  amount?: number;
  rest: string;
}

function takeDate(text: string, today: string): Found {
  let rest = text;
  let date: string | undefined;
  const cut = (re: RegExp, value: () => string) => {
    if (date) return;
    const m = rest.match(re);
    if (m) {
      date = value();
      rest = rest.replace(m[0], " ");
    }
  };
  const base = parseISO(today);
  cut(/(?:^|\s)היום(?=\s|$)/, () => today);
  cut(/(?:^|\s)מחרתיים(?=\s|$)/, () => toDateKey(addDays(base, 2)));
  cut(/(?:^|\s)מחר(?=\s|$)/, () => toDateKey(addDays(base, 1)));
  cut(/(?:^|\s)(?:בעוד\s+שבוע|שבוע\s+הבא|בשבוע\s+הבא)(?=\s|$)/, () =>
    toDateKey(addDays(base, 7)),
  );
  const inDays = rest.match(/(?:^|\s)בעוד\s+(\d+)\s+ימים(?=\s|$)/);
  if (!date && inDays) {
    date = toDateKey(addDays(base, Number(inDays[1])));
    rest = rest.replace(inDays[0], " ");
  }
  const weekday = rest.match(
    new RegExp(`(?:^|\\s)(?:ב?יום\\s+)(${WEEKDAYS.join("|")})(?=\\s|$)`),
  );
  if (!date && weekday) {
    date = nextWeekday(today, WEEKDAYS.indexOf(weekday[1]));
    rest = rest.replace(weekday[0], " ");
  }
  const numeric = rest.match(
    /(?:^|\s)ב?[־-]?(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=\s|$)/,
  );
  if (!date && numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = numeric[3]
      ? Number(numeric[3]) < 100
        ? 2000 + Number(numeric[3])
        : Number(numeric[3])
      : base.getFullYear();
    let candidate = new Date(year, month - 1, day);
    // No year and already past: next year's.
    if (!numeric[3] && toDateKey(candidate) < today) {
      year += 1;
      candidate = new Date(year, month - 1, day);
    }
    if (candidate.getMonth() === month - 1) {
      date = toDateKey(candidate);
      rest = rest.replace(numeric[0], " ");
    }
  }
  return { date, rest };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function takeTime(text: string): Found {
  let rest = text;
  // "מ־10 עד 12", "10:00-11:30"
  const range = rest.match(
    /(?:^|\s)(?:מ[־-]?|בין\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:עד|-|–|ל[־-]?)\s*(\d{1,2})(?::(\d{2}))?(?=\s|$)/,
  );
  if (
    range &&
    Number(range[1]) < 24 &&
    Number(range[3]) < 24 &&
    (range[2] || range[4] || /עד/.test(range[0]))
  ) {
    rest = rest.replace(range[0], " ");
    return {
      time: `${pad(Number(range[1]))}:${range[2] ?? "00"}`,
      endTime: `${pad(Number(range[3]))}:${range[4] ?? "00"}`,
      rest,
    };
  }
  const at = rest.match(
    /(?:^|\s)(?:בשעה\s+|ב[־-]?)(\d{1,2})(?::(\d{2}))?(?=\s|$)|(?:^|\s)(\d{1,2}):(\d{2})(?=\s|$)/,
  );
  if (at) {
    const hour = Number(at[1] ?? at[3]);
    const minute = at[2] ?? at[4] ?? "00";
    if (hour < 24) {
      rest = rest.replace(at[0], " ");
      return { time: `${pad(hour)}:${minute}`, rest };
    }
  }
  return { rest };
}

function takeAmount(text: string): Found {
  const m = text.match(
    /(?:^|\s)(?:₪\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:₪|ש["״]ח|שקלים|שקל|ש״ח))(?=\s|$)/,
  );
  if (!m) return { rest: text };
  return {
    amount: Number((m[1] ?? m[2]).replace(/,/g, "")),
    rest: text.replace(m[0], " "),
  };
}

const FILLER =
  /^(?:אני\s+)?(?:הולך|הולכת|נוסע|נוסעת|יש\s+לי|יש|צריך|צריכה|לזכור|שילמתי|קיבלתי|הוצאתי)?\s*/;

function cleanTitle(text: string, kind: ProposalKind) {
  let title = text.replace(/\s+/g, " ").trim();
  title = title.replace(/^(?:ו|ואז|וגם)\s+/, "");
  const withoutFiller = title.replace(FILLER, "");
  if (withoutFiller) title = withoutFiller;
  // "לחממה", "לארוחת צהריים" — for an event, "to the" is not the name.
  if (
    kind === "event" &&
    /^ל(?!ה[תמ])[א-ת]{2,}/.test(title) &&
    !TASK_WORDS.test(title)
  ) {
    title = title.slice(1);
  }
  title = title.replace(/^(?:על|ב|עבור)\s+/, "").replace(/\s+(?:ב|על)$/, "");
  return title.trim();
}

export function parseHebrew(text: string, today: string): Proposal[] {
  const proposals: Proposal[] = [];
  let carriedDate: string | undefined;

  for (const piece of text.split(SPLIT)) {
    if (!piece?.trim()) continue;
    const dated = takeDate(piece, today);
    const timed = takeTime(dated.rest);
    const paid = takeAmount(timed.rest);
    // A day said once holds for what follows: "ביום שני חממה ואחרי זה …".
    const date = dated.date ?? carriedDate;
    if (dated.date) carriedDate = dated.date;

    const words = paid.rest;
    let kind: ProposalKind;
    if (paid.amount !== undefined) kind = "transaction";
    else if (TASK_WORDS.test(words.trim().replace(FILLER, ""))) kind = "task";
    else if (timed.time || EVENT_WORDS.test(words) || date) kind = "event";
    else kind = "task";

    const title = cleanTitle(words, kind);
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

/** Hebrew letters → the Hebrew reader; anything else → the English one. By
 *  the sentence, not the interface: a Hebrew sentence works in English too. */
export function parseSentence(text: string, today: string): Proposal[] {
  return /[\u0590-\u05FF]/.test(text)
    ? parseHebrew(text, today)
    : parseEnglish(text, today);
}
