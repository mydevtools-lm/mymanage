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
import { Shortcuts } from "@/components/layout/shortcuts";
import { SeriesPrompt } from "@/components/series-prompt";
import { BudgetWatch } from "@/components/finance/budget-watch";
import { CommandPalette } from "@/components/command-palette";
import { SmartAdd } from "@/components/smart-add";
import { BriefDialog } from "@/components/brief-dialog";
import { ReminderWatch } from "@/components/reminder-watch";
import { Pwa } from "@/components/pwa";
import { APP_NAME } from "@/lib/app-info";
import { Onboarding, SampleBanner } from "@/components/onboarding";
import { DesktopShell } from "@/components/desktop-shell";

const heebo = Heebo({
  variable: "--font-sans",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
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
          <a
            href="#main"
            className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:start-3"
          >
            דלג לתוכן
          </a>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <MobileHeader />
              <main
                id="main"
                tabIndex={-1}
                className="flex-1 outline-none overflow-x-hidden px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:py-6 print:p-0"
              >
                <div className="mx-auto max-w-6xl">
                  <SampleBanner />
                  {children}
                </div>
              </main>
            </div>
          </div>
          <BottomTabs />
          <QuickAddFab />
          <GlobalQuickAdd />
          <Shortcuts />
          <SeriesPrompt />
          <BudgetWatch />
          <CommandPalette />
          <SmartAdd />
          <BriefDialog />
          <Onboarding />
          <ReminderWatch />
          <Pwa />
          <DesktopShell />
        </Providers>
      </body>
    </html>
  );
}
