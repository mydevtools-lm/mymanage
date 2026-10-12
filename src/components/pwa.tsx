"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { useQuickAdd } from "@/components/quick-add";
import { useSmartAdd } from "@/components/smart-add";
import { isTauri } from "@/lib/platform";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallState {
  /** Chrome's install offer, kept for a button to use later. */
  offer: InstallPrompt | null;
  installed: boolean;
}

export const useInstall = create<InstallState>()(() => ({
  offer: null,
  installed: false,
}));

/** Show the browser's own install dialog; true if the person accepted. */
export async function install() {
  const { offer } = useInstall.getState();
  if (!offer) return false;
  await offer.prompt();
  const { outcome } = await offer.userChoice;
  useInstall.setState({ offer: null, installed: outcome === "accepted" });
  return outcome === "accepted";
}

type NewKind = "task" | "event" | "transaction" | "item";
const NEW_KINDS: NewKind[] = ["task", "event", "transaction", "item"];

/**
 * Registers the service worker (production builds only — in development it
 * would cache pages under the hot reloader), keeps the browser's install
 * offer for the settings button, and answers the home-screen shortcuts:
 * /?new=task opens a new task, /?new=sentence the sentence box.
 */
export function Pwa() {
  useEffect(() => {
    useInstall.setState({
      installed: window.matchMedia("(display-mode: standalone)").matches,
    });
    const onOffer = (event: Event) => {
      event.preventDefault();
      useInstall.setState({ offer: event as InstallPrompt });
    };
    const onInstalled = () =>
      useInstall.setState({ offer: null, installed: true });
    window.addEventListener("beforeinstallprompt", onOffer);
    window.addEventListener("appinstalled", onInstalled);

    // The desktop app ships its files with it; a service worker would only
    // serve a stale copy after an update.
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator &&
      !isTauri()
    ) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((error) => console.error("service worker:", error));
    }

    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("new");
    if (wanted) {
      if (wanted === "sentence") useSmartAdd.getState().open();
      else if (NEW_KINDS.includes(wanted as NewKind)) {
        useQuickAdd.getState().open(wanted as NewKind);
      }
      // Once handled, the address goes back to plain, so a reload won't
      // repeat it.
      params.delete("new");
      const rest = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (rest ? `?${rest}` : ""),
      );
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onOffer);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
