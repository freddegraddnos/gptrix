import { StudioButton as Button } from "@/components/StudioPrimitives";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Copy,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserPlus,
} from "lucide-react";
import { StudioShell } from "@/components/StudioShell";
import { useAuth } from "@/hooks/useAuth";
import {
  searchClients,
  useArtistMode,
  useClientProjects,
} from "@/hooks/useArtistMode";
import { inviteLink } from "@/lib/artistStudio";
import { copyToClipboard } from "@/lib/share";
import { toast } from "sonner";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/artists/clients/")({
  head: () => ({
    meta: [
      { title: tx("Client Projects — Artist Mode | InkSimulator") },
      {
        name: "description",
        content:
          "Create concepts and sketches linked to a specific client, test placement, and send a preview link.",
      },
      { property: "og:title", content: "Client concepts — InkSimulator" },
      { property: "og:description", content: "Private studio customer concepts and previews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ArtistClientsPage,
});

function ArtistClientsPage() {
  useUiLang();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { artist, verified, loading } = useArtistMode(user?.id);
  const { projects, loading: listLoading, create, remove } = useClientProjects(
    verified ? user?.id : undefined,
  );

  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; handle: string; display_name: string | null }[]
  >([]);
  const [picked, setPicked] = useState<{ id: string; handle: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return projects;
    return projects.filter((p) =>
      [p.title, p.client_name, p.client_handle]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s)),
    );
  }, [projects, q]);

  if (authLoading || loading) {
    return (
      <StudioShell current="concepts" narrow>
        <div className="py-20 grid place-items-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </StudioShell>
    );
  }

  if (!user || !verified) {
    return (
      <StudioShell current="concepts" narrow>
        <div className="py-16 text-center">
          <ShieldAlert className="mx-auto size-6 text-accent" />
          <h1 className="mt-3 text-xl font-display font-bold">
            {tx("Artist mode requires verification")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {artist
              ? tx("Your studio profile is awaiting approval. You'll get access as soon as it's verified.")
              : tx("Register your studio to apply for artist mode.")}
          </p>
          <Link
            to="/artists"
            className="mt-6 inline-block rounded-xl bg-accent px-5 py-3 text-sm font-bold text-ink"
          >
            {tx("To the artist portal")}
          </Link>
        </div>
      </StudioShell>
    );
  }

  const runSearch = async (value: string) => {
    setClientQuery(value);
    setPicked(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setResults(await searchClients(value));
  };

  const createProject = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const row = await create({
        title: title.trim(),
        clientHandle: picked?.handle ?? (clientQuery.trim() || undefined),
        clientName: picked ? undefined : clientQuery.trim() || undefined,
        clientUserId: picked?.id ?? null,
      });

      setTitle("");
      setClientQuery("");
      setResults([]);
      setPicked(null);
      if (row) navigate({ to: "/artists/clients/$id", params: { id: row.id } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <StudioShell current="concepts" narrow>
      <p className="-mt-3 mb-5 text-sm text-muted-foreground">
        {tx("Concepts, placement and previews per client.")}
      </p>

      <section className="studio-card mb-5">
        <div className="text-mono-caps text-[10px] text-muted-foreground">
          {tx("New concept")}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tx("Project name, e.g. Forearm – snake & dagger")}
          className="mt-2 w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm outline-none focus:border-accent"
        />
        <div className="mt-2 relative">
          <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={clientQuery}
            onChange={(e) => void runSearch(e.target.value)}
            placeholder={tx("Search client by username (or type a name)")}
            className="w-full h-11 rounded-xl bg-ink border border-white/10 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
        {results.length > 0 && (
          <ul className="mt-2 rounded-xl border border-white/10 overflow-hidden">
            {results.map((r) => (
              <li key={r.id}>
                <Button variant="outline"
                  onClick={() => {
                    setPicked({ id: r.id, handle: r.handle });
                    setClientQuery(r.handle);
                    setResults([]);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                >
                  @{r.handle}
                  {r.display_name && (
                    <span className="text-muted-foreground"> · {r.display_name}</span>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {picked && (
          <p className="mt-1.5 text-[11px] text-accent">
            {tx("Linked client: @")}{picked.handle}
          </p>
        )}
        <Button variant="outline"
          onClick={() => void createProject()}
          disabled={busy || !title.trim()}
          className="mt-3 w-full h-11 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {tx("Create project")}
        </Button>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {tx("Can't find the client? Create the project and send the invite link — the client is linked automatically when it's opened.")}
        </p>
      </section>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tx("Search clients and projects")}
          className="w-full h-11 rounded-xl bg-slate border border-white/10 pl-9 pr-3 text-sm outline-none focus:border-accent"
        />
      </div>

      {listLoading ? (
        <div className="py-10 grid place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="studio-empty text-sm text-muted-foreground">
          {tx("No client projects yet.")}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="studio-card flex items-center gap-3"
            >
              <div className="size-14 rounded-xl overflow-hidden bg-ink border border-white/10 flex-none">
                {p.after_url || p.base_photo_url ? (
                  <img
                    src={(p.after_url ?? p.base_photo_url) as string}
                    alt={p.title}
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  to="/artists/clients/$id"
                  params={{ id: p.id }}
                  className="block truncate text-sm font-bold"
                >
                  {p.title}
                </Link>
                <div className="truncate text-[11px] text-muted-foreground">
                  {p.client_handle ? `@${p.client_handle}` : p.client_name || tx("No client linked")}
                  {" · "}
                  {new Date(p.created_at).toLocaleDateString("en-US")}
                </div>
              </div>
              <Button variant="outline"
                onClick={async () => {
                  await copyToClipboard(inviteLink(p.invite_token));
                  toast.success(tx("Invite link copied"));
                }}
                aria-label={tx("Copy invite link")}
                className="size-9 rounded-xl border border-white/10 grid place-items-center"
              >
                <Copy className="size-4" />
              </Button>
              <Button variant="outline"
                onClick={() => void remove(p.id)}
                aria-label={tx("Remove project")}
                className="size-9 rounded-xl border border-white/10 grid place-items-center"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </StudioShell>
  );
}
