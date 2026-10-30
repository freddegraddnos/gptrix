import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Brush, Check, Copy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import Model3DViewer from "@/components/Model3DViewer";
import { getMyScan } from "@/lib/scans.functions";
import { createScanShare } from "@/lib/scanShare.functions";
import { SendScanToStudio } from "@/components/SendScanToStudio";
import { SleeveDesignPicker } from "@/components/SleeveDesignPicker";

import { setPaintPrefill , setPaintReturnTo} from "@/lib/paintHandoff";

import {
  addOwnAnnotation,
  deleteAnnotation,
  listOwnAnnotations,
  saveScanScale,
} from "@/lib/scanAnnotations";


export const Route = createFileRoute("/scans/$id")({
  head: () => ({
    meta: [
      { title: "My 3D scan — InkSimulator" },
      {
        name: "description",
        content:
          "Spin your 3D-scanned body part, measure distances in cm, and share the model with your tattoo artist.",
      },
      { property: "og:title", content: "My 3D scan — InkSimulator" },
      {
        property: "og:description",
        content: "3D model at true scale with measuring tool and share link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  const { id } = Route.useParams();
  const fetchScan = useServerFn(getMyScan);
  const navigate = useNavigate();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  /** Artwork wrapped around the scan via the cylindrical UV mapping. */
  const [sleeveUrl, setSleeveUrl] = useState<string | null>(null);


  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-scan", id],
    queryFn: () => fetchScan({ data: { scanId: id } }),
    refetchInterval: (q) => (q.state.data?.status === "processing" ? 15000 : false),
  });

  const { data: notes } = useQuery({
    queryKey: ["scan-annotations", id],
    queryFn: () => listOwnAnnotations(id),
  });

  const share = async () => {
    setSharing(true);
    try {
      const { token } = await createScanShare({ data: { scanId: id, days: 30 } });
      const url = `${window.location.origin}/s/${token}`;
      setShareUrl(url);
      if (navigator.share) {
        await navigator.share({ title: "My 3D scan — InkSimulator", url }).catch(() => {});
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <AppShell>
      <Link
        to="/mode3d"
        className="inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        3D mode
      </Link>

      <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">
        {data?.bodyPart ?? "3D scan"}
      </h1>
      <p className="mt-1 mb-4 text-[11px] text-muted-foreground">
        Drag to spin, pinch to zoom. Run the calibration guide once and the measuring tool gives
        distances in real cm.
      </p>

      <Model3DViewer
        modelUrl={data?.modelUrl ?? null}
        scaleFactor={data?.scaleFactor ?? null}
        calibrated={data?.calibrated ?? false}
        processing={isLoading || data?.status === "processing"}
        error={data?.status === "failed" ? "The 3D model could not be created." : null}
        onShare={data?.status === "ready" ? share : undefined}
        sharing={sharing}
        sleeveDesignUrl={sleeveUrl}
        onCalibrate={async (factor) => {
          await saveScanScale(id, factor);
          await qc.invalidateQueries({ queryKey: ["my-scan", id] });
        }}
        annotations={notes ?? []}
        onAddAnnotation={async (point, body) => {
          await addOwnAnnotation(id, point, body, "You");
          await qc.invalidateQueries({ queryKey: ["scan-annotations", id] });
        }}
        onDeleteAnnotation={async (annotationId) => {
          await deleteAnnotation(annotationId);
          await qc.invalidateQueries({ queryKey: ["scan-annotations", id] });
        }}
        className="h-[60vh]"
      />

      <SleeveDesignPicker value={sleeveUrl} onChange={setSleeveUrl} />



      {shareUrl && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="mt-3 flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-slate p-3 text-left"
        >
          {copied ? (
            <Check className="size-4 text-accent" />
          ) : (
            <Copy className="size-4 text-muted-foreground" />
          )}
          <span className="flex-1 truncate text-[11px]">{shareUrl}</span>
          <span className="text-[10px] text-muted-foreground">30 days</span>
        </button>
      )}

      {data?.stillUrl && (
        <button
          type="button"
          onClick={() => {
            setPaintPrefill({
              url: data.stillUrl as string,
              name: `${data.bodyPart ?? "Scan"} reference`,
              mode: "background",
            });
            setPaintReturnTo();
            void navigate({ to: "/rita" });
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 p-3 text-[12px] font-bold text-accent"
        >
          <Brush className="size-4" />
          Draw on this sketch
        </button>
      )}

      {data?.status === "ready" && <SendScanToStudio scanId={id} />}


      <Link
        to="/scans/compare"
        className="mt-3 mb-8 block rounded-2xl border border-white/10 bg-slate p-3 text-center text-[12px] font-bold"
      >
        Compare two tattoos side by side
      </Link>
    </AppShell>
  );
}
