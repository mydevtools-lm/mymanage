"use client";

import { Hydrated, PageHeader } from "@/components/shared";
import { UrlTabs } from "@/components/url-tabs";
import { CategoriesTab } from "@/components/settings/categories-tab";
import { ConnectionsTab } from "@/components/settings/connections-tab";
import { BackupTab } from "@/components/settings/backup-tab";
import { NotificationsTab } from "@/components/settings/notifications-tab";
import { PreferencesTab } from "@/components/settings/preferences-tab";

export default function SettingsPage() {
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
          ]}
        />
      </Hydrated>
    </>
  );
}
