import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomTabs } from "@/components/layout/bottom-tabs";
import { MobileHeader } from "@/components/layout/mobile-header";
import { SIDEBAR_KEY } from "@/components/layout/nav";
import { GlobalQuickAdd, QuickAddFab } from "@/components/quick-add";

const heebo = Heebo({
  variable: "--font-sans",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "ניהול אישי — Lior Management",
  description: "היום, משימות, יומן, כספים, הערות ורשימות — במקום אחד",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the tab bar pad itself clear of the iPhone home indicator.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#1c2027" },
  ],
};

// Runs before React hydrates, so a collapsed sidebar never flashes open.
const sidebarScript = `try{if(localStorage.getItem(${JSON.stringify(
  SIDEBAR_KEY,
)})==="1")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <Script id="sidebar-state" strategy="beforeInteractive">
          {sidebarScript}
        </Script>
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <MobileHeader />
              <main className="flex-1 overflow-x-hidden px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:py-6">
                <div className="mx-auto max-w-6xl">{children}</div>
              </main>
            </div>
          </div>
          <BottomTabs />
          <QuickAddFab />
          <GlobalQuickAdd />
        </Providers>
      </body>
    </html>
  );
}
