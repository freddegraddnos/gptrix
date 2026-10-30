import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { HeartHandshake, Loader2, AlertTriangle, Camera, Save } from "lucide-react";
import { toast } from "sonner";
import { getMatchingDesign } from "@/lib/matching.functions";
import { saveMyMotif } from "@/lib/myMotifs";

export const Route = createFileRoute("/m/$token")({
  head: () => ({
    meta: [
      { title: "Matching tattoo invite — InkSimulator" },
      {
        name: "description",
        content:
          "A friend sent you a matching tattoo design. Open it in AR and see it on your own skin at the same size.",
      },
      { property: "og:title", content: "Matching tattoo invite — InkSimulator" },
      {
        property: "og:description",
        content: "Try your friend's matching tattoo design on your own skin in AR.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MatchingPage,
});

function MatchingPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["matching-design", token],
    queryFn: () => getMatchingDesign({ data: { token } }),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-3 size-6 animate-spin text-accent" />
        <p className="text-sm">Opening the matching design…</p>
      </main>
    );
  }

  if (!data || data.ok !== true) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <AlertTriangle className="mx-auto size-8 text-amber-400" />
        <h1 className="mt-4 font-display text-2xl">This link no longer works</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data?.ok === false && data.reason === "expired"
            ? "The matching link has expired. Ask your friend to send a new one."
            : "The link is invalid or has been removed."}
        </p>
      </main>
    );
  }

  const save = () => {
    const motif = saveMyMotif({
      name: data.name,
      src: data.image,
      widthCm: data.widthCm ?? 8,
      source: "share",
    });
    setSaved(true);
    toast.success("Saved to your designs");
    return motif;
  };

  const tryOn = () => {
    const motif = save();
    navigate({
      to: "/ar",
      search: {
        motif: motif.id,
        s: "1",
        ...(data.widthCm ? { w: data.widthCm.toFixed(1) } : {}),
        ...(data.rotation ? { r: String(Math.round(data.rotation)) } : {}),
      },
    });
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-14">
      <p className="text-mono-caps text-[10px] text-accent flex items-center gap-2">
        <HeartHandshake className="size-3.5" /> Matching tattoos
      </p>
      <h1 className="mt-2 font-display text-3xl">
        {data.senderName ? `${data.senderName} wants matching ink` : "Someone wants matching ink"}
      </h1>
      {data.message && (
        <p className="mt-2 rounded-2xl border border-white/10 bg-slate/40 p-3 text-sm text-muted-foreground">
          “{data.message}”
        </p>
      )}

      <div className="mt-6 rounded-3xl border border-white/10 bg-slate/30 p-6 text-center">
        <img
          src={data.image}
          alt={`Matching tattoo design: ${data.name}`}
          className="mx-auto max-h-64 rounded-2xl bg-artwork object-contain p-3"
        />
        <p className="mt-4 text-[13px] font-bold">{data.name}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {data.widthCm
            ? `Shared at the same size — ${data.widthCm.toFixed(1)} cm wide`
            : "Pick your own size when you try it on"}
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={tryOn}
          className="w-full h-12 rounded-full bg-accent text-ink text-[12px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <Camera className="size-4" /> Try it on my skin
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saved}
          className="w-full h-12 rounded-full border border-white/15 text-[12px] font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save className="size-4" /> {saved ? "Saved to my designs" : "Save to my designs"}
        </button>
      </div>
    </main>
  );
}
