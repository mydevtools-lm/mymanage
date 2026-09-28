"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Arriving with ?focus=<id> (from search, or from a link): scroll that item
 * into view and ring it briefly, so the eye finds it.
 */
export function useFocusTarget(ready: boolean) {
  const focus = useSearchParams().get("focus");

  useEffect(() => {
    if (!ready || !focus) return;
    const el = document.getElementById(`item-${focus}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.setAttribute("data-focused", "");
    const timer = setTimeout(() => el.removeAttribute("data-focused"), 2400);
    return () => clearTimeout(timer);
  }, [ready, focus]);
}
