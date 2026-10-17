"use client";

import { dispatch } from "./api-routes";
import { setRepoDb } from "./db-adapter";
import { openLocalDb, tauriDb } from "./tauri-db";
import { t } from "./i18n";

/**
 * The desktop app's /api: the same routes as the server (api-routes.ts),
 * called in-process, with repo.ts reading and writing through Rust.
 */
export async function localApi(url: string, method: string, body?: unknown) {
  await openLocalDb();
  setRepoDb(tauriDb);
  const { status, body: answer } = await dispatch(method, url, body ?? null);
  if (status >= 400) {
    const error = (answer as { error?: string } | null)?.error;
    throw new Error(error ?? t().data.api.error(status));
  }
  return answer;
}
