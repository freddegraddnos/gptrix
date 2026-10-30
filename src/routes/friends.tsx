/**
 * Friends — find people by their InkSimulator handle, send requests and keep a
 * list of the friends you share designs with.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Loader2, Search, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useFriends, type FriendProfile } from "@/hooks/useFriends";
import { shareLink } from "@/lib/share";
import { InviteContactsCard } from "@/components/InviteContactsCard";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — share tattoo designs | InkSimulator" },
      {
        name: "description",
        content:
          "Add friends in InkSimulator by handle, accept requests and share tattoo designs so you can try the same ink on in AR.",
      },
      { property: "og:title", content: "Friends on InkSimulator" },
      {
        property: "og:description",
        content:
          "Find friends by handle and share tattoo designs you both want to try on in AR.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.inksimulator.com/friends" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.inksimulator.com/friends" }],
  }),
  component: FriendsRoute,
});

function FriendsRoute() {
  return (
    <RequireAuth
      title="Sign in to add friends"
      description="Friends let you share designs and try the same ink together."
    >
      <FriendsPage />
    </RequireAuth>
  );
}

function name(p: FriendProfile) {
  return p.display_name || (p.handle ? `@${p.handle}` : "InkSimulator user");
}

function Avatar({ p }: { p: FriendProfile }) {
  if (p.avatar_url) {
    return (
      <img
        src={p.avatar_url}
        alt=""
        className="size-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
    );
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[13px] font-bold ring-1 ring-white/10">
      {name(p).replace("@", "").slice(0, 1).toUpperCase()}
    </span>
  );
}

function FriendsPage() {
  const f = useFriends();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FriendProfile[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    try {
      setResults(await f.search(q));
    } catch {
      toast.error("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const send = async (id: string) => {
    setPendingId(id);
    try {
      await f.request(id);
      toast.success("Friend request sent");
      setResults((r) => (r ? r.filter((p) => p.id !== id) : r));
    } catch {
      toast.error("Could not send the request");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-6">
        <header className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-accent/12 ring-1 ring-accent/25">
            <Users className="size-5 text-accent" />
          </span>
          <div>
            <h1 className="text-xl font-black tracking-tight">Friends</h1>
            <p className="text-[12px] text-muted-foreground">
              Find people by handle and share designs you both want to try.
            </p>
          </div>
        </header>

        <div className="mt-5">
          <InviteContactsCard />
        </div>

        <form onSubmit={runSearch} className="mt-5 flex gap-2">
          <label htmlFor="friend-search" className="sr-only">
            Search by handle or name
          </label>
          <input
            id="friend-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search @handle"
            className="h-11 flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3 text-[13px] outline-none focus:border-accent/50"
          />
          <button
            type="submit"
            disabled={searching || q.trim().length < 2}
            className="h-11 rounded-xl bg-accent px-4 text-[13px] font-bold text-ink disabled:opacity-50"
          >
            {searching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
          </button>
        </form>

        {results !== null && (
          <section className="mt-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Results
            </h2>
            {results.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                No one matched that handle.{" "}
                <button
                  type="button"
                  className="font-bold text-accent underline"
                  onClick={() =>
                    void shareLink(
                      "https://www.inksimulator.com",
                      "Try tattoos on your own skin in AR with me on InkSimulator.",
                    )
                  }
                >
                  Invite them instead
                </button>
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {results.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <Avatar p={p} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                      {name(p)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void send(p.id)}
                      disabled={pendingId === p.id}
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-bold text-ink disabled:opacity-50"
                    >
                      {pendingId === p.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="size-3.5" />
                      )}
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {f.loading ? (
          <p className="mt-8 flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading friends…
          </p>
        ) : f.error ? (
          <p className="mt-8 text-[13px] text-red-300">
            Could not load your friends. {f.error}
          </p>
        ) : (
          <>
            {f.incoming.length > 0 && (
              <section className="mt-8">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Requests
                </h2>
                <ul className="mt-2 space-y-2">
                  {f.incoming.map((fr) => (
                    <li
                      key={fr.rowId}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <Avatar p={fr.profile} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                        {name(fr.profile)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Accept ${name(fr.profile)}`}
                        onClick={() =>
                          void f.accept(fr.rowId).catch(() => toast.error("Failed"))
                        }
                        className="grid size-9 place-items-center rounded-lg bg-accent text-ink"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Decline ${name(fr.profile)}`}
                        onClick={() =>
                          void f.remove(fr.rowId).catch(() => toast.error("Failed"))
                        }
                        className="grid size-9 place-items-center rounded-lg border border-white/12"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-8">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Your friends
              </h2>
              {f.accepted.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted-foreground">
                  No friends yet. Search a handle above or{" "}
                  <button
                    type="button"
                    className="font-bold text-accent underline"
                    onClick={() =>
                      void shareLink(
                        "https://www.inksimulator.com",
                        "Try tattoos on your own skin in AR with me on InkSimulator.",
                      )
                    }
                  >
                    invite a friend
                  </button>
                  .
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {f.accepted.map((fr) => (
                    <li
                      key={fr.rowId}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <Avatar p={fr.profile} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                        {name(fr.profile)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void f.remove(fr.rowId).catch(() => toast.error("Failed"))
                        }
                        className="h-9 rounded-lg border border-white/12 px-3 text-[12px] font-bold text-muted-foreground"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {f.outgoing.length > 0 && (
              <section className="mt-8">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Sent
                </h2>
                <ul className="mt-2 space-y-2">
                  {f.outgoing.map((fr) => (
                    <li
                      key={fr.rowId}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-muted-foreground"
                    >
                      <Avatar p={fr.profile} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                        {name(fr.profile)}
                      </span>
                      <span className="text-[11px] uppercase tracking-widest">
                        Pending
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
