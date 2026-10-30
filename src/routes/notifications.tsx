import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { Bell, Heart, MessageCircle, UserPlus, MessageSquare, Check, CalendarClock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { pathFor } from "@/lib/notificationLinks";
import { StudioShell } from "@/components/StudioShell";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: tx("Notifications — InkSimulator") },
      { name: "description", content: "See likes, comments, follows and messages in InkSimulator." },
      { property: "og:title", content: "InkSimulator — Notifications" },
      { property: "og:description", content: "In-app notifications for community activity." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: NotificationsPage,
});

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("en-US");
}

function iconFor(kind: Notification["kind"]) {
  switch (kind) {
    case "like":
      return <Heart className="size-4 text-accent" fill="currentColor" strokeWidth={0} />;
    case "comment":
      return <MessageCircle className="size-4 text-accent" />;
    case "follow":
      return <UserPlus className="size-4 text-accent" />;
    case "message":
      return <MessageSquare className="size-4 text-accent" />;
    case "booking":
      return <CalendarClock className="size-4 text-accent" />;
  }
}

function textFor(n: Notification) {
  const name = n.actor_name ?? "Someone";
  switch (n.kind) {
    case "like":
      return `${name} liked your post`;
    case "comment":
      return `${name} commented: "${(n.body ?? "").slice(0, 60)}"`;
    case "follow":
      return tx("{name} is now following you", { name });
    case "message":
      return `${name}: ${(n.body ?? "").slice(0, 60)}`;
    case "booking":
      return tx("Booking update — {body}", { body: (n.body ?? "").slice(0, 60) });
  }
}



function NotificationsPage() {
  useUiLang();
  const [studioOrigin, setStudioOrigin] = useState<boolean | null>(null);
  useEffect(() => setStudioOrigin(sessionStorage.getItem("inksimulator.studio-notifications") === "1"), []);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const {
    items,
    loading: listLoading,
    unread,
    markRead,
    markAllRead,
  } = useNotifications(user?.id);

  const open = (n: Notification) => {
    void markRead(n.id);
    void navigate({ to: pathFor(n) as never });
  };

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/notifications" } });
  }, [loading, user, navigate]);

  if (studioOrigin === null) return <div className="min-h-screen" />;
  return (
    <Frame studio={studioOrigin}>
      {!studioOrigin && <TopBar title={tx("Activity")} />}
      <header className="mb-5 flex items-end justify-between">
        <div>
          {!studioOrigin && <h1 className="font-display font-bold text-2xl">{tx("Notifications")}</h1>}
          <p className="mt-1 text-xs text-muted-foreground">
            {unread > 0 ? `${unread} unread` : tx("All read")}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="h-9 px-3 rounded-lg border border-border text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Check className="size-3" />
            {tx("Mark read")}
          </button>
        )}
      </header>

      {listLoading ? (
        <p className="text-xs text-muted-foreground text-center py-10">{tx("Loading…")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Bell className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {tx("Nothing here yet. Activity shows up in real time.")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={`flex w-full items-center gap-3 rounded-xl p-3 border text-left ${
                  n.read_at ? "border-border bg-transparent" : "border-accent/30 bg-accent/5"
                }`}
              >
                <div className="size-10 rounded-full overflow-hidden bg-slate border border-white/10 grid place-items-center relative">
                  {n.actor_avatar ? (
                    <img src={n.actor_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-accent">
                      {(n.actor_name ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-ink border border-white/10 grid place-items-center">
                    {iconFor(n.kind)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{textFor(n)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {timeAgo(n.created_at)}
                  </p>
                </div>
                {!n.read_at && <span className="size-2 rounded-full bg-accent shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

function Frame({ studio, children }: { studio: boolean; children: React.ReactNode }) {
  if (studio) return <StudioShell current="notifications" narrow>{children}</StudioShell>;
  return <AppShell>{children}</AppShell>;
}
