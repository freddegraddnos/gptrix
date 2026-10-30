import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { TopBar } from "@/components/TopBar";
import { Inbox, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useArtistMode } from "@/hooks/useArtistMode";
import { useConversations } from "@/hooks/useMessages";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: tx("Messages — InkSimulator") },
      { name: "description", content: "Messages in real time with tattoo artists and other InkSimulator users." },
      { property: "og:title", content: "InkSimulator — Messages" },
      { property: "og:description", content: "Direct messages in InkSimulator." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => (
    <RequireAuth requireVerified title={tx("Sign in to message studios")} description={tx("You need an account to chat with artists and studios.")}>
      <MessagesPage />
    </RequireAuth>
  ),
});

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("en-US");
}

function MessagesPage() {
  useUiLang();
  const { user } = useAuth();
  const { artist } = useArtistMode(user?.id);
  const { items, loading: listLoading } = useConversations(user?.id);

  return (
    <AppShell>
      <TopBar title={tx("Inbox")} />
      {artist && (
        <div className="mb-5 rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <p className="text-sm font-bold">{tx("You are signed in as a studio")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tx("This is the customer inbox. Your client conversations, project chats and Instagram messages live in the studio inbox.")}
          </p>
          <Link
            to="/artists/inbox"
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-xs font-bold uppercase tracking-widest text-accent-foreground"
          >
            <Inbox className="size-4" />{" "}{tx("Open studio inbox")}
          </Link>
        </div>
      )}
      <header className="mb-5">
        <h1 className="font-display font-bold text-2xl">{tx("Messages")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {tx("Real-time chat with tattoo artists and the community.")}
        </p>
        <Link
          to="/artists/search"
          className="mt-3 inline-flex h-11 px-5 rounded-xl bg-accent text-ink font-bold text-xs uppercase tracking-widest items-center gap-2"
        >
          {tx("Search studios & send message")}
        </Link>
      </header>
      {listLoading ? (
        <p className="text-xs text-muted-foreground text-center py-10">{tx("Loading…")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <MessageSquare className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {tx("No conversations yet. Find a studio or start one from the community.")}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              to="/artists/search"
              className="inline-flex h-11 px-5 rounded-xl bg-accent text-ink font-bold text-sm items-center justify-center"
            >
              {tx("Find a studio near you")}
            </Link>
            <Link
              to="/community"
              className="inline-flex h-11 px-5 rounded-xl border border-white/15 text-sm items-center justify-center"
            >
              {tx("Open community")}
            </Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                to="/messages/$id"
                params={{ id: c.id }}
                className="flex items-center gap-3 py-3"
              >
                <div className="size-11 rounded-full overflow-hidden bg-slate border border-white/10 grid place-items-center">
                  {c.other_avatar ? (
                    <img src={c.other_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-accent">
                      {(c.other_name ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold truncate">
                      {c.other_name ?? tx("User")}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                      {timeAgo(c.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-xs truncate ${
                        c.unread ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {c.last_body ?? tx("New conversation")}
                    </p>
                    {c.unread && (
                      <span className="size-2 shrink-0 rounded-full bg-accent" />
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
