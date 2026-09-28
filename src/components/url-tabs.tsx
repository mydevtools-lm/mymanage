"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface UrlTab {
  value: string;
  label: React.ReactNode;
  content: React.ReactNode;
}

/**
 * Tabs whose selection lives in ?tab=…, so a link can open a specific tab
 * (for example the calendar's "not connected" hint → settings › connections)
 * and the browser back button returns to the previous tab.
 */
function UrlTabsInner({ tabs }: { tabs: UrlTab[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("tab");
  const value = tabs.some((t) => t.value === requested)
    ? requested!
    : tabs[0].value;

  return (
    <Tabs
      value={value}
      onValueChange={(next) =>
        router.replace(`${pathname}?tab=${next}`, { scroll: false })
      }
    >
      <TabsList className="mb-4">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

// useSearchParams needs a Suspense boundary on a statically built page.
export function UrlTabs({ tabs }: { tabs: UrlTab[] }) {
  return (
    <Suspense>
      <UrlTabsInner tabs={tabs} />
    </Suspense>
  );
}
