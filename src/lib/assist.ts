import "server-only";
import { parseHebrew } from "./nl-parse";
import {
  claudeRequest,
  DEFAULT_MODEL,
  proposalsFrom,
  sanitizeProposals,
} from "./assist-request";

export { sanitizeProposals };

/**
 * Free text → proposals, on the server. With ANTHROPIC_API_KEY set, Claude
 * reads the text; without it — or if the call fails — the local rules do.
 * The key never leaves the server, and nothing is saved here: the screen
 * shows the proposals and the person confirms.
 */

export function claudeConfigured() {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

async function askClaude(text: string, today: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(
      claudeRequest(
        text,
        today,
        process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
      ),
    ),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Claude API ${response.status}`);
  return proposalsFrom(await response.json());
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
