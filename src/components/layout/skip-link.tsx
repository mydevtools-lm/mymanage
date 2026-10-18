"use client";

import { t } from "@/lib/i18n";

/** The first stop on the page for keyboard users. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:start-3"
    >
      {t().common.skipToContent}
    </a>
  );
}
