import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { NotificationSettings } from "@/components/NotificationSettings";
import { NotificationHistory } from "@/components/NotificationHistory";
import { useAuth } from "@/hooks/useAuth";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/profile/notifications")({
  component: NotificationsSettingsPage,
  head: () => ({
    meta: [
      { title: tx("Notification settings — InkSimulator") },
      {
        name: "description",
        content:
          "Choose how you get InkSimulator booking confirmations, reminders, 3D scan updates and messages — in-app, push or email.",
      },
      { property: "og:title", content: "Notification settings — InkSimulator" },
      {
        property: "og:description",
        content:
          "Pick your channels and the events that should reach you as a client or studio member.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NotificationsSettingsPage() {
  useUiLang();
  const { user, loading } = useAuth();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
        <Link
          to="/profile"
          className="mb-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground"
        >
          <ChevronLeft className="size-3.5" />{" "}{tx("Profile")}
        </Link>
        <h1 className="mb-3 heading-tool">{tx("Notifications")}</h1>

        {loading ? (
          <p className="text-xs text-muted-foreground">{tx("Loading…")}</p>
        ) : user ? (
          <>
            <NotificationSettings userId={user.id} />
            <NotificationHistory userId={user.id} />
          </>
        ) : (
          <Link
            to="/auth"
            search={{ redirect: "/profile/notifications" }}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-accent text-[15px] font-medium text-ink"
          >
            {tx("Sign in to manage notifications")}
          </Link>
        )}
      </div>
    </AppShell>
  );
}
