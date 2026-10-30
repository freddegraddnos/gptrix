import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { readSharedSketch } from "@/lib/sketchShare.functions";

export const Route = createFileRoute("/s/$token")({
  component: SharedSketchPage,
  head: () => ({
    meta: [
      { title: "Shared Tattoo Sketch — InkSimulator" },
      { name: "description", content: "See the latest sketch version your tattoo studio shared with you." },
      { property: "og:title", content: "Shared Tattoo Sketch — InkSimulator" },
      { property: "og:description", content: "The latest sketch version from your tattoo studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Shared = Awaited<ReturnType<typeof readSharedSketch>>;

function SharedSketchPage() {
  const { token } = Route.useParams();
  const read = useServerFn(readSharedSketch);
  const [state, setState] = useState<Shared | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setState(await read({ data: { token } }));
      } catch {
        setFailed(true);
      }
    })();
  }, [read, token]);

  if (failed || (state && !state.found)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 text-center">
        <h1 className="font-display text-2xl font-bold">This link is no longer active</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ask your studio for a new link to the design.</p>
      </main>
    );
  }

  if (!state) {
    return <main className="mx-auto max-w-md px-5 py-20 text-center text-sm text-muted-foreground">Loading…</main>;
  }

  const version = state.found ? state.version : null;

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <p className="text-mono-caps text-[10px] text-accent">{state.found ? state.studioName ?? "Your studio" : ""}</p>
      <h1 className="mt-1 font-display text-2xl font-bold">{state.found ? state.projectTitle : ""}</h1>
      {version?.url ? (
        <figure className="mt-5">
          <img
            src={version.url}
            alt={`Sketch version ${version.version_number}`}
            className="w-full rounded-lg border border-border bg-secondary"
          />
          <figcaption className="mt-3 text-sm text-muted-foreground">
            Sketch {version.version_number}
            {version.approved ? " · approved" : ""}
            {version.change_comment ? ` · ${version.change_comment}` : ""}
          </figcaption>
        </figure>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">The studio has not uploaded a sketch yet.</p>
      )}
      <p className="mt-8 text-xs text-muted-foreground">
        This page always shows the latest version your studio shared.
      </p>
    </main>
  );
}
