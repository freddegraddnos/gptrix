import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, ImageIcon, Instagram, Loader2, Search, Send, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { StudioInstagramCard } from "@/components/StudioInstagramCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useArtistMode } from "@/hooks/useArtistMode";
import { studioBookingUrl } from "@/lib/studioBookingUrl";
import { loadInstagramMessages, useStudioInbox, type InboxThread, type InstagramMessage } from "@/hooks/useStudioInbox";
import { t as studioT, useStudioLang } from "@/lib/studioLang";
import { createProjectFromThread, markInstagramThreadRead, sendInstagramReply } from "@/lib/instagram.functions";
import { suggestTimeFromMessage } from "@/lib/aiBooking.functions";
import { setSketchShareLink } from "@/lib/sketchShare.functions";
import { confirmArtistProjectAppointment } from "@/lib/projectRequests.functions";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/artists/inbox")({
  head: () => ({
    meta: [
      { title: tx("Inbox — InkSimulator Artist") },
      { name: "description", content: "Answer Instagram DMs and InkSimulator project chats from one studio inbox." },
      { property: "og:title", content: "Studio inbox — InkSimulator" },
      { property: "og:description", content: "Instagram DMs and InkSimulator conversations side by side." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAuth requireVerified title={tx("Sign in to open your inbox")}>
      <InboxPage />
    </RequireAuth>
  ),
});

type Suggestion = { found?: boolean; startsAt?: string | null; label?: string | null; durationMinutes?: number | null };

function hoursLeft(iso: string | null) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 3600_000);
}

function InboxPage() {
  useUiLang();
  const { user } = useAuth();
  const [lang] = useStudioLang();
  const { artist } = useArtistMode(user?.id);
  const studioId = artist?.user_id;
  const navigate = useNavigate();
  const { threads, loading, refresh } = useStudioInbox(studioId);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | "instagram" | "inkvision">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [active, setActive] = useState<InboxThread | null>(null);
  const [messages, setMessages] = useState<InstagramMessage[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<{ messageId: string; value: Suggestion } | null>(null);

  const send = useServerFn(sendInstagramReply);
  const markRead = useServerFn(markInstagramThreadRead);
  const convert = useServerFn(createProjectFromThread);
  const suggestTime = useServerFn(suggestTimeFromMessage);
  const shareSketch = useServerFn(setSketchShareLink);
  const bookTime = useServerFn(confirmArtistProjectAppointment);

  const filtered = useMemo(
    () =>
      threads.filter((thread) => {
        if (source !== "all" && thread.source !== source) return false;
        if (unreadOnly && !thread.unread) return false;
        const haystack = `${thread.name} ${thread.handle ?? ""} ${thread.preview}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      }),
    [threads, query, source, unreadOnly],
  );

  useEffect(() => {
    if (!active || active.source !== "instagram") {
      setMessages([]);
      setSuggestion(null);
      return;
    }
    void (async () => {
      const rows = await loadInstagramMessages(active.id);
      setMessages(rows);
      setSuggestion(null);
      await markRead({ data: { threadId: active.id } }).catch(() => undefined);
      const last = [...rows].reverse().find((row) => (row.body ?? "").trim().length > 3);
      if (!last) return;
      try {
        const value = (await suggestTime({ data: { source: "instagram", messageId: last.id } })) as Suggestion;
        if (value?.found) setSuggestion({ messageId: last.id, value });
      } catch {
        // suggestions are optional
      }
    })();
  }, [active, markRead, suggestTime]);

  const setRequestRead = async (id: string, read: boolean) => {
    const { error } = await supabase
      .from("artist_client_projects")
      .update({ studio_read_at: read ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) toast.error(error.message);
    void refresh();
  };

  const openThread = (thread: InboxThread) => {
    if (thread.source === "inkvision") {
      if (thread.unread) void setRequestRead(thread.id, true);
      void navigate({ to: "/artists/requests/$id", params: { id: thread.id } });
      return;
    }
    setActive(thread);
  };

  const sendReply = async (text: string) => {
    if (!active || !text.trim()) return;
    setBusy(true);
    try {
      await send({ data: { threadId: active.id, body: text.trim() } });
      setReply("");
      setMessages(await loadInstagramMessages(active.id));
      void refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not send the message");
    } finally {
      setBusy(false);
    }
  };

  /** Sends the latest sketch image plus a link that always shows the newest version. */
  const sendSketch = async () => {
    if (!active?.projectId) {
      toast.error(tx("Turn this conversation into a project first."));
      return;
    }
    setBusy(true);
    try {
      const { data: version } = await supabase
        .from("artist_project_sketch_versions")
        .select("version_number, storage_path")
        .eq("project_id", active.projectId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!version) {
        toast.error(tx("This project has no sketch versions yet."));
        return;
      }
      const { token } = await shareSketch({ data: { projectId: active.projectId, enabled: true } });
      const link = `${window.location.origin}/s/${token}`;
      await sendReply(`Here is sketch ${version.version_number}. The latest version is always here: ${link}`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not share the sketch");
    } finally {
      setBusy(false);
    }
  };

  /** Writes the studio's next open times into the reply box. */
  const suggestSlots = async () => {
    if (!studioId) return;
    const { data: slots } = await supabase
      .from("studio_slots")
      .select("starts_at")
      .eq("studio_id", studioId)
      .eq("status", "open")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(3);
    if (!slots?.length) {
      toast.error(tx("No open times in your calendar yet."));
      return;
    }
    const lines = slots
      .map((slot) => new Date(slot.starts_at).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }))
      .join("\n");
    setReply(`I have these times open:\n${lines}\n\nWhich one works for you?`);
  };

  const inviteToInkSimulator = () => {
    const url = artist?.handle ? studioBookingUrl(artist.handle) : null;
    if (!url) {
      toast.error(tx("Add a studio handle first to get a booking link."));
      return;
    }
    setReply(`You can send your idea, reference photos and placement here — it takes a minute: ${url}`);
  };

  const bookSuggestion = async () => {
    if (!active?.projectId || !suggestion?.value.startsAt) {
      toast.error(tx("Turn this conversation into a project first."));
      return;
    }
    const [date, time] = suggestion.value.startsAt.split("T");
    setBusy(true);
    try {
      const result = await bookTime({
        data: {
          projectId: active.projectId,
          date,
          time: time?.slice(0, 5) ?? null,
          durationMinutes: suggestion.value.durationMinutes ?? 120,
        },
      });
      toast.success(result.awaitingDeposit ? "Time held — deposit needed" : "Booked and confirmed");
      setSuggestion(null);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not book this time");
    } finally {
      setBusy(false);
    }
  };

  const replyWindow = hoursLeft(active?.windowExpiresAt ?? null);

  return (
    <AppShell showNav={false} studioProfile>
      <header className="flex items-start justify-between gap-3 border-b border-border pb-5">
        <div>
          <p className="text-mono-caps text-[10px] text-accent">{tx("Artist workspace")}</p>
          <h1 className="mt-1 font-display text-3xl font-bold">{tx("Inbox")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tx("Instagram DMs and InkSimulator chats in one place.")}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Link to="/artists/requests" className="text-xs font-bold text-accent">{tx("Requests")}</Link>
          <Link to="/artists/clients/list" className="text-xs font-bold text-accent">{tx("Clients")}</Link>
        </div>
      </header>

      {studioId && (
        <div className="mt-5">
          <StudioInstagramCard studioId={studioId} />
        </div>
      )}

      {!active ? (
        <>
          <section className="my-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tx("Search sender or text")}
                className="h-11 w-full rounded-md border border-border bg-secondary pl-10 pr-3 text-sm outline-none focus:border-accent"
              />
            </label>
            <select
              aria-label={tx("Filter by source")}
              value={source}
              onChange={(event) => setSource(event.target.value as typeof source)}
              className="h-11 rounded-md border border-border bg-secondary px-3 text-sm"
            >
              <option value="all">{tx("All sources")}</option>
              <option value="instagram">{tx("Instagram")}</option>
              <option value="inkvision">{tx("InkSimulator")}</option>
            </select>
            <Button type="button" variant={unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly((value) => !value)}>
              {tx("Unread")}
            </Button>
          </section>

          {loading ? (
            <div className="grid place-items-center py-20"><Loader2 className="size-5 animate-spin text-accent" /></div>
          ) : filtered.length === 0 ? (
            <div className="border-y border-dashed border-border py-16 text-center text-sm text-muted-foreground">
              {tx("No conversations match these filters.")}
            </div>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {filtered.map((thread) => (
                <li key={`${thread.source}-${thread.id}`} className="flex items-center gap-2">
                  <button type="button" onClick={() => openThread(thread)} className="grid min-w-0 flex-1 grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-4 text-left">
                    <span className="grid size-10 place-items-center overflow-hidden rounded-full bg-secondary">
                      {thread.avatar ? (
                        <img src={thread.avatar} alt="" className="size-full object-cover" />
                      ) : thread.source === "instagram" ? (
                        <Instagram className="size-4 text-accent" aria-hidden />
                      ) : (
                        <span className="text-sm font-bold text-accent">{thread.name[0]}</span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-bold">{thread.name}</span>
                        {thread.unread && <span className="size-2 rounded-full bg-accent" aria-label={tx("Unread")} />}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {thread.source === "instagram" ? thread.handle ?? tx("Instagram") : thread.preview}
                      </span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {new Date(thread.lastMessageAt).toLocaleString()}
                      </span>
                    </span>
                    <span className="rounded-md bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase text-accent">
                      {thread.source === "instagram" ? tx("Instagram") : tx("InkSimulator")}
                    </span>
                  </button>
                  {thread.source === "inkvision" && (
                    <button
                      type="button"
                      onClick={() => void setRequestRead(thread.id, thread.unread)}
                      className="min-h-11 shrink-0 rounded-md border border-border px-2 text-[10px] font-bold uppercase text-muted-foreground hover:text-foreground"
                    >
                      {thread.unread
                        ? studioT({ en: "Mark read", sv: "Markera läst" }, lang)
                        : studioT({ en: "Mark unread", sv: "Markera oläst" }, lang)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <section className="mt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-bold">{active.name}</p>
              <p className="text-xs text-muted-foreground">
                {active.handle ?? tx("Instagram")}
                {replyWindow !== null && (replyWindow > 0 ? ` · ${replyWindow} h left to reply` : tx(" · reply window closed"))}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {active.source === "instagram" && active.handle && active.handle.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(`https://ig.me/m/${active.handle!.slice(1)}`, "_blank", "noopener,noreferrer")
                  }
                >
                  <Instagram className="mr-2 size-4" aria-hidden />
                  {studioT({ en: "Open in Instagram", sv: "Svara i Instagram" }, lang)}
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setActive(null)}>
                {studioT({ en: "Back", sv: "Tillbaka" }, lang)}
              </Button>
            </div>
          </div>

          {!active.projectId && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-3">
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">{tx("Turn this chat into a project to use sketches, deposits and the calendar.")}</p>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const { projectId } = await convert({ data: { threadId: active.id, title: `Instagram · ${active.name}` } });
                    toast.success(tx("Project created"));
                    setActive({ ...active, projectId });
                    void refresh();
                  } catch (cause) {
                    toast.error(cause instanceof Error ? cause.message : "Could not create the project");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <UserPlus className="mr-2 size-4" aria-hidden />
                {tx("Create project")}
              </Button>
            </div>
          )}

          <div className="mt-4 max-h-[46dvh] min-h-52 space-y-3 overflow-y-auto border-y border-border py-4">
            {messages.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{tx("No messages yet.")}</p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex ${message.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-md px-3 py-2 text-sm ${message.direction === "out" ? "bg-accent text-accent-foreground" : "bg-secondary"}`}>
                    {message.attachment_url && (
                      <img src={message.attachment_url} alt={tx("Attachment")} className="mb-2 w-full rounded" />
                    )}
                    {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}
                    <time className="mt-1 block text-[9px] opacity-60">{new Date(message.created_at).toLocaleString()}</time>
                  </div>
                </div>
              ))
            )}
          </div>

          {suggestion?.value.found && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-accent/40 bg-accent/5 p-3">
              <CalendarClock className="size-4 text-accent" aria-hidden />
              <p className="min-w-0 flex-1 text-sm">
                {tx("Book")}{" "}{suggestion.value.label ?? suggestion.value.startsAt}
                {suggestion.value.durationMinutes ? ` — ${Math.round(suggestion.value.durationMinutes / 60)} h` : ""}
              </p>
              <Button type="button" size="sm" disabled={busy} onClick={() => void bookSuggestion()}>{tx("Book")}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setSuggestion(null)}>{tx("Dismiss")}</Button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void sendSketch()}>
              <ImageIcon className="mr-2 size-4" aria-hidden />{tx("Send sketch")}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void suggestSlots()}>
              <CalendarClock className="mr-2 size-4" aria-hidden />{tx("Suggest a time")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={inviteToInkSimulator}>
              <UserPlus className="mr-2 size-4" aria-hidden />{tx("Invite to InkSimulator")}
            </Button>
          </div>

          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void sendReply(reply);
            }}
          >
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={3}
              maxLength={950}
              placeholder={tx("Write a reply…")}
              className="min-h-11 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <Button type="submit" disabled={busy || !reply.trim()} aria-label={tx("Send reply")}>
              <Send className="size-4" aria-hidden />
            </Button>
          </form>
        </section>
      )}
    </AppShell>
  );
}
