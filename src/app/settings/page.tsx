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
import { t } from "@/lib/i18n";

export default function SettingsPage() {
  // About — the version and updates — belongs to the desktop app.
  const desktop = useIsTauri();
  const m = t().settings.tabs;
  return (
    <>
      <PageHeader title={t().common.nav.settings} />
      <Hydrated>
        <UrlTabs
          tabs={[
            {
              value: "categories",
              label: m.categories,
              content: <CategoriesTab />,
            },
            {
              value: "connections",
              label: m.connections,
              content: <ConnectionsTab />,
            },
            {
              value: "preferences",
              label: m.preferences,
              content: <PreferencesTab />,
            },
            {
              value: "notifications",
              label: m.notifications,
              content: <NotificationsTab />,
            },
            { value: "backup", label: m.backup, content: <BackupTab /> },
            ...(desktop
              ? [{ value: "about", label: m.about, content: <AboutTab /> }]
              : []),
          ]}
        />
      </Hydrated>
    </>
  );
}
