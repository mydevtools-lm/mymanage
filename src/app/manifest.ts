import type { MetadataRoute } from "next";

/** Installing to the home screen: a name, icons, and an app-like window. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ניהול אישי",
    short_name: "ניהול",
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
