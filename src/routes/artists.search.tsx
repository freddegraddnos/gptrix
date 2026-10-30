import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { normalizeExternalUrl } from "@/lib/externalUrl";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { openDirectConversation } from "@/hooks/useMessages";
import {
  Search,
  MapPin,
  Loader2,
  MessageCircle,
  Globe,
  Instagram,
  Navigation,
} from "lucide-react";

export const Route = createFileRoute("/artists/search")({
  head: () => ({
    meta: [
      { title: "Search tattoo artists & studios — InkSimulator" },
      {
        name: "description",
        content:
          "Search tattoo artists and studios by name or city, find the closest ones to you, and message directly in the app.",
      },
      { property: "og:title", content: "Search tattoo artists & studios — InkSimulator" },
      {
        property: "og:description",
        content: "Find studios near you and chat directly in InkSimulator.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArtistSearch,
});

type Result = {
  user_id: string;
  studio_name: string;
  city: string | null;
  address: string | null;
  website: string | null;
  instagram: string | null;
  bio: string | null;
  lat: number | null;
  lng: number | null;
  accepts_messages: boolean;
  distance_km: number | null;
  handle?: string | null;
};

function ArtistSearch() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [q, setQ] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const run = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("search_artists_v2", {
      _q: q.trim() || undefined,
      _lat: coords?.lat,
      _lng: coords?.lng,
      _limit: 40,
    });
    if (err) setError("Could not search right now.");
    setResults((data as Result[] | null) ?? []);
    setLoading(false);
  }, [q, coords, user]);

  useEffect(() => {
    const t = setTimeout(() => void run(), 250);
    return () => clearTimeout(t);
  }, [run]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Location services are not supported in this browser.");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoBusy(false);
      },
      () => {
        setGeoBusy(false);
        setError("Could not get your location.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const message = async (artistId: string) => {
    if (!user) return;
    setOpening(artistId);
    try {
      const id = await openDirectConversation(user.id, artistId);
      navigate({ to: "/messages/$id", params: { id } });
    } catch {
      setError("Could not open the conversation.");
      setOpening(null);
    }
  };

  return (
    <AppShell>
      <header className="mb-5">
        <div className="text-mono-caps text-[10px] text-accent">Contact</div>
        <h1 className="mt-1 text-3xl font-display font-bold tracking-tight">
          Find & message
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search by studio, artist, or city — or find the closest ones to you.
        </p>
      </header>

      <div className="flex gap-2">
        <div className="flex-1 min-w-0 flex items-center h-12 rounded-xl bg-slate border border-white/10 px-3">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Studio, artist, or city…"
            className="flex-1 min-w-0 bg-transparent border-0 outline-0 text-sm ml-2"
          />
        </div>
        <button
          onClick={useMyLocation}
          className={`h-12 px-4 rounded-xl border text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${
            coords ? "border-accent text-accent" : "border-white/15 text-muted-foreground"
          }`}
        >
          {geoBusy ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
          Nearby
        </button>
      </div>
      {coords && (
        <p className="mt-2 text-[11px] text-accent">
          Sorting by distance from your location.{" "}
          <button className="underline" onClick={() => setCoords(null)}>
            Clear
          </button>
        </p>
      )}
      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}

      <section className="mt-5 space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-10">Searching…</p>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
            <MapPin className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No studios matched your search yet.
            </p>
            <Link
              to="/artists"
              className="mt-4 inline-flex h-11 px-5 rounded-xl border border-accent/60 text-accent font-bold text-xs uppercase tracking-widest items-center"
            >
              Are you an artist? Register your studio
            </Link>
          </div>
        ) : (
          results.map((r) => (
            <article
              key={r.user_id}
              className="rounded-2xl border border-white/5 bg-slate p-4"
            >
              <div className="flex items-start gap-3">
                <div className="size-12 rounded-full bg-gradient-to-br from-accent/30 to-white/5 border border-white/10 grid place-items-center font-display font-bold shrink-0">
                  {r.studio_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-sm truncate">{r.studio_name}</h2>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[r.city, r.address].filter(Boolean).join(" · ") || "Location not specified"}
                  </p>
                  {typeof r.distance_km === "number" && (
                    <p className="text-[11px] text-accent mt-0.5">
                      {r.distance_km < 1
                        ? `${Math.round(r.distance_km * 1000)} m away`
                        : `${r.distance_km.toFixed(1)} km away`}
                    </p>
                  )}
                </div>
              </div>
              {r.bio && (
                <p className="mt-3 text-xs text-muted-foreground line-clamp-3">{r.bio}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                {r.handle && (
                  <Link
                    to="/$handle/book"
                    params={{ handle: r.handle }}
                    className="flex-1 h-11 rounded-xl bg-accent text-ink font-bold text-xs uppercase tracking-widest flex items-center justify-center"
                  >
                    Send request
                  </Link>
                )}
                <button
                  onClick={() => message(r.user_id)}
                  disabled={!r.accepts_messages || opening === r.user_id}
                  className="flex-1 h-11 rounded-xl bg-accent text-ink font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {opening === r.user_id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MessageCircle className="size-4" />
                  )}
                  {r.accepts_messages ? "Send message" : "Not accepting messages"}
                </button>
                {normalizeExternalUrl(r.website) && (
                  <a
                    href={normalizeExternalUrl(r.website)!}
                    target="_blank"
                    rel="noreferrer"
                    className="size-11 rounded-xl border border-white/15 grid place-items-center text-muted-foreground"
                    aria-label={`Website for ${r.studio_name}`}
                  >
                    <Globe className="size-4" />
                  </a>
                )}
                {r.instagram && (
                  <a
                    href={`https://instagram.com/${r.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="size-11 rounded-xl border border-white/15 grid place-items-center text-muted-foreground"
                    aria-label={`Instagram for ${r.studio_name}`}
                  >
                    <Instagram className="size-4" />
                  </a>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </AppShell>
  );
}
