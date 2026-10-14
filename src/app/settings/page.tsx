"use client";

import { Hydrated, PageHeader } from "@/components/shared";
import { UrlTabs } from "@/components/url-tabs";
import { CategoriesTab } from "@/components/settings/categories-tab";
import { ConnectionsTab } from "@/components/settings/connections-tab";
import { BackupTab } from "@/components/settings/backup-tab";
import { NotificationsTab } from "@/components/settings/notifications-tab";
import { PreferencesTab } from "@/components/settings/preferences-tab";
import { AboutTab } from "@/components/settings/about-tab";
import { useIsTauri } from "@/lib/platform";

export default function SettingsPage() {
  // About — the version and updates — belongs to the desktop app.
  const desktop = useIsTauri();
  return (
    <>
      <PageHeader title="הגדרות" />
      <Hydrated>
        <UrlTabs
          tabs={[
            {
              value: "categories",
              label: "קטגוריות",
              content: <CategoriesTab />,
            },
            {
              value: "connections",
              label: "חיבורים",
              content: <ConnectionsTab />,
            },
            {
              value: "preferences",
              label: "העדפות",
              content: <PreferencesTab />,
            },
            {
              value: "notifications",
              label: "התראות",
              content: <NotificationsTab />,
            },
            { value: "backup", label: "גיבוי", content: <BackupTab /> },
            ...(desktop
              ? [{ value: "about", label: "אודות", content: <AboutTab /> }]
              : []),
          ]}
        />
      </Hydrated>
    </>
  );
}
