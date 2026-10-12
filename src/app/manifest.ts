import type { MetadataRoute } from "next";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/app-info";

/** Installing to the home screen: a name, icons, and an app-like window. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: "משימות, יומן, כספים ורשימות — במקום אחד",
    lang: "he",
    dir: "rtl",
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
      { name: "משימה חדשה", url: "/?new=task" },
      { name: "הוספה במשפט", url: "/?new=sentence" },
      { name: "יומן", url: "/calendar" },
      { name: "כספים", url: "/finance" },
    ],
  };
}
