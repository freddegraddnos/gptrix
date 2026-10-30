import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import Model3DViewer from "@/components/Model3DViewer";
import { listMyScans, type ScanListItem } from "@/lib/scans.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/scans/compare")({
  head: () => ({
    meta: [
      { title: "Compare 3D scans — InkSimulator" },
      {
        name: "description",
        content:
          "Put two 3D-scanned proposals side by side and compare placement, size, and measurements before you book.",
      },
      { property: "og:title", content: "Compare 3D scans — InkSimulator" },
      {
        property: "og:description",
        content: "Two models side by side — compare tattoo proposals at true scale.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ComparePage,
});

function Picker({
  label,
  scans,
  value,
  onChange,
}: {
  label: string;
  scans: ScanListItem[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-mono-caps text-[10px] text-accent">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-slate px-3 py-2 text-[12px]"
      >
        <option value="">Choose a scan…</option>
        {scans.map((s) => (
          <option key={s.id} value={s.id}>
            {(s.bodyPart ?? "Body part") +
              " · " +
              new Date(s.createdAt).toLocaleDateString("en-US")}
          </option>
        ))}
      </select>
    </label>
  );
}

function ComparePage() {
  const { user } = useAuth();
  const fetchScans = useServerFn(listMyScans);
  const { data: all = [] } = useQuery({
    queryKey: ["my-scans", user?.id],
    queryFn: () => fetchScans(),
    enabled: !!user,
  });
  const ready = all.filter((s) => s.status === "ready" && s.modelUrl);

  const [a, setA] = useState("");
  const [b, setB] = useState("");
  useEffect(() => {
    if (!a && ready[0]) setA(ready[0].id);
    if (!b && ready[1]) setB(ready[1].id);
  }, [ready, a, b]);

  const left = ready.find((s) => s.id === a) ?? null;
  const right = ready.find((s) => s.id === b) ?? null;

  return (
    <AppShell>
      <Link
        to="/mode3d"
        className="inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        3D mode
      </Link>

      <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">Compare side by side</h1>
      <p className="mt-1 mb-4 text-[11px] text-muted-foreground">
        Choose two scans and spin them independently.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Picker label="A" scans={ready} value={a} onChange={setA} />
        <Picker label="B" scans={ready} value={b} onChange={setB} />
      </div>

      {ready.length < 2 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          You need at least two finished 3D scans to compare.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 pb-8">
        <Model3DViewer
          modelUrl={left?.modelUrl ?? null}
          scaleFactor={left?.scaleFactor ?? null}
          calibrated={left?.calibrated ?? false}
          className="h-[45vh]"
        />
        <Model3DViewer
          modelUrl={right?.modelUrl ?? null}
          scaleFactor={right?.scaleFactor ?? null}
          calibrated={right?.calibrated ?? false}
          className="h-[45vh]"
        />
      </div>
    </AppShell>
  );
}
