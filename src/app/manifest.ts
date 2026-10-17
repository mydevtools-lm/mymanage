import type { MetadataRoute } from "next";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/app-info";

/** Installing to the home screen: a name, icons, and an app-like window. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: "Tasks, calendar, money and lists — in one place",
    lang: "en",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fdfaf3",
    theme_color: "#00745f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "New task", url: "/?new=task" },
      { name: "Add in a sentence", url: "/?new=sentence" },
      { name: "Calendar", url: "/calendar" },
      { name: "Money", url: "/finance" },
    ],
  };
}
