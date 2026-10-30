import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Calendar, MapPin } from "lucide-react";
import { listApprovedStudios } from "@/lib/studios.functions";

export const Route = createFileRoute("/artists/browse")({
  head: () => ({
    meta: [
      { title: "Find artists — InkSimulator" },
      {
        name: "description",
        content: "Discover and chat directly with Sweden's top tattoo artists. Order custom sketches in the app.",
      },
      { property: "og:title", content: "Find artists — InkSimulator" },
      { property: "og:description", content: "Browse manually approved InkSimulator studios and send a tattoo request." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: () => listApprovedStudios(),
  component: BrowseArtists,
});

function BrowseArtists() {
  const studios = Route.useLoaderData();

  return (
    <AppShell>
      <header className="mb-6">
        <div className="text-mono-caps text-[10px] text-accent">Approved studios</div>
        <h1 className="mt-1 text-3xl font-display font-bold">Artists</h1>
        <p className="mt-1 text-sm text-muted-foreground">Studios manually approved by InkSimulator.</p>
      </header>

      <ul className="space-y-3">
        {studios.map((studio) => (
          <li key={studio.id} className="flex items-center gap-4 rounded-md border border-border bg-card p-4">
            {studio.avatarUrl ? (
              <img src={studio.avatarUrl} alt="" className="size-14 shrink-0 rounded-full border border-border object-cover" />
            ) : (
              <div className="grid size-14 shrink-0 place-items-center rounded-full border border-border bg-secondary font-display font-bold text-accent">
                {studio.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="truncate font-semibold">{studio.name}</div>
              <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                {studio.city ? <><MapPin className="size-3 shrink-0" />{studio.city}</> : `@${studio.handle}`}
              </div>
              {studio.styles.length > 0 && (
                <div className="mt-1 truncate text-mono-caps text-[10px] text-muted-foreground">
                  {studio.styles.join(" · ")}
                </div>
              )}
            </div>
            <Link
              to="/$handle/book"
              params={{ handle: studio.handle }}
              className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"
              aria-label={`Book ${studio.name}`}
            >
              <Calendar className="size-4" />
            </Link>
          </li>
        ))}
      </ul>

      {studios.length === 0 && (
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No approved studios are available yet.
        </div>
      )}

      <Link
        to="/artists"
        className="mt-6 block rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground"
      >
        Are you a tattoo artist? Create an artist profile →
      </Link>
    </AppShell>
  );
}
